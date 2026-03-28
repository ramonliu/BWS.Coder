import * as vscode from 'vscode';
import * as fs from 'fs';
import { ChatMessage, HistoryManager } from '../historyManager';
import { MessageRenderer } from '../messageRenderer';
import { WorkflowManager } from '../workflowManager';
import { TaskMonitor } from '../taskMonitor';
import { MultiLLMClient } from '../../llm/multi';
import { ILLMClient } from '../../llm/types';

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
            chatMode: chatMode
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

    public async sendMemory(memoryPath: string) {
        if (fs.existsSync(memoryPath)) {
            const memoryContent = fs.readFileSync(memoryPath, 'utf8');
            this.broadcast({ command: 'memoryLoaded', content: memoryContent });
        } else {
            this.broadcast({ command: 'memoryLoaded', content: '' });
        }
    }

    public openWorkflowPanel() {
        this.broadcast({ command: 'openWorkflowPanel' });
    }
}
