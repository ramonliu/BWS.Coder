import * as vscode from 'vscode';
import { ChatExecutor } from '../ChatExecutor';
import { ChatMessage } from '../../historyManager';
import { ILLMClient } from '../../../llm/types';
import { MultiLLMClient } from '../../../llm/multi';
import { ensureMandatoryRoles } from '../../../llm/utils';
import { ChatState } from '../../chatService';
import { TaskMonitor, TaskMonitorStatus } from '../../taskMonitor';
import { Task } from '../Task';
import { MemoryManager } from '../MemoryManager';
import { DebugDB } from '../DebugDB';

export class WorkflowRunner extends ChatExecutor {
    public async run(
        state: {
            messages: ChatMessage[],
            isGenerating: boolean,
            client: ILLMClient,
            generateId: () => string,
            updateWebview: () => void,
            broadcast: (msg: any) => void,
            acquireFileLock: (path: string) => Promise<() => void>
        },
        dynamicSystemPrompt: string,
        images: string[],
        steps: any[],
        initialText: string,
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource
    ) {
        state.isGenerating = true;
        
        // [2026-03-25] Task-Centric Dashboard - Pre-initialize all steps as IDLE
        const monitor = TaskMonitor.getInstance(this.context);
        steps.forEach(step => {
            const pid = step.providerId === 'default' ? state.client.getProviderId() : step.providerId;
            monitor.updateStatus(pid, '等待中', TaskMonitorStatus.IDLE, state.client.isCloudProvider(), '等待執行', step.role);
        });
        
        state.updateWebview();

        let i = 0;
        while (i < steps.length && !globalCts?.token.isCancellationRequested) {
            const group = [];
            let j = i;
            if (steps[j].parallel) {
                while (j < steps.length && steps[j].parallel) {
                    group.push(steps[j]);
                    j++;
                }
            } else {
                group.push(steps[j]);
                j++;
            }

            await Promise.all(group.map(step => this.runWorkflowStep(state, dynamicSystemPrompt, images, step, globalCts, streamCts)));
            i = j;
        }

        state.isGenerating = false;
        state.updateWebview();
    }

