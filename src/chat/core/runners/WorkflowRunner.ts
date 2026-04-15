import * as vscode from 'vscode';
import { ChatExecutor } from '../ChatExecutor';
import { ChatMessage } from '../../historyManager';
import { ILLMClient } from '../../../llm/types';
import { MultiLLMClient } from '../../../llm/multi';
import { ensureMandatoryRoles } from '../../../llm/utils';
import { ChatState } from '../../chatService';
import { TaskMonitor, TaskMonitorStatus } from '../../taskMonitor';
import { t, getLang } from '../../../utils/locale';
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
        personaPrompt: string,
        actionFormatPrompt: string,
        images: string[],
        steps: any[],
        initialText: string,
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource
    ) {
        state.isGenerating = true;

        // [2026-03-25] Task-Centric Dashboard - Pre-initialize all steps as IDLE
        const monitor = TaskMonitor.getInstance(this.context);
        const lang = getLang();
        steps.forEach(step => {
            const pid = step.providerId === 'default' ? state.client.getProviderId() : step.providerId;
            monitor.updateStatus(pid, t(lang, 'ui_pending'), TaskMonitorStatus.IDLE, state.client.isCloudProvider(), t(lang, 'ui_waitingForExec'), step.role);
        });

        state.updateWebview();

        // [2026-03-29] [Feature-Resume] - Determine starting step based on history
        const resumeIndex = this.getResumeIndex(state, steps);
        if (resumeIndex > 0 && resumeIndex < steps.length) {
            state.messages.push({
                id: state.generateId(),
                role: 'system',
                content: t(getLang(), 'msg_workflowResumeNotice', resumeIndex, steps[resumeIndex].role),
                timestamp: new Date()
            });
            state.updateWebview();
        }

        try {
            let i = resumeIndex;
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

                // // [2026-03-29] [Fix-UI-Hang] - Ensure state is reset even on API failure
                await Promise.all(group.map(step => this.runWorkflowStep(state, personaPrompt, actionFormatPrompt, images, step, globalCts, streamCts)));
                i = j;
            }
        } finally {
            state.isGenerating = false;
            state.updateWebview();
        }
    }

    // [2026-03-29] [Feature-Resume] - Scan history to find the last completed step
    private getResumeIndex(state: any, steps: any[]): number {
        const doneRoles = new Set<string>();
        // [2026-03-29] [Workflow-Resume] - Preferred check via isTaskDone flag, fallback to string matching for backward compatibility
        state.messages.forEach((m: ChatMessage) => {
            if (m.role === 'assistant' && m.taskName) {
                if (m.isTaskDone === true || m.content.includes('<DONE/>')) {
                    doneRoles.add(m.taskName);
                }
            }
        });

        let resumeIndex = 0;
        while (resumeIndex < steps.length) {
            const step = steps[resumeIndex];
            if (doneRoles.has(step.role)) {
                resumeIndex++;
            } else {
                break;
            }
        }
        return resumeIndex;
    }

    private async runWorkflowStep(
        state: any,
        personaPrompt: string,
        actionFormatPrompt: string,
        images: string[],
        step: any,
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource
    ) {
        // [2026-03-29] [Fix-Fallback-Logic] - Removed concrete client unwrapping in WorkflowRunner

        let turnCount = 0;
        const configLimit = vscode.workspace.getConfiguration('bwsCoder').get<number>('maxTurnsPerStep');
        const MAX_TURNS_PER_STEP = configLimit === 0 ? 999 : (configLimit || 30);
        let isStepDone = false;

        // [2026-03-27] [Fix-PlanQuality] - Validate prompt before running to detect garbage output from /plan AI
        const promptIssues = this.validateStepPrompt(step.prompt, step.role);
        if (promptIssues) {
            const lang = getLang();
            const warnMsg: import('../../historyManager').ChatMessage = {
                id: state.generateId(),
                role: 'assistant',
                content: t(lang, 'err_workflowPromptInvalid', step.role, promptIssues),
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

            // [2026-03-29] [Workflow-ModularPrompt] - Use centralized smart assembly
            const unifiedSystemPrompt = this.getUnifiedSystemPrompt(personaPrompt, actionFormatPrompt, step.prompt, step.role);

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

            // [2026-03-29] [Fix-Fallback-Logic] - Pass current step's providerId without unwrapping the client
            const result = await this.executeAITurn(state, state.client, workflowMessages, images, globalCts, streamCts, step.providerId, state.client.getProviderName(), step.role, task);
            
            // [2026-04-16] [Fix-Cancellation-Leak] - Ensure immediate stop even if executeAITurn returns result
            if (globalCts?.token.isCancellationRequested) {
                isStepDone = true;
                break;
            }

            // 2. Log full state to DebugDB for audit trail (async)
            const db = DebugDB.getInstance(this.context);
            state.messages.forEach((m: ChatMessage) => db.logMessageState(m, turnCount));

            // [2026-03-25] [Workflow Fix] - Prioritize isDone signal. If AI says DONE, we move to next step even if it did an Op this turn.
            const content = result.content || '';
            const isDone = content.includes('<DONE/>');

            if (isDone) {
                const am = task.assistantMessage;
                const lang = getLang();
                TaskMonitor.getInstance(this.context).updateStatus(state.client.getProviderId(), am?.providerName || 'AI', TaskMonitorStatus.FINISHED, state.client.isCloudProvider(), t(lang, 'msg_completedTask'), am?.taskName);
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
        const lang = getLang();
        if (!prompt || prompt.trim().length < 10) {
            return t(lang, 'err_promptTooShort');
        }
        // Detect word repeated 3+ times consecutively (e.g. "架構架構架構")
        const repeatMatch = prompt.match(/(\S{2,})\1{2,}/u);
        if (repeatMatch) {
            return t(lang, 'err_promptRepeated', repeatMatch[1]);
        }
        // Detect unfilled placeholder tokens
        const placeholderMatch = prompt.match(/(-\d+-|\{[0-9]+\}|\[PLACEHOLDER\])/);
        if (placeholderMatch) {
            return t(lang, 'err_promptPlaceholderUnfilled', placeholderMatch[0]);
        }
        return null;
    }
}
