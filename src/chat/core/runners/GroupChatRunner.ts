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

export class GroupChatRunner extends ChatExecutor {
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
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource,
        taskPrompt?: string,
        personas?: { name: string, persona: string }[]
    ) {
        let currentState = ChatState.CHATTING;
        let turnCount = 0;
        let groupChatIndex = 0;
        let personaIndex = 0; // [2026-03-27] [Feature-GroupPersona] Track which persona is currently speaking

        // [2026-03-25] Prompt Optimization - Put Task Instruction at the absolute top for better focus
        let basePromptMessages: { role: any, content: string }[] = [];
        if (taskPrompt) {
            basePromptMessages.push({ role: 'system', content: `[CURRENT_TASK_INSTRUCTION]\n${taskPrompt}` });
        }
        basePromptMessages.push({ role: 'system', content: dynamicSystemPrompt });

        let allClients = (state.client as any).getActiveClients ? (state.client as any).getActiveClients() : [state.client];
        const availability = await Promise.all(allClients.map(async (c: any) => ({
            client: c,
            exhausted: await c.isExhausted()
        })));
        let groupChatClients = availability.filter(a => !a.exhausted).map(a => a.client);

        if ((!personas || personas.length === 0) && groupChatClients.length <= 1) {
            const exhaustedNames = availability.filter(a => a.exhausted).map(a => (a.client as any).getProviderName ? (a.client as any).getProviderName() : 'AI');
            let notice = `[系統提示] 您未設定主題且可用的 AI 提供者不足兩個，將以單一模型模式進行一次性對話。`;
            if (exhaustedNames.length > 0) notice += ` (已排除配額超出的：${exhaustedNames.join(', ')})`;
            state.messages.push({ id: state.generateId(), role: 'system', content: notice, timestamp: new Date() });
            groupChatClients = [];
        } else {
            // [2026-03-27] Feature: If we have personas, even 1 provider can roleplay all of them!
            // Ensure we have at least one client to power the personas
            if (groupChatClients.length === 0 && availability.length > 0) {
                groupChatClients = [availability[0].client]; // Use the first available one even if exhausted, or just whatever we have
            }
            if (groupChatClients.length === 0 && state.client) {
                groupChatClients = [state.client];
            }

            const participantList = personas && personas.length > 0 
                ? personas.map(p => p.name).join('、')
                : groupChatClients.map((c: any) => c.getProviderName ? c.getProviderName() : 'AI').join(', ');
            state.messages.push({ id: state.generateId(), role: 'system', content: `[系統開始群聊 / 辯論]，參與者：${participantList}\n將自動交替發言，直到達到設限回合或完成任務。`, timestamp: new Date() });
        }
        state.updateWebview();

        while (currentState !== ChatState.IDLE && !globalCts?.token.isCancellationRequested) {
            turnCount++;

            if (currentState === ChatState.CHATTING) {
                // 1. Assign weights and prune for LLM context
                MemoryManager.assignWeights(state.messages);
                const prunedMessages = MemoryManager.prune(state.messages);

                let currentClient = state.client;
                let providerName = undefined;
                let groupPromptAddon = '';

                if (groupChatClients.length > 0) {
                    // [2026-03-27] [Feature-GroupPersona] Use AI-generated persona if available
                    // If personas exist, they dictate the number of speakers and the rotation. The underlying providers just power them.
                    if (personas && personas.length > 0) {
                        const currentPersona = personas[personaIndex];
                        providerName = currentPersona.name; // Display name in UI
                        groupPromptAddon = `\n\n[群聊指令] 你現在的角色是「${currentPersona.name}」。\n${currentPersona.persona}\n\n請以這個身份，針對上文內容發表你的看法，或反駁其他人的觀點。\n⚠️ **注意：這是一場純文字對話辯論。請「直接輸出」你的發言內容，【絕對不要】使用 \`[@@ create:檔案路徑 @@]\` 等任何標籤來建立檔案，也不需要生成總結報告。**`;
                        personaIndex = (personaIndex + 1) % personas.length;
                        
                        // Pick a client to power this persona (round-robin through available clients)
                        currentClient = groupChatClients[groupChatIndex];
                        groupChatIndex = (groupChatIndex + 1) % groupChatClients.length;
                    } else {
                        // Fallback to legacy behavior: rotate through providers
                        currentClient = groupChatClients[groupChatIndex];
                        providerName = currentClient.getProviderName();
                        groupPromptAddon = `\n\n[群聊指令] 你現在是以 ${providerName} 的身份參與討論。請針對上文內容發表你的看法，或繼續執行未完成的任務。\n⚠️ **注意：若無剛性需求，請直接進行文字對話，不要建立檔案。**`;
                        groupChatIndex = (groupChatIndex + 1) % groupChatClients.length;
                    }
                }

                let turnMessages = [...basePromptMessages];
                turnMessages.push(...prunedMessages
                    .filter(m => !m.content.startsWith('[DEBUG]'))
                    .map((m: any) => ({ role: m.role as any, content: m.content })));
                let finalPromptMessages = ensureMandatoryRoles(turnMessages);

                if (groupPromptAddon) {
                    const lastMsg = finalPromptMessages[finalPromptMessages.length - 1];
                    if (lastMsg && (lastMsg.role as string) === 'user') lastMsg.content += groupPromptAddon;
                    else finalPromptMessages.push({ role: 'user', content: groupPromptAddon });
                }

                // [2026-03-25] Prompt Optimization - Descriptive Task Name
                const descriptiveTaskName = taskPrompt ? `Group (${providerName || 'AI'}): ${taskPrompt.substring(0, 40).replace(/\n/g, ' ')}...` : `GroupChat: ${providerName || 'AI'}`;

                const task = new Task(
                    state.generateId(),
                    providerName || 'GroupChat',
                    dynamicSystemPrompt,
                    {} as any,
                    state.messages
                );
                const result = await this.executeAITurn(state, currentClient, finalPromptMessages, images, globalCts, streamCts, providerName, descriptiveTaskName, task);

                // 2. Log full state to DebugDB for audit trail (async)
                const db = DebugDB.getInstance(this.context);
                state.messages.forEach(m => db.logMessageState(m, turnCount));

                const isDone = result.content.includes('[@@DONE@@]') || result.content.includes('[DONE]');

                // [2026-03-27] User Preference: 0 means unlimited rounds
                const configMaxRounds = vscode.workspace.getConfiguration('bwsCoder').get<number>('groupChatMaxRounds');
                const maxRounds = configMaxRounds !== undefined ? configMaxRounds : 30;

                if (isDone && !result.hasOps) {
                    const am = task.assistantMessage;
                    TaskMonitor.getInstance(this.context).updateStatus(state.client.getProviderId(), am?.providerName || 'AI', TaskMonitorStatus.FINISHED, state.client.isCloudProvider(), '完成任務', am?.taskName);
                    currentState = ChatState.IDLE; // AI 明確宣告完成
                } else if (result.hasOps) {
                    currentState = ChatState.CHATTING;
                } else if (groupChatClients.length > 0 && (maxRounds === 0 || turnCount < maxRounds)) {
                    currentState = ChatState.CHATTING;
                } else {
                    currentState = ChatState.IDLE;
                }
            }
        }
        state.isGenerating = false;
        state.updateWebview();
    }
}
