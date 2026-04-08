import * as vscode from 'vscode';
import { ILLMClient } from '../../llm/types';
import * as path from 'path';
import * as fs from 'fs';
import { ChatMessage, FileOpRecord } from '../historyManager';
import { TaskMonitor, TaskMonitorStatus } from '../taskMonitor';
import { FileOpResult, createOrOverwriteFile, replaceFileContent, deleteFile, executeCommand, readFileAction } from '../fileOperations';
import { Task, TaskState } from './Task';
import { t, getLang } from '../../utils/locale';
import { StreamingParser } from './StreamingParser';

export abstract class ChatExecutor {
    constructor(protected context: vscode.ExtensionContext) { }
    
    // // [2026-03-29] [Workflow-ModularPrompt] - Centralized smart prompt assembly
    protected getUnifiedSystemPrompt(personaPrompt: string, actionFormatPrompt: string, taskPrompt?: string, stepRole?: string): string {
        const strippedTaskPrompt = taskPrompt ? taskPrompt.trimStart() : '';
        const isOverride = strippedTaskPrompt.startsWith('[@@PROMPT@@]');
        
        let identity = personaPrompt;
        let instruction = taskPrompt || '';
        
        if (isOverride) {
            identity = strippedTaskPrompt.substring(12).trim();
            instruction = ''; // Task prompt is now the identity
        }
        
        // Layering: Identity + Action Format + Instructions
        let result = `${identity}\n\n${actionFormatPrompt}`;
        
        if (stepRole) {
            result = `[CURRENT_STEP: ${stepRole}]\n${instruction ? `Instruction: ${instruction}\n\n` : ''}${result}`;
        } else if (instruction) {
            result = `[CURRENT_TASK_INSTRUCTION]\n${instruction}\n\n${result}`;
        }
        
        return result;
    }

    protected prepareDebugLog(client: ILLMClient, messages: any[], images?: string[], taskName?: string): string | undefined {
        const config = vscode.workspace.getConfiguration('bwsCoder');
        const saveRawStream = config.get<boolean>('saveRawStream');
        const saveAiRequest = config.get<boolean>('saveAiRequest');

        if (!saveRawStream && !saveAiRequest) return undefined;

        try {
            const debugDir = this.context.logUri.fsPath;
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });

