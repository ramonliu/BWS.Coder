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
import { MemoryPalaceManager } from '../MemoryPalaceManager';

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
                    let result: any;
                    try {
                        result = await this.executeAITurn(state, state.client, finalPromptMessages, images, globalCts, streamCts, undefined, undefined, 'SingleChat', task);
                        
                        // [2026-04-16] [Fix-Cancellation-Leak] - Ensure immediate stop even if executeAITurn returns result
                        if (globalCts?.token.isCancellationRequested) {
                            currentState = ChatState.IDLE;
                            break;
                        }
                    } catch (error: any) {
                        if (error.message === 'ABORTED') {
                            currentState = ChatState.IDLE;
                            break;
                        }
                        throw error;
                    }

                    if (!result) break;

                    // 2. Log full state to DebugDB for audit trail (async)
                    const db = DebugDB.getInstance(this.context);
                    state.messages.forEach(m => db.logMessageState(m, turnCount));

                    const isDone = result.content.includes('<DONE/>') || task.assistantMessage?.isTaskDone;

                    if (isDone) {
                        const am = task.assistantMessage;
                        const lang = require('../../../utils/locale').getLang();
                        const t = require('../../../utils/locale').t;
                        TaskMonitor.getInstance(this.context).updateStatus(state.client.getProviderId(), am?.providerName || 'AI', TaskMonitorStatus.FINISHED, state.client.isCloudProvider(), t(lang, 'msg_completedTask'), am?.taskName);
                        currentState = ChatState.IDLE; // AI 明確宣告完成
                        result.hasOps = false;
                    } else if (result.hasOps) {
                        currentState = ChatState.CHATTING;
                        result.hasOps = false;
                        // } else {
                        //     state.messages.push({
                        //         id: state.generateId(),
                        //         role: 'system',
                        //         content: "You are currently in an ACTIVE EXECUTION LOOP. Plain text responses without tool call tags are PROHIBITED unless the mission objective is 100% complete and verified. If the task is not yet finished, you MUST proceed with the next <tool_call>. Output <DONE/> only when you are certain that NO further file operations or terminal commands are necessary.",
                        //         timestamp: new Date()
                        //     });
                        //     currentState = ChatState.CHATTING;
                    } else {
                        // [2026-04-11] [Fix-EmptyResponse-Loop] - AI returned empty content with no ops (e.g. connection drop).
                        // Without this fallback, currentState stays CHATTING and spawns infinite empty turns.
                        currentState = ChatState.IDLE;
                    }
                }
            }

            // [2026-04-16] Memory Palace - Automatic Extraction (The Janitor)
            // Trigger background extraction after the session finishes normally.
            if (currentState === ChatState.IDLE && !globalCts?.token.isCancellationRequested) {
                MemoryPalaceManager.getInstance(this.context).extractAndStore(state.messages, state.client, this.context);
            }
        } finally {
            state.isGenerating = false;
            state.updateWebview();
        }
    }
}
