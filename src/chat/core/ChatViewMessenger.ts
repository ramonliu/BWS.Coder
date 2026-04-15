import * as vscode from 'vscode';
import * as fs from 'fs';
import { ChatMessage, HistoryManager } from '../historyManager';
import { MessageRenderer } from '../messageRenderer';
import { WorkflowManager } from '../workflowManager';
import { TaskMonitor } from '../taskMonitor';
import { MultiLLMClient } from '../../llm/multi';
import { ILLMClient } from '../../llm/types';
import { MemoryPalaceManager } from '../core/MemoryPalaceManager';

export class ChatViewMessenger {
    private messageProviders: Set<(msg: any) => Thenable<boolean>> = new Set();

    constructor(postMessageProvider: (msg: any) => Thenable<boolean>) {
        this.messageProviders.add(postMessageProvider);
    }

    public addMessageProvider(provider: (msg: any) => Thenable<boolean>) {
        this.messageProviders.add(provider);
    }

    public removeMessageProvider(provider: (msg: any) => Thenable<boolean>) {
        this.messageProviders.delete(provider);
    }

    public broadcast(msg: any) {
        this.messageProviders.forEach(p => p(msg));
    }

    public updateWebview(sessionId: string, messages: ChatMessage[], isGenerating: boolean, workflowManager: WorkflowManager, client: ILLMClient, chatMode?: string) {
        this.broadcast({
            command: 'updateMessages',
            sessionId: sessionId,
            messages: messages.map(m => ({
                ...m,
                html: MessageRenderer.renderMessage(m, isGenerating)
            })),
            isGenerating: isGenerating,
            workflowSteps: workflowManager.getAllSteps(),
            availableModels: (client instanceof MultiLLMClient) ? client.getAvailableProviders() : [],
            // [2026-03-24] Feature - Propagate chatMode to allow webview mode selector to sync
            chatMode: chatMode,
            // [2026-04-16] Memory Palace - Send raw data for advanced rendering
            memoryPalace: MemoryPalaceManager.getInstance().getRawData()
        });
    }

    public sendSessions(historyManager: HistoryManager) {
        const sessions = historyManager.getSessions();
        this.broadcast({ command: 'sessionsLoaded', sessions });
    }

    public sendLLMStats(context: vscode.ExtensionContext) {
        const stats = TaskMonitor.getInstance(context).getStats();
        this.broadcast({ command: 'llmStats', stats });
    }

    public async sendMemory() {
        let content = '';
        
        // [2026-04-16] Memory Palace - Display structured memory
        const palace = MemoryPalaceManager.getInstance();
        const palaceRaw = palace.getRawData();
        const currentWing = vscode.workspace.name || 'Global';
        const wingData = palaceRaw.wings[currentWing];

        if (wingData) {
            let palaceMd = `## 🏰 Memory Palace (${currentWing})\n`;
            
            if (wingData.halls.facts.length > 0) palaceMd += `\n### 📝 Facts\n- ${wingData.halls.facts.join('\n- ')}\n`;
            if (wingData.halls.preferences.length > 0) palaceMd += `\n### ⚙️ Preferences\n- ${wingData.halls.preferences.join('\n- ')}\n`;
            if (wingData.halls.discoveries.length > 0) palaceMd += `\n### 💡 Discoveries\n- ${wingData.halls.discoveries.join('\n- ')}\n`;
            
            if (Object.keys(wingData.rooms).length > 0) {
                palaceMd += `\n### 🚪 Rooms (Topics)\n`;
                for (const [room, items] of Object.entries(wingData.rooms)) {
                    palaceMd += `\n**${room}**\n- ${items.join('\n- ')}\n`;
                }
            }
            content = palaceMd;
        }

        this.broadcast({ command: 'memoryLoaded', content: content });
    }

    public openWorkflowPanel() {
        this.broadcast({ command: 'openWorkflowPanel' });
    }
}
