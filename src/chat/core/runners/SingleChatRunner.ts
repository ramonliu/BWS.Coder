import * as vscode from 'vscode';
import { ChatExecutor } from '../ChatExecutor';
import { ChatMessage } from '../../historyManager';
import { ILLMClient } from '../../../llm/types';
import { ChatState } from '../../chatService';
import { ensureMandatoryRoles } from '../../../llm/utils';
import { Task } from '../Task';
import { MemoryManager } from '../MemoryManager';
import { DebugDB } from '../DebugDB';
import { TaskMonitor, TaskMonitorStatus } from '../../taskMonitor';

export class SingleChatRunner extends ChatExecutor {
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
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource,
        taskPrompt?: string
    ) {
        let currentState = ChatState.CHATTING;
        let turnCount = 0;
        const MAX_TURNS = 20;

        try {
            while (currentState !== ChatState.IDLE && !globalCts?.token.isCancellationRequested) {
                turnCount++;

                if (currentState === ChatState.CHATTING) {
                    // 1. Assign weights and prune for LLM context
                    MemoryManager.assignWeights(state.messages);
                    const prunedMessages = MemoryManager.prune(state.messages);

                    // [2026-03-29] [Workflow-ModularPrompt] - Use centralized smart assembly
                    const unifiedSystemPrompt = this.getUnifiedSystemPrompt(personaPrompt, actionFormatPrompt, taskPrompt);

                    const turnMessages: { role: any, content: string }[] = [{ role: 'system', content: unifiedSystemPrompt }];
                    turnMessages.push(...prunedMessages
                        .filter(m => !m.content.startsWith('[DEBUG]'))
                        .map((m: any) => ({ role: m.role as any, content: m.content })));
                    const finalPromptMessages = ensureMandatoryRoles(turnMessages);

                    // 建立本輪 Task 物件
                    const task = new Task(
                        state.generateId(),
                        'SingleChat',
                        personaPrompt, // Keeping the base context in Task for reference
                        {} as any,
                        state.messages
                    );

                    // // [2026-03-29] [Fix-UI-Hang] - Ensure state is reset even on API failure
                    const result = await this.executeAITurn(state, state.client, finalPromptMessages, images, globalCts, streamCts, undefined, undefined, 'SingleChat', task);

                    // 2. Log full state to DebugDB for audit trail (async)
                    const db = DebugDB.getInstance(this.context);
                    state.messages.forEach(m => db.logMessageState(m, turnCount));

                    const isDone = result.content.includes('[@@DONE@@]') || result.content.includes('[DONE]');

                    if (isDone && !result.hasOps) {
                        const am = task.assistantMessage;
                        TaskMonitor.getInstance(this.context).updateStatus(state.client.getProviderId(), am?.providerName || 'AI', TaskMonitorStatus.FINISHED, state.client.isCloudProvider(), '完成任務', am?.taskName);
                        currentState = ChatState.IDLE; // AI 明確宣告完成
                    } else if (result.hasOps) {
                        currentState = ChatState.CHATTING;
                    } else {
                        currentState = ChatState.IDLE;
                    }
                }
            }
        } finally {
            state.isGenerating = false;
            state.updateWebview();
        }
    }
}
