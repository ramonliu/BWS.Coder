import * as vscode from 'vscode';
import { ChatExecutor } from '../ChatExecutor';
import { ChatMessage } from '../../historyManager';
import { ILLMClient } from '../../../llm/types';
import { ChatState } from '../../chatService';
import { ensureMandatoryRoles } from '../../../llm/utils';
import { t, getLang } from '../../../utils/locale';
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
        personaPrompt: string,
        actionFormatPrompt: string,
        images: string[],
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource,
        taskPrompt?: string,
        personas?: { name: string, persona: string }[]
    ) {
        let currentState = ChatState.CHATTING;
        let turnCount = 0;
        
        // [2026-03-29] [Feature-Resume] - Determine starting rotation based on history
        const resume = this.getResumeIndices(state, personas || [], (state.client as any).getActiveClients ? (state.client as any).getActiveClients() : [state.client]);
        let groupChatIndex = resume.groupChatIndex;
        let personaIndex = resume.personaIndex; 

        // [2026-03-29] [Workflow-ModularPrompt] - Use modular assembly logic
        let basePromptMessages: { role: any, content: string }[] = [];
        const unifiedSystemPrompt = this.getUnifiedSystemPrompt(personaPrompt, actionFormatPrompt, taskPrompt);
        basePromptMessages.push({ role: 'system', content: unifiedSystemPrompt });

        let allClients = (state.client as any).getActiveClients ? (state.client as any).getActiveClients() : [state.client];
        const availability = await Promise.all(allClients.map(async (c: any) => ({
            client: c,
            exhausted: await c.isExhausted()
        })));
        let groupChatClients = availability.filter(a => !a.exhausted).map(a => a.client);

        if ((!personas || personas.length === 0) && groupChatClients.length <= 1) {
            const lang = getLang();
            const exhaustedNames = availability.filter(a => a.exhausted).map(a => (a.client as any).getProviderName ? (a.client as any).getProviderName() : 'AI');
            let notice = t(lang, 'msg_groupSingleModeNotice');
            if (exhaustedNames.length > 0) notice += t(lang, 'msg_groupExhaustedNotice', exhaustedNames.join(', '));
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
            state.messages.push({ id: state.generateId(), role: 'system', content: t(getLang(), 'msg_groupChatStarted', participantList), timestamp: new Date() });
        }
        state.updateWebview();

        try {
            while (currentState !== ChatState.IDLE && !globalCts?.token.isCancellationRequested) {
                turnCount++;

                if (currentState === ChatState.CHATTING) {
                    // 1. Assign weights and prune for LLM context
                    MemoryManager.assignWeights(state.messages);
                    const prunedMessages = MemoryManager.prune(state.messages);

                    let providerId: string | undefined = undefined;
                    let providerName = undefined;
                    let groupPromptAddon = '';

                    if (groupChatClients.length > 0) {
                        // [2026-03-27] [Feature-GroupPersona] Use AI-generated persona if available
                        // If personas exist, they dictate the number of speakers and the rotation. The underlying providers just power them.
                        if (personas && personas.length > 0) {
                            const currentPersona = personas[personaIndex];
                            providerName = currentPersona.name; // Display name in UI
                            const lang = getLang();
                            groupPromptAddon = t(lang, 'msg_groupPersonaRolePrompt', currentPersona.name, currentPersona.persona);
                            personaIndex = (personaIndex + 1) % personas.length;
                            
                            // [2026-03-29] [Fix-Fallback-Logic] - Use IDs instead of concrete clients
                            providerId = groupChatClients[groupChatIndex].getProviderId();
                            groupChatIndex = (groupChatIndex + 1) % groupChatClients.length;
                        } else {
                            // Fallback to legacy behavior: rotate through providers
                            const client = groupChatClients[groupChatIndex];
                            providerId = client.getProviderId();
                            providerName = client.getProviderName();
                            groupPromptAddon = t(getLang(), 'msg_groupProviderRolePrompt', providerName);
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
                        personaPrompt,
                        {} as any,
                        state.messages
                    );
                    
                    // // [2026-03-29] [Fix-UI-Hang] - Ensure state is reset even on API failure
                    // // [2026-03-29] [Fix-Fallback-Logic] - Use state.client (MultiLLMClient) with providerId target
                    const result = await this.executeAITurn(state, state.client, finalPromptMessages, images, globalCts, streamCts, providerId, providerName, descriptiveTaskName, task);

                    // 2. Log full state to DebugDB for audit trail (async)
                    const db = DebugDB.getInstance(this.context);
                    state.messages.forEach(m => db.logMessageState(m, turnCount));

                    const isDone = result.content.includes('[@@DONE@@]') || result.content.includes('[DONE]');

                    // [2026-03-27] User Preference: 0 means unlimited rounds
                    const configMaxRounds = vscode.workspace.getConfiguration('bwsCoder').get<number>('groupChatMaxRounds');
                    const maxRounds = configMaxRounds !== undefined ? configMaxRounds : 30;

                    if (isDone && !result.hasOps) {
                        const am = task.assistantMessage;
                        const lang = getLang();
                        TaskMonitor.getInstance(this.context).updateStatus(state.client.getProviderId(), am?.providerName || 'AI', TaskMonitorStatus.FINISHED, state.client.isCloudProvider(), t(lang, 'msg_completedTask'), am?.taskName);
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
        } finally {
            state.isGenerating = false;
            state.updateWebview();
        }
    }

    // [2026-03-29] [Feature-Resume] - Scan history to find the next speaker in rotation
    private getResumeIndices(state: any, personas: { name: string, persona: string }[], clients: any[]) {
        const lastAI = [...state.messages].reverse().find(m => m.role === 'assistant');
        if (!lastAI) return { personaIndex: 0, groupChatIndex: 0 };

        const lastSpeaker = lastAI.taskName || lastAI.providerName || '';
        let pIdx = 0;
        let gIdx = 0;

        if (personas.length > 0) {
            const lastPIdx = personas.findIndex(p => lastSpeaker.includes(p.name));
            if (lastPIdx !== -1) pIdx = (lastPIdx + 1) % personas.length;
        }

        // Advance groupChatIndex based on the provider name if possible
        if (clients.length > 0) {
            const lastProv = lastAI.providerName || '';
            const lastGIdx = clients.findIndex((c: any) => lastProv.includes(c.getProviderName()));
            if (lastGIdx !== -1) gIdx = (lastGIdx + 1) % clients.length;
        }

        return { personaIndex: pIdx, groupChatIndex: gIdx };
    }
}