            const suffix = taskName ? `_${taskName.replace(/[^a-z0-9]/gi, '_')}` : '';
            const timestamp = new Date().getTime();
            const dumpPath = path.join(debugDir, `raw_stream_${timestamp}${suffix}.log`);
            const reqPath = path.join(debugDir, `request_${timestamp}${suffix}.json`);
            if (saveRawStream) {
                console.log("raw data=>", dumpPath);
            }
            if (saveAiRequest) {
                console.log("request=>", reqPath);
                fs.writeFileSync(reqPath, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    provider: client.getProviderName(),
                    model: client.getModelName(),
                    task: taskName || 'Chat',
                    messages: messages,
                    images: images?.length || 0
                }, null, 2));
            }

            return saveRawStream ? dumpPath : undefined;
        } catch (e) {
            console.error('[BWS Coder] Failed to create debug log:', e);
            return undefined;
        }
    }


    protected async executeAITurn(
        state: {
            messages: ChatMessage[],
            isGenerating: boolean,
            client: ILLMClient,
            generateId: () => string,
            updateWebview: () => void,
            broadcast: (msg: any) => void,
            acquireFileLock: (path: string) => Promise<() => void>,
            setStreamCts?: (cts: vscode.CancellationTokenSource) => void
        },
        client: ILLMClient,
        messages: any[],
        images: string[],
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource,
        providerId?: string,
        providerName?: string,
        taskName?: string,
        currentTask?: Task
    ): Promise<{ hasOps: boolean, content: string }> {
        state.isGenerating = true;
        state.updateWebview();

        const assistantMessage: ChatMessage = {
            id: state.generateId(),
            role: 'assistant',
            content: '',
            thinking: '',
            isThinking: false, // [2026-03-30] Fix: Don't assume thinking at the start; wait for first chunk
            timestamp: new Date(),
            providerName: providerName || client.getProviderName(),
            taskName: taskName,
            isStreaming: true
        };
        state.messages.push(assistantMessage);
        if (currentTask) {
            currentTask.assistantMessage = assistantMessage;
        }
        state.updateWebview();

        let fullContent = '';
        let fullThinking = '';
        const streamStartTime = Date.now();
        const turnCts = new vscode.CancellationTokenSource();
        if (state.setStreamCts) state.setStreamCts(turnCts);
        const stopSub = globalCts?.token.onCancellationRequested(() => turnCts.cancel());
        
        // [2026-03-26] Execution Flow Fix - Synchronous background batch tracker
        const pendingOperations: Promise<any>[] = [];
        const parser = new StreamingParser(() => state.generateId());
        let allResultsCount = 0; // Tracks total operations executed for the final feedback count

        try {
            // [2026-03-29] [Fix-Fallback-Logic] - Use provided ID for monitor, or default to client's ID
            const activeProviderId = providerId || client.getProviderId();
            TaskMonitor.getInstance(this.context).updateStatus(activeProviderId, assistantMessage.providerName || 'AI', TaskMonitorStatus.IDLE, client.isCloudProvider(), undefined, taskName, undefined, true);
            
            // [2026-03-25] Prompt Optimization - Unify multiple system messages
            let finalMessages = [...messages];
            const systemMsgs = finalMessages.filter(m => m.role === 'system');
            if (systemMsgs.length > 1) {
                const unifiedSystemContent = systemMsgs.map(m => m.content.trim()).join('\n\n---\n\n');
                finalMessages = [
                    { role: 'system', content: unifiedSystemContent },
                    ...finalMessages.filter(m => m.role !== 'system')
                ];
            }

            const dumpPath = this.prepareDebugLog(client, finalMessages, images, taskName);

            // [2026-03-29] [Fix-Fallback-Logic] - Pass providerId to client.chat to ensure MultiLLMClient starts from the right place
            const stream = client.chat(
                finalMessages,
                undefined,
                (info) => {
                    if (info) {
                        assistantMessage.providerName = `${info.provider}[#${(info.keyIndex || 0) + 1}]`;
                        state.updateWebview();
                    }
                },
                turnCts.token,
                images,
                dumpPath,
                providerId,
                taskName
            );

            for await (const chunk of stream) {
                if (globalCts?.token.isCancellationRequested || turnCts.token.isCancellationRequested) break;
                if (chunk.thinking || chunk.content) {
                    // [2026-03-30] UX Fix - Only transition away from "預入中" when first chunk arrives
                    if (currentTask && currentTask.state === TaskState.IDLE) {
                        currentTask.transition(TaskState.THINKING);
                        const activeProviderId = providerId || client.getProviderId();
                        TaskMonitor.getInstance(this.context).updateStatus(activeProviderId, assistantMessage.providerName || 'AI', TaskMonitorStatus.THINKING, client.isCloudProvider(), undefined, taskName);
                        state.broadcast({ command: 'llmStats', stats: TaskMonitor.getInstance(this.context).getStats() });
                    }
                }
                if (chunk.thinking) {
                    assistantMessage.isThinking = true; // [2026-03-30] Confirm we are in thinking mode
                    fullThinking += chunk.thinking;
                    assistantMessage.thinking = fullThinking;
                }
                if (chunk.content) {
                    assistantMessage.isThinking = false; // [2026-03-30] Chunk is not think -> Thinking is finished
                    fullContent += chunk.content;
                    assistantMessage.content = fullContent; // Just to preserve raw output

                    // [2026-03-28] [State-Machine-Parser] Push chunk to stateful parser
                    const newOps = parser.pushChunk(chunk.content);
                    assistantMessage.blocks = parser.getBlocks();
                    
                    if (newOps.length > 0) {
                        allResultsCount += newOps.length;
                        if (currentTask && currentTask.state !== TaskState.EXECUTING) {
                            currentTask.transition(TaskState.EXECUTING);
                        }

                        // Check if any op is 'execute'. If so, we should stop the stream after this batch.
                        const hasExecute = newOps.some(op => op.action === 'execute');

                        // [2026-03-26] Non-blocking Execution - Launch batch without await
                        const activeProviderIdForBatch = providerId || client.getProviderId();
                        console.log(`[EXECUTOR:streaming] launching batch of ${newOps.length} op(s):`, newOps.map((o: any) => `${o.action}:${o.filePath}`));
                        const batchPromise = this.processOperationsBatch(
                            state, client, newOps as any, activeProviderIdForBatch, assistantMessage.providerName || 'AI',
                            taskName, currentTask, turnCts, globalCts
                        ).then(batchResults => {
                            // [2026-03-28] Store results precisely into the newly closed blocks
                            batchResults.forEach((res, i) => {
                                const block = newOps[i];
                                block.isPending = false;
                                block.success = res.success;
                                block.result = (res.output || res.error || '').trim();
                                console.log(`[EXECUTOR:streaming] addAction via batch: ${res.action}:${res.filePath}, success=${res.success}`);
                            });
                            state.updateWebview();
                        });

                        pendingOperations.push(batchPromise);

                        if (hasExecute) {
                            turnCts.cancel();
                            break; 
                        }
                    }
                }
                state.updateWebview();
            }

            // [2026-03-26] Sync Point - Wait for all background operations to finish before concluding turn
            await Promise.all(pendingOperations);

            assistantMessage.isStreaming = false;
            assistantMessage.isThinking = false;

            // [2026-03-29] [Workflow-Resume] - Set isTaskDone before tag replacement to ensure logic can resume
            if (assistantMessage.content.includes('[@@DONE@@]') || assistantMessage.content.includes('[DONE]') || assistantMessage.content.includes('<DONE/>')) {
                // If it's a legacy [@@DONE@@] signal, strip it for cleaner UI, unless user is debugging
                if (assistantMessage.content.includes('[@@DONE@@]')) {
                    const clean = assistantMessage.content.replace('[@@DONE@@]', t(getLang(), 'ui_completedTask', taskName || 'AI'));
                    assistantMessage.content = clean;
                } else if (assistantMessage.content.includes('[DONE]')) {
                    assistantMessage.content = assistantMessage.content.replace('[DONE]', t(getLang(), 'ui_completedTask', taskName || 'AI'));
                } else if (assistantMessage.content.includes('<DONE/>')) {
                    assistantMessage.content = assistantMessage.content.replace('<DONE/>', t(getLang(), 'ui_completedTask', taskName || 'AI'));
                }
                assistantMessage.isTaskDone = true;
            }

            state.updateWebview();

            // 最終掃描：Flush residual state buffer
            const finalOps = parser.close();
            assistantMessage.blocks = parser.getBlocks();
            
            if (finalOps.length > 0) {
                allResultsCount += finalOps.length;
                if (currentTask && currentTask.state !== TaskState.EXECUTING) currentTask.transition(TaskState.EXECUTING);

                const activeProviderIdForFinal = providerId || client.getProviderId();
                console.log(`[EXECUTOR:close] launching final batch of ${finalOps.length} op(s):`, finalOps.map((o: any) => `${o.action}:${o.filePath}`));
                const finalBatchResults = await this.processOperationsBatch(
                    state, client, finalOps as any, activeProviderIdForFinal, assistantMessage.providerName || 'AI',
                    taskName, currentTask, turnCts, globalCts
                );

                finalBatchResults.forEach((res, i) => {
                    const block = finalOps[i];
                    block.isPending = false;
                    block.success = res.success;
                    block.result = (res.output || res.error || '').trim();
                    console.log(`[EXECUTOR:close] addAction via finalBatch: ${res.action}:${res.filePath}, success=${res.success}`);
                });
                state.updateWebview();
            }

            if (allResultsCount > 0) {
                if (currentTask) {
                    currentTask.transition(TaskState.FEEDBACK);
                    // 如果有 Task，主動推送一則訊息作為執行結果回報給 AI
                    const feedbackMsg: ChatMessage = {
                        id: state.generateId(),
                        role: 'user',
                        content: currentTask.getFeedbackContent(),
                        timestamp: new Date()
                    };
                    state.messages.push(feedbackMsg);
                    currentTask.transition(TaskState.FINISHED);
                }

                state.updateWebview();
                const activeProviderIdStatus = providerId || client.getProviderId();
                TaskMonitor.getInstance(this.context).updateStatus(activeProviderIdStatus, assistantMessage.providerName || 'AI', TaskMonitorStatus.REPORTING, client.isCloudProvider(), t(getLang(), 'msg_reporting', allResultsCount), taskName);
                state.broadcast({ command: 'llmStats', stats: TaskMonitor.getInstance(this.context).getStats() });

                // 延遲一下讓使用者看到 REPORTING 狀態
                await new Promise(resolve => setTimeout(resolve, 800));

                TaskMonitor.getInstance(this.context).updateStatus(activeProviderIdStatus, assistantMessage.providerName || 'AI', TaskMonitorStatus.IDLE, client.isCloudProvider(), undefined, taskName);
                TaskMonitor.getInstance(this.context).recordActivity(activeProviderIdStatus, 0, Date.now() - streamStartTime);
                state.broadcast({ command: 'llmStats', stats: TaskMonitor.getInstance(this.context).getStats() });
                return { hasOps: true, content: fullContent };
            }

            if (currentTask) currentTask.transition(TaskState.IDLE);
            const finalActiveProviderId = providerId || client.getProviderId();
            TaskMonitor.getInstance(this.context).updateStatus(finalActiveProviderId, assistantMessage.providerName || 'AI', TaskMonitorStatus.IDLE, client.isCloudProvider(), undefined, taskName);
            TaskMonitor.getInstance(this.context).recordActivity(finalActiveProviderId, 0, Date.now() - streamStartTime);
            state.broadcast({ command: 'llmStats', stats: TaskMonitor.getInstance(this.context).getStats() });
            return { hasOps: false, content: fullContent };

        } catch (error: any) {
            const errorMsg = error.message || String(error);
            const isStalled = errorMsg.includes('STALLED');
            
            if (currentTask) {
                currentTask.transition(isStalled ? TaskState.RESCUE : TaskState.ERROR);
                
                // [2026-03-25] [RESCUE State Logic] - Inject localized rescue prompt for stalled streams
                if (isStalled) {
                    const config = vscode.workspace.getConfiguration('bwsCoder');
                    const lang = config.get<string>('language') || 'en';
                    
                    const rescueTitle = t(lang, 'rescueTitle');
                    const rescuePrompt = t(lang, 'rescuePrompt')
                        .replace('{0}', String(allResultsCount))
                        .replace('{1}', fullContent.slice(-100));

                    const rescueMsg: ChatMessage = {
                        id: state.generateId(),
                        role: 'user',
                        content: `${rescueTitle}: ${rescuePrompt}`,
                        timestamp: new Date()
                    };
                    state.messages.push(rescueMsg);
                }
            }
            
            // // [2026-03-29] [Fix-UI-Hang] - Append error to narrative and RE-THROW to break Runner loops
            assistantMessage.content += `\n\n[${t(getLang(), 'msg_execError')}]: ${errorMsg}`;
            assistantMessage.isThinking = false;
            assistantMessage.isStreaming = false;
            
            const monitorStatus = isStalled ? TaskMonitorStatus.STALLED : TaskMonitorStatus.ERROR;
            // [2026-03-29] [Fix-Lint] - Ensure activeProviderId is a string for TaskMonitor
            const activeProviderId = providerId || client.getProviderId();
            TaskMonitor.getInstance(this.context).updateStatus(activeProviderId, assistantMessage.providerName || 'AI', monitorStatus, client.isCloudProvider(), errorMsg, taskName);
            state.broadcast({ command: 'llmStats', stats: TaskMonitor.getInstance(this.context).getStats() });
            state.updateWebview();
            
            throw error; // 核心修正：拋出異常以中斷 Runner 內部的 while 迴圈
        } finally {
            stopSub?.dispose();
            turnCts.dispose();
        }
    }

    /**
     * Executes a batch of operations. Default implementation is serial.
     * Runners like ConcurrentChatRunner can override this to provide parallel execution.
     */
    protected async processOperationsBatch(
        state: any,
        client: ILLMClient,
        ops: any[],
        providerId: string,
        providerDisplayName: string,
        taskName: string | undefined,
        currentTask: Task | undefined,
        turnCts: vscode.CancellationTokenSource,
        globalCts?: vscode.CancellationTokenSource
    ): Promise<FileOpResult[]> {
        const results: FileOpResult[] = [];
        for (const op of ops) {
            const res = await this.performSingleOperation(
                state, client, op, providerId, providerDisplayName, taskName, currentTask, turnCts, globalCts
            );
            results.push(res);
            
            // Serial update for 'staircase' effect when there are multiple ops
            if (ops.length > 1) {
                // The main loop in executeAITurn will handle the webview update after the batch
                // but for very long serial batches, we might want more frequent updates.
                // For now, we keep it simple.
            }
        }
        return results;
    }

    /**
     * Performs a single operation and handles status reporting and task tracking.
     */
    protected async performSingleOperation(
        state: any,
        client: ILLMClient,
        op: any,
        providerId: string,
        providerDisplayName: string,
        taskName: string | undefined,
        currentTask: Task | undefined,
        turnCts: vscode.CancellationTokenSource,
        globalCts?: vscode.CancellationTokenSource
    ): Promise<FileOpResult> {
        if (globalCts?.token.isCancellationRequested || turnCts.token.isCancellationRequested) {
            return { action: op.action, success: false, error: 'Cancelled', filePath: op.filePath || 'unknown' };
        }

        TaskMonitor.getInstance(this.context).updateStatus(
            providerId,
            providerDisplayName,
            TaskMonitorStatus.EXECUTING,
            client.isCloudProvider(),
            `執行中: ${op.action} ${op.filePath}`,
            taskName
        );
        state.broadcast({ command: 'llmStats', stats: TaskMonitor.getInstance(this.context).getStats() });

        // [2026-03-30] [Safety-Validation] - Pre-Execution check for AI protocol violations
        const validationError = this.validateOperation(op);
        if (validationError) {
            return { action: op.action, success: false, error: validationError, filePath: op.filePath || 'unknown' };
        }

        // [2026-04-09] [Redundancy-Guard] - Prevent loops where AI repeatedly reads the same file or lists the same directory
        const redundancyError = this.checkRedundancy(state, op);
        if (redundancyError) {
            return { action: op.action, success: false, error: redundancyError, filePath: op.filePath || 'unknown' };
        }

        let res: FileOpResult;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const cleanFilePath = op.filePath?.replace(/^(?:path:)/i, '').trim() || '';
        let absolutePath = cleanFilePath ? (path.isAbsolute(cleanFilePath) ? cleanFilePath : path.join(workspaceRoot, cleanFilePath)) : '';

        // [2026-04-09] [Workspace-Isolation-Guard] - Ensure AI doesn't access files outside workspace without permission
        if (absolutePath && workspaceRoot) {
            const isWindows = process.platform === 'win32';
            const normalizedRoot = isWindows ? path.normalize(workspaceRoot).toLowerCase() : path.normalize(workspaceRoot);
            const normalizedPath = isWindows ? path.normalize(absolutePath).toLowerCase() : path.normalize(absolutePath);

            if (!normalizedPath.startsWith(normalizedRoot)) {
                const lang = getLang();
                const confirmMsg = lang === 'zh-TW'
                    ? `[安全性警告] AI 正在嘗試存取工作區（${workspaceRoot}）外的路徑：\n\n${absolutePath}\n\n您是否允許執行此操作？`
                    : `[Security Warning] AI is attempting to access a path outside the workspace (${workspaceRoot}):\n\n${absolutePath}\n\nDo you allow this operation?`;
                const allowBtn = lang === 'zh-TW' ? '允許執行' : 'Allow';
                const denyBtn = lang === 'zh-TW' ? '拒絕存取' : 'Deny';

                // Use a modal dialog for security confirmation to ensure it's not missed
                const choice = await vscode.window.showWarningMessage(confirmMsg, { modal: true }, allowBtn, denyBtn);
                if (choice !== allowBtn) {
                    const errorMsg = lang === 'zh-TW'
                        ? `[安全性攔截] 使用者拒絕了對工作區外路徑的存取請求：${absolutePath}`
                        : `[Security Guard] Access denied by user for path outside workspace: ${absolutePath}`;
                    console.warn(`[ChatExecutor] Security block: User denied access to ${absolutePath}`);
                    return { action: op.action, success: false, error: errorMsg, filePath: op.filePath || 'unknown' };
                }
            }
        }

        const release = absolutePath ? await state.acquireFileLock(absolutePath) : () => { };
        try {
            switch (op.action) {
                case 'create':
                case 'modify': res = await createOrOverwriteFile(absolutePath, op.content || ''); break;
                case 'replace': res = await replaceFileContent(absolutePath, op.content || ''); break;
                case 'delete': res = await deleteFile(absolutePath); break;
                case 'execute': res = await executeCommand((op.content || cleanFilePath || '').trim(), globalCts?.token); break;
                case 'read': res = await readFileAction(absolutePath, cleanFilePath); break;
                default: res = { action: 'execute', success: false, error: 'Unknown action', filePath: cleanFilePath || 'unknown' };
            }
        } finally { release(); }

        if (currentTask) {
            currentTask.addAction({
                id: op.toolCallId,
                action: op.action,
                filePath: op.filePath,
                content: op.content,
                success: res.success,
                result: res.output,
                error: res.error
            });
        }
        return res;
    }

    /**
     * [2026-03-30] AI Protocol Guard - Detects bad patterns and teaches the AI correct usage.
     */
    private validateOperation(op: any): string | null {
        const action = op.action;
        const content = (op.content || '').trim();
        const filePath = op.filePath || '';
        const lang = getLang();

        // Case 1: AI tries to use terminal command (redirection) for file creation
        if (action === 'execute') {
            const lc = content.toLowerCase();
            const hasRedirection = lc.includes('>') || lc.includes('>>') || 
                                 lc.includes('set-content') || lc.includes('out-file') || 
                                 lc.includes('tee-object');
            
            if (hasRedirection) {
                return t(lang, 'err_protocolViolation', filePath || 'path');
            }

            // [2026-03-31] Completely replaced Regex with robust string-based detection
            const lowerContent = content.toLowerCase();
            const spIdx = lowerContent.indexOf('start-process');
            if (spIdx !== -1) {
                const waitIdx = lowerContent.indexOf('-wait', spIdx);
                if (waitIdx !== -1) {
                    // Extract FilePath manually without Regex
                    let exePath = '"/path/to/executable.exe"';
                    const fpIdx = lowerContent.indexOf('-filepath', spIdx);
                    if (fpIdx !== -1) {
                        const afterFp = content.substring(fpIdx + 9).trim(); // Skip '-filepath'
                        if (afterFp.length > 0) {
                            if (afterFp.startsWith('"') || afterFp.startsWith("'")) {
                                const quote = afterFp[0];
                                const endIdx = afterFp.indexOf(quote, 1);
                                if (endIdx !== -1) {
                                    exePath = afterFp.substring(0, endIdx + 1);
                                }
                            } else {
                                // Find the first whitespace character manually
                                let spaceIdx = -1;
                                for (let i = 0; i < afterFp.length; i++) {
                                    const char = afterFp[i];
                                    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
                                        spaceIdx = i;
                                        break;
                                    }
                                }
                                exePath = (spaceIdx === -1) ? afterFp : afterFp.substring(0, spaceIdx);
                            }
                        }
                    }
                    return t(lang, 'err_commandFormat', exePath);
                }
            }
        }

        // Case 2: Content operations are empty
        if ((action === 'create' || action === 'modify' || action === 'replace') && !content) {
            return t(lang, 'err_emptyContent', action, filePath || 'path');
        }

        // Case 3: Malformed replace block
        if (action === 'replace') {
            const hasSearch = content.includes('<search>');
            const hasReplace = content.includes('<replace>');
            if (!hasSearch || !hasReplace) {
                return t(lang, 'err_replaceFormat', filePath || (lang === 'en' ? 'path' : '路徑'));
            }
        }

        return null;
    }

    /**
     * [2026-04-09] Redundancy Guard - Detects if the same discovery action is being repeated too many times.
     */
    private checkRedundancy(state: any, op: any): string | null {
        // [Heuristic] We only really care about discovery-style actions that don't change state
        if (op.action !== 'read' && op.action !== 'execute') return null;

        const history = state.messages as ChatMessage[];
        if (!history || history.length === 0) return null;

        // Check the last 15 messages (approx 5-7 turns) for the exact same action and target
        const windowSize = 15;
        const lastMessages = history.slice(-windowSize);
        
        let repeatCount = 0;
        for (const m of lastMessages) {
            if (m.role === 'assistant' && m.blocks) {
                const foundMatch = m.blocks.some(b => 
                    b.type === 'action' && 
                    b.action === op.action && 
                    b.filePath === op.filePath &&
                    b.content === op.content // For 'execute', the command is in content
                );
                if (foundMatch) repeatCount++;
            }
        }

        if (repeatCount >= 2) {
            const lang = getLang();
            const msg = lang === 'zh-TW' 
                ? `[系統守護] 檢測到重複操作：您在最近幾回合內已多次執行 '${op.action}' 於 '${op.filePath || op.content}'。請檢查之前的對話記錄與執行結果，避免重複工作並直接推進任務。`
                : `[System Guard] Redundant action detected: You have already performed '${op.action}' on '${op.filePath || op.content}' multiple times recently. Please reference your previous findings and proceed with analysis instead of re-reading.`;
            
            console.warn(`[ChatExecutor] Redundancy Guard blocked action: ${op.action} on ${op.filePath || op.content} (Repeated ${repeatCount} times)`);
            return msg;
        }

        return null;
    }
}
