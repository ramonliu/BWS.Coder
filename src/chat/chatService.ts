import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ILLMClient } from '../llm/types';
import { LLMFactory } from '../llm/factory';
import { HistoryManager, ChatMessage, Attachment } from './historyManager';
import { WorkflowManager } from './workflowManager';
import { TaskMonitor } from './taskMonitor';
import { ChatViewMessenger } from './core/ChatViewMessenger';
import { ChatMessageHandler } from './core/ChatMessageHandler';
import { ChatRunner } from './core/ChatRunner';
import { MemoryPalaceManager } from './core/MemoryPalaceManager';

export enum ChatState {
    INITIAL = 'INITIAL',
    CHATTING = 'CHATTING',
    EXECUTING = 'EXECUTING',
    REPORTING = 'REPORTING',
    IDLE = 'IDLE'
}

export class ChatService implements vscode.Disposable {
    public currentSessionId: string;
    public messages: ChatMessage[] = [];
    public client: ILLMClient;
    public historyManager: HistoryManager;
    public workflowManager: WorkflowManager;
    public isGenerating: boolean = false;
    public globalCts: vscode.CancellationTokenSource | undefined;
    public streamCts: vscode.CancellationTokenSource | undefined;
    // [2026-03-24] Feature - Track current chat mode for session restore
    public currentChatMode: string = 'Single';
    
    public context: vscode.ExtensionContext;
    private messenger: ChatViewMessenger;
    private messageHandler: ChatMessageHandler;
    private runner: ChatRunner;

    // Per-file write lock: prevents parallel workflow steps overwriting each other
    private fileLocks = new Map<string, Promise<void>>();

    public async acquireFileLock(filePath: string): Promise<() => void> {
        const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
        const prevLock = this.fileLocks.get(normalizedPath) ?? Promise.resolve();
        let release!: () => void;
        const myLock = new Promise<void>(resolve => { release = resolve; });
        this.fileLocks.set(normalizedPath, prevLock.then(() => myLock));
        await prevLock;
        return release;
    }

    constructor(context: vscode.ExtensionContext, postMessageProvider: (msg: any) => Thenable<boolean>) {
        this.context = context;
        this.client = LLMFactory.getClient(context);
        this.historyManager = new HistoryManager(context);
        this.workflowManager = new WorkflowManager(context);
        this.currentSessionId = this.generateId();
        this.initPaths(context);

        this.messenger = new ChatViewMessenger(postMessageProvider);
        this.runner = new ChatRunner(context);
        this.messageHandler = new ChatMessageHandler(context, this.historyManager, this.workflowManager, this.messenger, this.runner);
        
        TaskMonitor.getInstance(context); // Initialize persistence
        MemoryPalaceManager.getInstance(context); // Initialize structured memory
    }

    private initPaths(context: vscode.ExtensionContext) {
        const storageUri = context.storageUri || context.globalStorageUri;
        const storageDir = storageUri.fsPath;
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    }

    public generateId() { return Math.random().toString(36).substring(2, 11); }

    public addMessageProvider(provider: (msg: any) => Thenable<boolean>) { this.messenger.addMessageProvider(provider); }
    public removeMessageProvider(provider: (msg: any) => Thenable<boolean>) { this.messenger.removeMessageProvider(provider); }
    public broadcast(msg: any) { this.messenger.broadcast(msg); }
    public updateWebview() { this.messenger.updateWebview(this.currentSessionId, this.messages, this.isGenerating, this.workflowManager, this.client, this.currentChatMode, this.calculateContextSize()); }
    public sendSessions() { this.messenger.sendSessions(this.historyManager); }
    public sendLLMStats() { this.messenger.sendLLMStats(this.context); }
    public async sendMemory() { await this.messenger.sendMemory(); }

    public loadSession(id: string) {
        if (this.isGenerating && this.globalCts) this.globalCts.cancel();
        this.currentSessionId = id;
        const session = this.historyManager.getSession(id);
        this.messages = session?.messages || [];
        // [2026-03-24] Feature - Restore chat mode from session
        if (session?.chatMode) this.currentChatMode = session.chatMode;
        this.updateWebview();
    }

    public async deleteSession(sessionId: string) {
        const success = await this.historyManager.deleteSession(sessionId);
        if (success) {
            if (this.currentSessionId === sessionId) {
                this.messages = [];
                this.currentSessionId = this.generateId();
                this.updateWebview();
            }
            this.sendSessions();
        }
    }

