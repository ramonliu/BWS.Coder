import * as vscode from 'vscode';
import { ILLMClient } from '../../llm/types';
import * as path from 'path';
import * as fs from 'fs';
import { ChatMessage, FileOpRecord } from '../historyManager';
import { TaskMonitor, TaskMonitorStatus } from '../taskMonitor';
import { FileOpResult, createOrOverwriteFile, replaceFileContent, deleteFile, executeCommand, readFileAction } from '../fileOperations';
import { Task, TaskState } from './Task';
import { t } from '../../utils/locale';
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
            isThinking: true,
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
                    if (currentTask && currentTask.state === TaskState.IDLE) {
                        currentTask.transition(TaskState.THINKING);
                        const activeProviderId = providerId || client.getProviderId();
                        TaskMonitor.getInstance(this.context).updateStatus(activeProviderId, assistantMessage.providerName || 'AI', TaskMonitorStatus.THINKING, client.isCloudProvider(), undefined, taskName);
                        state.broadcast({ command: 'llmStats', stats: TaskMonitor.getInstance(this.context).getStats() });
                    }
                }
                if (chunk.thinking) {
                    fullThinking += chunk.thinking;
                    assistantMessage.thinking = fullThinking;
                }
                if (chunk.content) {
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
            if (assistantMessage.content.includes('[@@DONE@@]') || assistantMessage.content.includes('[DONE]')) {
                assistantMessage.isTaskDone = true;
            }

            // [2026-03-25] Narrative Step Completion Signal - Replace [@@DONE@@] with narrative text for history coherence.
            if (assistantMessage.content.includes('[@@DONE@@]')) {
                assistantMessage.content = assistantMessage.content.replace('[@@DONE@@]', `(${taskName || 'AI'})已完成任務`);
            } else if (assistantMessage.content.includes('[DONE]')) {
                assistantMessage.content = assistantMessage.content.replace('[DONE]', `(${taskName || 'AI'})已完成任務`);
            }

            state.updateWebview();

            // 最終掃描：Flush residual state buffer
            const finalOps = parser.close();
            assistantMessage.blocks = parser.getBlocks();
            
            if (finalOps.length > 0) {
                allResultsCount += finalOps.length;
                if (currentTask && currentTask.state !== TaskState.EXECUTING) currentTask.transition(TaskState.EXECUTING);

                const activeProviderIdForFinal = providerId || client.getProviderId();
                const finalBatchResults = await this.processOperationsBatch(
                    state, client, finalOps as any, activeProviderIdForFinal, assistantMessage.providerName || 'AI',
                    taskName, currentTask, turnCts, globalCts
                );

                finalBatchResults.forEach((res, i) => {
                    const block = finalOps[i];
                    block.isPending = false;
                    block.success = res.success;
                    block.result = (res.output || res.error || '').trim();
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
                TaskMonitor.getInstance(this.context).updateStatus(activeProviderIdStatus, assistantMessage.providerName || 'AI', TaskMonitorStatus.REPORTING, client.isCloudProvider(), `正在回報 ${allResultsCount} 個執行結果...`, taskName);
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
            assistantMessage.content += `\n\n[執行錯誤]: ${errorMsg}`;
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

        let res: FileOpResult;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const cleanFilePath = op.filePath?.replace(/^(?:path:)/i, '').trim() || '';
        const absolutePath = cleanFilePath ? (path.isAbsolute(cleanFilePath) ? cleanFilePath : path.join(workspaceRoot, cleanFilePath)) : '';

        const release = absolutePath ? await state.acquireFileLock(absolutePath) : () => { };
        try {
            switch (op.action) {
                case 'create':
                case 'modify': res = await createOrOverwriteFile(absolutePath, op.content || ''); break;
                case 'replace': res = await replaceFileContent(absolutePath, op.content || ''); break;
                case 'delete': res = await deleteFile(absolutePath); break;
                case 'execute': res = await executeCommand((op.content || cleanFilePath || '').trim(), globalCts?.token); break;
                case 'read': res = await readFileAction(absolutePath); break;
                default: res = { action: 'execute', success: false, error: 'Unknown action', filePath: cleanFilePath || 'unknown' };
            }
        } finally { release(); }

        if (currentTask) {
            currentTask.addAction({
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
}
