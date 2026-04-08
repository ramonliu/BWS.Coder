import * as vscode from 'vscode';
import { ChatExecutor } from '../ChatExecutor';
import { ChatMessage } from '../../historyManager';
import { ILLMClient } from '../../../llm/types';
import { ChatState } from '../../chatService';
import { ensureMandatoryRoles } from '../../../llm/utils';
import { Task } from '../Task';
import { TaskMonitor, TaskMonitorStatus } from '../../taskMonitor';
import { MemoryManager } from '../MemoryManager';
import { DebugDB } from '../DebugDB';
import { FileOpResult } from '../../fileOperations';

/**
 * ConcurrentChatRunner - 執行「並行/獨立」策略的執行器 (對應 structure.md -> [TP1])
 * 
 * [2026-03-25] [Implementing Concurrent Runner Logic] - Implemented parallel execution using Promise.all after refactoring ChatExecutor.
 * 負責處理獨立任務的併發執行 (Concurrent Execution)。
 */
export class ConcurrentChatRunner extends ChatExecutor {

    /**
     * Overrides processOperationsBatch to execute all operations in parallel.
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
        // [2026-03-25] [Implementing Concurrent Runner Logic] - TP1 strategy: Use Promise.all for independent ops.
        const promises = ops.map(op => 
            this.performSingleOperation(
                state, client, op, providerId, providerDisplayName, taskName, currentTask, turnCts, globalCts
            )
        );
        return await Promise.all(promises);
    }

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
                        'ConcurrentChat',
                        personaPrompt,
                        {} as any,
                        state.messages
                    );

                    // 3. AI 串流解析與執行 (AI1 -> AI2 -> CHUNK -> T2)
                    // // [2026-03-29] [Fix-UI-Hang] - Ensure state is reset even on API failure
                    const result = await this.executeAITurn(state, state.client, finalPromptMessages, images, globalCts, streamCts, undefined, undefined, 'ConcurrentTask', task);

                    // 4. 紀錄審計日誌
                    const db = DebugDB.getInstance(this.context);
                    state.messages.forEach(m => db.logMessageState(m, turnCount));

                    const isDone = result.content.includes('[@@DONE@@]') || result.content.includes('[DONE]') || result.content.includes('<DONE/>');

                    if (isDone && !result.hasOps) {
                        const am = task.assistantMessage;
                        const lang = require('../../../utils/locale').getLang();
                        const t = require('../../../utils/locale').t;
                        TaskMonitor.getInstance(this.context).updateStatus(state.client.getProviderId(), am?.providerName || 'AI', TaskMonitorStatus.FINISHED, state.client.isCloudProvider(), t(lang, 'msg_completedTask'), am?.taskName);
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