    public async applyCodeToEditor(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            await editor.edit(editBuilder => { editBuilder.replace(selection, code); });
            await vscode.commands.executeCommand('editor.action.formatDocument');
        } else {
            const lang = require('../utils/locale').getLang();
            const t = require('../utils/locale').t;
            vscode.window.showInformationMessage(t(lang, 'err_noActiveEditor'));
        }
    }

    public async openImageHTML(data: string) {
        const lang = require('../utils/locale').getLang();
        const t = require('../utils/locale').t;
        const panel = vscode.window.createWebviewPanel('imageViewer', t(lang, 'ui_imageViewer'), { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, { enableScripts: true, localResourceRoots: [vscode.Uri.file(this.context.extensionPath)] });
        panel.webview.html = `<html><body style="background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><img src="${data}" style="max-width:100%;max-height:100%;cursor:zoom-out" onclick="window.close()"></body></html>`;
        await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
        // [2026-03-28] [FIX_COMPACT_MODE] - Enable compact mode for auxiliary image viewer window
        await vscode.commands.executeCommand('workbench.action.enableCompactAuxiliaryWindow');
    }

    public async uploadFile() {
        // [2026-03-30] [Universal Localization] - Localized Upload Dialog
        const lang = require('../utils/locale').getLang();
        const t = require('../utils/locale').t;
        
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: t(lang, 'ui_uploadFile'),
            filters: {
                [t(lang, 'ui_images')]: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
                [t(lang, 'ui_allFiles')]: ['*']
            }
        });

        if (uris && uris.length > 0) {
            for (const uri of uris) {
                const ext = path.extname(uri.fsPath).slice(1);
                const isImage = !!ext.match(/(png|jpg|jpeg|gif|webp)/i);
                
                let content = '';
                let type: 'image' | 'file' = 'file';

                try {
                    if (isImage) {
                        const data = await fs.promises.readFile(uri.fsPath);
                        const mime = ext === 'jpg' ? 'image/jpeg' : (ext === 'png' ? 'image/png' : `image/${ext}`);
                        const base64 = data.toString('base64');
                        content = `data:${mime};base64,${base64}`;
                        type = 'image';
                    } else {
                        // [2026-04-17] File Support - Read non-image files as UTF-8 text
                        content = await fs.promises.readFile(uri.fsPath, 'utf8');
                        type = 'file';
                    }

                    const attachment: Attachment = {
                        type,
                        name: path.basename(uri.fsPath),
                        content
                    };
                    this.messenger.broadcast({ command: 'fileLoaded', attachment });
                } catch (err) {
                    console.error('[ChatService] Failed to read file:', err);
                    const lang = require('../utils/locale').getLang();
                    const t = require('../utils/locale').t;
                    vscode.window.showErrorMessage(`${t(lang, 'err_fileRead')}: ${path.basename(uri.fsPath)}`);
                }
            }
        }
    }

    public async resuscitate(providerId: string) {
        const exhaustedKeys = this.context.globalState.get<{ [key: string]: number }>('exhaustedApiKeys', {});
        let changed = false;
        for (const key in exhaustedKeys) { delete exhaustedKeys[key]; changed = true; }
        if (changed) await this.context.globalState.update('exhaustedApiKeys', exhaustedKeys);
        TaskMonitor.getInstance(this.context).forceReset(providerId);
        this.sendLLMStats();
        const lang = require('../utils/locale').getLang();
        const t = require('../utils/locale').t;
        vscode.window.showInformationMessage(t(lang, 'msg_resuscitateSuccess'));
    }

    public async handleMessage(message: any): Promise<void> {
        await this.messageHandler.handleMessage(message, this);
    }

    public async handleUserMessage(text: string, attachments?: Attachment[]): Promise<void> {
        await this.messageHandler.handleUserMessage(text, this, attachments);
    }

    public calculateContextSize(): number {
        // [2026-04-17] Context Monitor - Sum all message contents
        let totalChars = 0;
        this.messages.forEach(m => {
            totalChars += (m.content || '').length;
            if (m.thinking) totalChars += m.thinking.length;
            // [2026-04-17] Context Estimate - Add overhead for image attachments (approx 1000 tokens each)
            if (m.attachments) {
                m.attachments.forEach(a => {
                    if (a.type === 'image') totalChars += 4000;
                });
            }
        });

        // [2026-04-17] Context Monitor - Add dynamic overhead
        totalChars += this.calculateSystemOverhead();

        // Add memory palace size if available
        try {
            const memory = MemoryPalaceManager.getInstance().getRawData();
            const currentWing = vscode.workspace.name || 'Global';
            const wingData = memory.wings[currentWing];
            if (wingData) {
                totalChars += JSON.stringify(wingData).length;
            }
        } catch (e) {}

        return totalChars;
    }

    private calculateSystemOverhead(): number {
        let overhead = 500; // Base identity & capabilities (identity chars + coreCapability chars)
        
        try {
            // 1. Core Prompt Files
            const personaPath = path.join(this.context.extensionPath, 'prompts', 'Personalization.md');
            const formatPath = path.join(this.context.extensionPath, 'prompts', 'ActionFormat.md');
            
            if (fs.existsSync(personaPath)) overhead += fs.statSync(personaPath).size;
            if (fs.existsSync(formatPath)) overhead += fs.statSync(formatPath).size;

            // 2. Workspace Context
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                
                // task_plan.md & findings.md
                const planPath = path.join(workspacePath, 'task_plan.md');
                const findingsPath = path.join(workspacePath, 'findings.md');
                const errorPath = path.join(workspacePath, 'ERROR.md');

                if (fs.existsSync(planPath)) overhead += fs.statSync(planPath).size;
                if (fs.existsSync(findingsPath)) overhead += fs.statSync(findingsPath).size;
                if (fs.existsSync(errorPath)) overhead += fs.statSync(errorPath).size;
                
                // [2026-03-25] [Planning-Notification-Wrap] - Add the notification wrapper overhead (~500 chars)
                overhead += 500;
            }
        } catch (e) {
            console.error('[ChatService] Error calculating overhead:', e);
            return 2000; // Fallback to safe estimate
        }

        return overhead;
    }

    public dispose() {
        if (this.globalCts) this.globalCts.dispose();
        if (this.streamCts) this.streamCts.dispose();
    }
}