    private async runWorkflowStep(
        state: any,
        dynamicSystemPrompt: string,
        images: string[],
        step: any,
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource
    ) {
        const providerId = step.providerId === 'default' ? state.client.getProviderId() : step.providerId;
        let currentClient = state.client;
        if (state.client instanceof MultiLLMClient) {
            const found = (state.client as MultiLLMClient).getProviderById(providerId);
            if (found) currentClient = found;
        }

        let turnCount = 0;
        const configLimit = vscode.workspace.getConfiguration('bwsCoder').get<number>('maxTurnsPerStep');
        const MAX_TURNS_PER_STEP = configLimit === 0 ? 999 : (configLimit || 30);
        let isStepDone = false;

        // [2026-03-27] [Fix-PlanQuality] - Validate prompt before running to detect garbage output from /plan AI
        const promptIssues = this.validateStepPrompt(step.prompt, step.role);
        if (promptIssues) {
            const am = state.messages[state.messages.length - 1];
            const warnMsg: import('../../historyManager').ChatMessage = {
                id: state.generateId(),
                role: 'assistant',
                content: `⚠️ [WorkflowRunner] 步驟「${step.role}」的 Prompt 品質不合格，已跳過。\n\n**問題**: ${promptIssues}\n\n請重新使用 /plan 產生工作流程，或手動修正 Prompt。`,
                timestamp: new Date(),
                providerName: 'System',
                taskName: step.role
            };
            state.messages.push(warnMsg);
            state.updateWebview();
            return;
        }

        while (!isStepDone && turnCount < MAX_TURNS_PER_STEP && !globalCts?.token.isCancellationRequested) {
            turnCount++;


            // 1. Assign weights and prune for LLM context
            MemoryManager.assignWeights(state.messages);
            const prunedMessages = MemoryManager.prune(state.messages);

            // [2026-03-25] Prompt Optimization - Put Task Instruction at the absolute top for better focus
            const unifiedSystemPrompt = `[CURRENT_STEP: ${step.role}]\nInstruction: ${step.prompt}\n\n${dynamicSystemPrompt}`;

            // [2026-03-27] [Fix-Cascading-Done] - Isolate each agent's assistant memory.
            // All agents share state.messages, so without filtering, Agent B would see Agent A's
            // "已完成任務" output and conclude everything is done before even starting its own work.
            // We pass ONLY this step's own assistant turns + all user/system messages to the LLM.
            const filteredMessages = prunedMessages.filter((m: any) =>
                m.role !== 'assistant' || m.taskName === step.role
            );

            let workflowMessages: { role: any, content: string }[] = [
                { role: 'system', content: unifiedSystemPrompt }
            ];
            workflowMessages.push(...filteredMessages.map((m: any) => ({ role: m.role as any, content: m.content })));
            workflowMessages = ensureMandatoryRoles(workflowMessages);

            const task = new Task(
                `wf_${step.role}_${turnCount}`,
                step.role,
                unifiedSystemPrompt,
                {} as any,
                state.messages
            );

            const result = await this.executeAITurn(state, currentClient, workflowMessages, images, globalCts, streamCts, currentClient.getProviderName(), step.role, task);

            // 2. Log full state to DebugDB for audit trail (async)
            const db = DebugDB.getInstance(this.context);
            state.messages.forEach((m: ChatMessage) => db.logMessageState(m, turnCount));

            // [2026-03-25] [Workflow Fix] - Prioritize isDone signal. If AI says DONE, we move to next step even if it did an Op this turn.
            const content = result.content || '';
            const isDone = content.includes('[@@DONE@@]') || content.includes('[DONE]');

            if (isDone) {
                const am = task.assistantMessage;
                TaskMonitor.getInstance(this.context).updateStatus(state.client.getProviderId(), am?.providerName || 'AI', TaskMonitorStatus.FINISHED, state.client.isCloudProvider(), '完成任務', am?.taskName);
                isStepDone = true;
            } else if (result.hasOps) {
                // [核心邏輯]：進度重置 (Progress-Based Reset) - ONLY if not done
                turnCount = 0; 
                console.info(`[BWS Coder] Step ${step.role}: Detected progress (Ops), resetting turn counter.`);
            } else if (!content.trim()) {
                // [2026-03-25] [Workflow Fix] - Do NOT auto-finish on empty content.
                // This prevents "chain reaction" skipping of steps due to glitches or transient server issues.
                // We let the turnCount naturally reach its limit unless AI explicitly says [@@DONE@@].
                console.warn(`[BWS Coder] Step ${step.role}: Empty response received. Turn ${turnCount}/${MAX_TURNS_PER_STEP}`);
            }
        }
    }

    // [2026-03-27] [Fix-PlanQuality] - Validate step prompt quality before execution
    // Detects garbled AI output (repeated words, unfilled placeholders) from the /plan command
    private validateStepPrompt(prompt: string, role: string): string | null {
        if (!prompt || prompt.trim().length < 10) {
            return `Prompt 內容過短或空白`;
        }
        // Detect word repeated 3+ times consecutively (e.g. "架構架構架構")
        const repeatMatch = prompt.match(/(\S{2,})\1{2,}/u);
        if (repeatMatch) {
            return `Prompt 包含重複詞語「${repeatMatch[1]}」(出現 3 次以上)，疑似 AI 生成亂碼`;
        }
        // Detect unfilled placeholder tokens
        const placeholderMatch = prompt.match(/(-\d+-|\{[0-9]+\}|\[PLACEHOLDER\])/);
        if (placeholderMatch) {
            return `Prompt 包含未填入的佔位符「${placeholderMatch[0]}」`;
        }
        return null;
    }
}
