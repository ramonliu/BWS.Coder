import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatMessage, Attachment, HistoryManager } from '../historyManager';
import { WorkflowManager } from '../workflowManager';
import { PromptBuilder } from '../../utils/prompts';
import { t } from '../../utils/locale';
import { PlanningHandler } from '../skills/planningHandler';
import { ChatRunner } from './ChatRunner';
import { ChatViewMessenger } from './ChatViewMessenger';
import { ILLMClient } from '../../llm/types';
import { TaskMonitor } from '../taskMonitor';

export class ChatMessageHandler {
    constructor(
        private context: vscode.ExtensionContext,
        private historyManager: HistoryManager,
        private workflowManager: WorkflowManager,
        private messenger: ChatViewMessenger,
        private runner: ChatRunner,
        private memoryPath: string
    ) { }

    public async handleMessage(message: any, service: any): Promise<void> {
        switch (message.command) {
            case 'send': await this.handleUserMessage(message.text, service, message.attachments, message.chatMode); break;
            case 'stop': if (service.globalCts) service.globalCts.cancel(); if (service.streamCts) service.streamCts.cancel(); service.isGenerating = false; service.updateWebview(); break;
            case 'clear': service.messages = []; service.currentSessionId = service.generateId(); this.historyManager.saveSession(service.currentSessionId, service.messages); service.updateWebview(); break;
            case 'copy': await vscode.env.clipboard.writeText(message.text); break;
            case 'applyCode': await service.applyCodeToEditor(message.code); break;
            case 'getSessions': this.messenger.sendSessions(this.historyManager); break;
            case 'loadSession': service.loadSession(message.sessionId); break;
            case 'deleteSession': await service.deleteSession(message.sessionId); break;
            case 'saveWorkflow': this.workflowManager.save(message.steps); service.updateWebview(); break;
            case 'aiPlanWorkflow': await this.handleAIPlanWorkflow(message.text, service); break;
            case 'getLLMStats': this.messenger.sendLLMStats(this.context); break;
            case 'resuscitate': service.resuscitate(message.providerId); break;
            case 'popOutDashboard': vscode.commands.executeCommand('bwsCoder.popOutDashboard'); break;
            // [2026-03-26] UX Fix - Synchronize chat mode from webview to extension to prevent reset on 'clear'
            case 'setChatMode': service.currentChatMode = message.mode; break;
            // [2026-03-28] [FIX_IMAGE_HANDLING] - Added openImage and uploadFile cases to command switch
            case 'openImage': await service.openImageHTML(message.data); break;
            case 'uploadFile': await service.uploadFile(); break;
        }
    }

    public async handleUserMessage(text: string, service: any, attachments?: Attachment[], chatMode?: string): Promise<void> {
        if (service.isGenerating) {
            if (service.globalCts) service.globalCts.cancel();
            if (service.streamCts) service.streamCts.cancel();
            await new Promise(r => setTimeout(r, 200));
        }

        const config = vscode.workspace.getConfiguration('bwsCoder');
        const outputLang = config.get<string>('language') as any || 'zh-TW';

        // [2026-03-25] Prompt Optimization - Load base system prompt from external MD file
        let basePrompt: string | undefined;
        try {
            const promptPath = path.join(this.context.extensionPath, 'prompts', 'chat_system.md');
            if (fs.existsSync(promptPath)) {
                basePrompt = fs.readFileSync(promptPath, 'utf8');
            }
        } catch (err) {
            console.error('[BWS Coder] Failed to read system prompt file:', err);
        }

        const systemPrompt = PromptBuilder.getChatSystemPrompt(outputLang, basePrompt);
        const workspaceFolders = vscode.workspace.workspaceFolders;

        const images: string[] = [];
        if (attachments) {
            attachments.forEach(a => {
                if (a.type === 'image') images.push(a.content.split(',')[1] || a.content);
            });
        }

        // [2026-03-25] Prompt Optimization - Structured Dynamic Context
        let projectContext = '';
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;

            // 1. Project Memory
            if (fs.existsSync(this.memoryPath)) {
                const memoryContent = fs.readFileSync(this.memoryPath, 'utf8');
                if (memoryContent.trim()) {
                    projectContext += `\n--- [PROJ_CONTEXT: MEMORY] ---\n${memoryContent}\n`;
                }
            }

            // 2. ERROR.md (Lessons Learned)
            const errorMdPath = path.join(workspacePath, 'ERROR.md');
            if (fs.existsSync(errorMdPath)) {
                const errorContent = fs.readFileSync(errorMdPath, 'utf8');
                if (errorContent.trim()) {
                    projectContext += `\n--- [PROJ_CONTEXT: LESSONS_LEARNED (ERROR.md)] ---\n${errorContent}\n`;
                }
            }

            // 3. Dynamic Planning Context (task_plan.md, findings.md)
            projectContext += PlanningHandler.getDynamicContext(workspacePath);

            // [2026-03-28] [Task-AntiHallucination] - Inject project 2-level structure to prevent hallucination
            const structure = this.getWorkspaceStructure(workspacePath, 0, 2);
            if (structure) {
                projectContext += `\n--- [PROJ_CONTEXT: WORKSPACE_STRUCTURE (Level 2)] ---\n${structure}\n`;
            }
        }

        let finalSystemPrompt = projectContext ? `${systemPrompt}\n\n[DYNAMIC_PROJECT_CONTEXT]\n${projectContext}` : systemPrompt;

        let content = text;
        if (attachments) {
            attachments.forEach(a => {
                if (a.type === 'file') content += `\n\n[附件檔案: ${a.name}]\n\`\`\`\n${a.content}\n\`\`\``;
            });
        }

        const skillRegex = /(?:使用|指令)\s*@([a-zA-Z0-9_-]+)\s*做?/g;
        let match;
        const requestedSkills: string[] = [];
        while ((match = skillRegex.exec(content)) !== null) requestedSkills.push(match[1].toLowerCase());

        if (requestedSkills.length > 0) {
            const skillContents: string[] = [];
            const skillDirs = [path.join(__dirname, '..', '..', '..', 'skills'), workspaceFolders ? path.join(workspaceFolders[0].uri.fsPath, '.bws', 'skills') : ''];
            for (const dir of skillDirs) {
                if (!dir || !fs.existsSync(dir)) continue;
                try {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const skillName = file.replace(/.md$/i, '').toLowerCase();
                        if (file.toLowerCase().endsWith('.md') && requestedSkills.includes(skillName)) {
                            const fileContent = fs.readFileSync(path.join(dir, file), 'utf-8');
                            const skillHeader = `--- Skill: ${file} ---`;
                            if (!skillContents.some(c => c.startsWith(skillHeader))) {
                                skillContents.push(`${skillHeader}\n${fileContent}`);
                            }
                        }
                    }
                } catch (e) { console.error(`Error reading skill directory ${dir}:`, e); }
            }
            if (skillContents.length > 0) {
                finalSystemPrompt += `\n\n[DYN_SKILLS_CONTEXT]\n${skillContents.join('\n\n')}\n`;
            }
        }

        // Auto-initialize planning files
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const planPath = path.join(workspacePath, 'task_plan.md');
            if (!fs.existsSync(planPath)) {
                PlanningHandler.handlePlanCommand(workspacePath, () => service.generateId(), outputLang);
                const autoInitMsg: ChatMessage = {
                    id: service.generateId(),
                    role: 'system',
                    content: `${t(outputLang, 'planningAutoInitTitle')}\n\n${t(outputLang, 'planningAutoInitBody')}`,
                    timestamp: new Date()
                };
                service.messages.push(autoInitMsg);
                service.updateWebview();
            }
        }

        const trimmedText = text.trim();
        const needsAIPlan = trimmedText.startsWith('/plan') || text.includes('請幫實現工作流');

        // [2026-03-27] [Feature-Export] - Intercept /export command
        if (trimmedText.startsWith('/export')) {
            await this.handleExportChat(service);
            return;
        }

        if (needsAIPlan) {
            let planText = text;
            if (trimmedText.startsWith('/plan')) {
                planText = trimmedText.substring(5).trim();
            }

            // [2026-03-27] Auto-switch toolbar to Workflow mode when /plan is triggered
            service.currentChatMode = 'Workflow';
            service.updateWebview();

            await this.handleAIPlanWorkflow(planText || text, service);
            return;
        }

        let actualTextToRun = text;
        if (trimmedText === '/handover') {
            const workspacePath = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
            actualTextToRun = PlanningHandler.getHandoverPrompt(workspacePath);
        }

        // [2026-03-24] Bugfix: Update the backend's currentChatMode BEFORE we start broadcasting events.
        // If we don't, updateWebview() will broadcast the old default mode ("Single") while streaming is starting/running,
        // causing the frontend UI toggle to jump back and forth.
        if (chatMode) {
            service.currentChatMode = chatMode;
        }

        const startUserMsg: ChatMessage = { id: service.generateId(), role: 'user', content: content, timestamp: new Date(), attachments };
        service.messages.push(startUserMsg);
        service.isGenerating = true;
        service.updateWebview();

        service.globalCts = new vscode.CancellationTokenSource();
        service.streamCts = new vscode.CancellationTokenSource();

        const isGroupCmd = actualTextToRun.trim().startsWith('/group') || actualTextToRun.trim().startsWith('/debate');
        const workflowSteps = this.workflowManager.getAllSteps();

        const commonState = {
            messages: service.messages,
            client: service.client,
            get isGenerating() { return service.isGenerating; },
            set isGenerating(v: boolean) { service.isGenerating = v; },
            generateId: () => service.generateId(),
            updateWebview: (force?: boolean) => {
                if (force === true) service.updateWebview();
                else service.updateWebview();
            },
            broadcast: (msg: any) => this.messenger.broadcast(msg),
            acquireFileLock: (path: string) => service.acquireFileLock(path),
            setStreamCts: (cts: vscode.CancellationTokenSource) => { service.streamCts = cts; }
        };

        const initialTaskPrompt = (actualTextToRun && actualTextToRun.trim()) ? actualTextToRun.trim() : '';

        // 模式判定邏輯: '/group' 指令優先權最高，其次為選定的模式，若無則依狀態判定
        let effectiveMode = chatMode || (workflowSteps.length > 0 ? 'Workflow' : 'Single');
        if (isGroupCmd) {
            effectiveMode = 'Group';
        }

        // [2026-03-27] Auto-switch toolbar to match the effective mode resulting from slash commands
        if (service.currentChatMode !== effectiveMode) {
            service.currentChatMode = effectiveMode;
            service.updateWebview();
        }

        if (effectiveMode === 'Group' || isGroupCmd) {
            // [2026-03-27] [Feature-GroupPersona] - Auto-generate personas based on the topic
            let personas = undefined;
            const topicMatch = actualTextToRun.trim().match(/^\/(group|debate)\s*(.*)/i);
            const topic = topicMatch ? topicMatch[2].trim() : '';

            if (!topic) {
                vscode.window.showWarningMessage('請在 /group 或 /debate 後面加上討論主題。例如：/group AI是否會取代人類工作');
                service.isGenerating = false;
                service.updateWebview();
                return;
            }

            // [2026-03-28] [CLEAR_DASHBOARD_CARDS] - Clear existing task cards when starting a group chat Discussion
            TaskMonitor.getInstance().clearAll();
            personas = await this.handleAIGroupPlan(topic, service, outputLang);
            await this.runner.runSerialStrategy(commonState, finalSystemPrompt, images, true, service.globalCts, service.streamCts, initialTaskPrompt, personas);
        } else if (effectiveMode === 'Workflow') {
            if (workflowSteps.length > 0) {
                await this.runner.runWorkflowStrategy(commonState, finalSystemPrompt, images, workflowSteps, actualTextToRun, service.globalCts, service.streamCts);
            } else {
                // Workflow tab 已選但步驟為空，提示使用者
                const warnMsg = { id: service.generateId(), role: 'system' as const, content: '[Workflow] 尚未設定任何步驟，或所有步驟已停用。請在 Workflow 面板中新增步驟並儲存。', timestamp: new Date() };
                service.messages.push(warnMsg);
                service.isGenerating = false;
                service.updateWebview();
                return;
            }
        } else if (effectiveMode === 'Concurrent') { // 新增對並行模式的支援 (對應 structure.md)
            await this.runner.runConcurrentStrategy(commonState, finalSystemPrompt, images, service.globalCts, service.streamCts, initialTaskPrompt);
        } else {
            await this.runner.runSerialStrategy(commonState, finalSystemPrompt, images, false, service.globalCts, service.streamCts, initialTaskPrompt);
        }

        service.isGenerating = false;
        // [2026-03-24] Feature - Persist chatMode into the session so it can be restored on load
        this.historyManager.saveSession(service.currentSessionId, service.messages, service.currentChatMode);
        service.updateWebview();
    }

    // [2026-03-27] [Feature-Export] - Export chat history to markdown, xml, txt, or html
    private async handleExportChat(service: any): Promise<void> {
        const uri = await vscode.window.showSaveDialog({
            title: '匯出對話紀錄',
            filters: {
                'HTML (網頁版視覺)': ['html'],
                'Markdown (適合筆記)': ['md'],
                'Plain Text (純文字)': ['txt'],
                'XML (程式讀取)': ['xml']
            },
            defaultUri: vscode.Uri.file(`BWS_Coder_Chat_${new Date().toISOString().replace(/[:.]/g, '')}.html`)
        });

        if (!uri) return; // User canceled

        const ext = uri.fsPath.split('.').pop()?.toLowerCase();
        let exportContent = '';

        const messages = service.messages.filter((m: any) => m.role !== 'system' && !m.content.startsWith('⏳') && !m.content.startsWith('✅ **AI 已生成'));

        // Helper to strip file op tags
        const stripTags = (text: string) => text.replace(/\[@@\s*(create|write|modify|replace|delete|execute|read):.*?@@\]\r?\n?/g, '').replace(/\[@@\s*eof\s*@@\]\r?\n?/g, '');
        // Helper to escape HTML tags to display raw markdown text safely
        const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        // Helper to safely get Date object
        const getAsDate = (ts: any) => ts instanceof Date ? ts : new Date(ts);

        if (ext === 'html') {
            const css = `
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #1e1e1e; color: #cccccc; margin: 0; padding: 20px; }
                .chat-container { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
                .message { display: flex; flex-direction: column; max-width: 85%; }
                .message.user { align-self: flex-end; }
                .message.ai { align-self: flex-start; }
                .header { font-size: 0.85em; margin-bottom: 4px; color: #aaaaaa; }
                .message.user .header { text-align: right; }
                .bubble { padding: 12px 16px; border-radius: 8px; line-height: 1.5; font-size: 14px; word-wrap: break-word; }
                .message.user .bubble { background-color: #007acc; color: #ffffff; border-bottom-right-radius: 0; }
                .message.ai .bubble { background-color: #2d2d2d; color: #cccccc; border-bottom-left-radius: 0; border: 1px solid #444; }
                code { background-color: rgba(255, 255, 255, 0.1); padding: 2px 4px; border-radius: 4px; font-family: Consolas, "Courier New", monospace; }
                pre { background-color: #1a1a1a; padding: 12px; border-radius: 6px; overflow-x: auto; border: 1px solid #333; }
                pre code { background-color: transparent; padding: 0; }
                .title { text-align: center; color: #fff; margin-bottom: 30px; }
            `;
            exportContent = `<!DOCTYPE html>\n<html lang="zh-TW">\n<head>\n<meta charset="UTF-8">\n<title>BWS.Coder 對話紀錄</title>\n<style>${css}</style>\n</head>\n<body>\n`;
            exportContent += `<div class="chat-container">\n<h2 class="title">BWS.Coder 討論紀錄</h2>\n`;
            for (const msg of messages) {
                const roleName = msg.role === 'user' ? 'User' : (msg.providerName || 'AI');
                const time = getAsDate(msg.timestamp).toLocaleTimeString();

                // For HTML we do basic markdown parsing for code blocks and bold text to make it look decent
                let htmlText = escapeHtml(stripTags(msg.content));
                htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                // Basic code block support
                htmlText = htmlText.replace(/```[a-z]*<br\/>([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

                exportContent += `<div class="message ${msg.role === 'user' ? 'user' : 'ai'}">\n`;
                exportContent += `  <div class="header"><strong>${roleName}</strong> • ${time}</div>\n`;
                exportContent += `  <div class="bubble">${htmlText}</div>\n`;
                exportContent += `</div>\n`;
            }
            exportContent += `</div>\n</body>\n</html>`;
        } else if (ext === 'xml') {
            exportContent = '<?xml version="1.0" encoding="UTF-8"?>\n<chat_history>\n';
            for (const msg of messages) {
                const roleName = msg.role === 'user' ? 'User' : (msg.providerName || 'AI');
                exportContent += `  <message role="${msg.role}" name="${roleName}" timestamp="${getAsDate(msg.timestamp).toISOString()}">\n`;
                // Escape XML entities
                const safeContent = stripTags(msg.content).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                exportContent += `    ${safeContent}\n  </message>\n`;
            }
            exportContent += '</chat_history>';
        } else if (ext === 'txt') {
            for (const msg of messages) {
                const roleName = msg.role === 'user' ? 'User' : (msg.providerName || 'AI');
                exportContent += `[${roleName} | ${getAsDate(msg.timestamp).toLocaleString()}]\n`;
                exportContent += `${stripTags(msg.content).trim()}\n\n`;
                exportContent += `--------------------------------------------------\n\n`;
            }
        } else {
            // Default: Markdown (.md)
            exportContent = `# BWS.Coder 對話紀錄\n\n匯出時間：${new Date().toLocaleString()}\n\n---\n\n`;
            for (const msg of messages) {
                const roleName = msg.role === 'user' ? 'User' : (msg.providerName || 'AI');
                exportContent += `### 👤 **${roleName}** _(${getAsDate(msg.timestamp).toLocaleString()})_\n\n`;
                // For markdown, we keep the code but just clean up the raw tags so it looks nice
                let cleanMd = msg.content
                    .replace(/\[@@\s*(create|write|modify|replace):\s*(.*?)@@\]\r?\n?/g, '\n**建立/修改檔案：`$2`**\n```\n')
                    .replace(/\[@@\s*execute:\s*(.*?)@@\]\r?\n?/g, '\n**執行指令：** `$1`\n')
                    .replace(/\[@@\s*delete:\s*(.*?)@@\]\r?\n?/g, '\n**刪除檔案：** `$1`\n')
                    .replace(/\[@@\s*read:\s*(.*?)@@\]\r?\n?/g, '\n**讀取檔案：** `$1`\n')
                    .replace(/\[@@\s*eof\s*@@\]\r?\n?/g, '\n```\n');
                exportContent += `${cleanMd.trim()}\n\n---\n\n`;
            }
        }

        try {
            const fs = require('fs');
            fs.writeFileSync(uri.fsPath, exportContent, 'utf-8');

            const successMsg: ChatMessage = {
                id: service.generateId(),
                role: 'system',
                content: `✅ **對話紀錄已成功匯出！**\n檔案已儲存至：\`${uri.fsPath}\``,
                timestamp: new Date()
            };
            service.messages.push(successMsg);
            service.updateWebview();
        } catch (e) {
            vscode.window.showErrorMessage(`匯出失敗: ${e}`);
        }
    }

    // [2026-03-27] [Feature-GroupPersona] - Generates distinct discussion personas for a given topic
    private async handleAIGroupPlan(topic: string, service: any, outputLang: any): Promise<{ name: string, persona: string }[] | undefined> {
        const pendingMsg: ChatMessage = {
            id: service.generateId(),
            role: 'system',
            content: '⏳ **AI 討論角色安排中...** 正在根據題目生成不同觀點的參與者，請稍候。',
            timestamp: new Date()
        };
        service.messages.push(pendingMsg);
        service.isGenerating = true;
        service.updateWebview();

        const planPrompt = PromptBuilder.getGroupPersonaPlanningPrompt(outputLang);

        try {
            const planMessages = [
                { role: 'system', content: planPrompt },
                { role: 'user', content: `請為以下主題生成討論角色：\n${topic}` }
            ];

            const stream = service.client.chat(planMessages, undefined, undefined, undefined, undefined, undefined, undefined, 'Group Persona Planning');
            let fullResponse = '';
            for await (const chunk of stream) {
                if (chunk.content) fullResponse += chunk.content;
            }

            let jsonStr = fullResponse.trim();
            if (jsonStr.includes('```')) {
                const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match) jsonStr = match[1];
            }

            const personas = JSON.parse(jsonStr);
            if (Array.isArray(personas) && personas.length > 0) {
                // Update the pending message to success statement
                pendingMsg.content = `✅ **AI 已生成 ${personas.length} 個討論角色**\n\n` +
                    personas.map((p: any) => `- **${p.name}**: ${p.persona.substring(0, 30)}...`).join('\n');
                service.updateWebview();
                return personas;
            }
        } catch (e) {
            console.error('[Group Persona Plan Error]', e);
            pendingMsg.content = `⚠️ **角色安排失敗**，將退回預設群聊模式。（錯誤：${e}）`;
            service.updateWebview();
        }
        return undefined;
    }

    private async handleAIPlanWorkflow(text: string, service: any): Promise<void> {
        // [2026-03-28] [CLEAR_DASHBOARD_CARDS] - Clear existing task cards before starting a new workflow plan
        TaskMonitor.getInstance().clearAll();

        if (!text || text.trim() === '') {
            vscode.window.showWarningMessage('請在對話框輸入您的需求，再進行 AI 規劃。');
            return;
        }

        // [2026-03-27] [Fix-PlanUX] - Immediately push a status message so users know the command was received
        const pendingMsg: ChatMessage = {
            id: service.generateId(),
            role: 'system',
            content: '⏳ **AI 工作流規劃中...** 正在分析您的需求並生成步驟，請稍候。',
            timestamp: new Date()
        };
        service.messages.push(pendingMsg);
        service.isGenerating = true;
        service.updateWebview();

        const config = vscode.workspace.getConfiguration('bwsCoder');
        const outputLang = config.get<string>('language') as any || 'zh-TW';
        const planPrompt = PromptBuilder.getWorkflowPlanningPrompt(outputLang);

        try {
            const planMessages = [
                { role: 'system', content: planPrompt },
                { role: 'user', content: `針對以下需求進行工作流規劃：\n${text}` }
            ];

            const stream = service.client.chat(planMessages, undefined, undefined, undefined, undefined, undefined, undefined, 'Workflow Planning');
            let fullResponse = '';
            for await (const chunk of stream) {
                if (chunk.content) fullResponse += chunk.content;
            }

            // 移除可能存在的 Markdown 標記或前綴
            let jsonStr = fullResponse.trim();
            if (jsonStr.includes('```')) {
                const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match) jsonStr = match[1];
            }

            const steps = JSON.parse(jsonStr);

            if (Array.isArray(steps)) {
                this.workflowManager.save(steps);
                pendingMsg.content = `✅ **工作流規劃完成**，已自動載入 ${steps.length} 個步驟至 Task Manager。`;
                service.updateWebview();
                this.messenger.openWorkflowPanel();
                vscode.window.showInformationMessage(`AI 已成功規劃了 ${steps.length} 個步驟。`);
            } else {
                throw new Error('AI 回傳的格式不正確（預期為 JSON 陣列）');
            }
        } catch (e) {
            console.error('[AI Plan Error]', e);
            pendingMsg.content = `⚠️ **工作流規劃失敗**: ${e}`;
            vscode.window.showErrorMessage(`AI 規劃失敗: ${e}`);
        } finally {
            service.isGenerating = false;
            service.updateWebview();
        }
    }

    // [2026-03-28] [Task-AntiHallucination] - Fetch up to 2 layers of directory structure to prevent AI from guessing paths (e.g., bin, obj)
    private getWorkspaceStructure(dir: string, depth: number = 0, maxDepth: number = 2): string {
        if (depth >= maxDepth) return '';
        let result = '';
        const ignoreList = ['.git', 'node_modules', 'dist', 'out', '.vscode', '.bws.coder', 'bin', 'obj'];
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const item of items) {
                if (ignoreList.includes(item.name)) continue;

                const indent = '  '.repeat(depth);
                result += `${indent}${item.name}${item.isDirectory() ? '/' : ''}\n`;

                if (item.isDirectory()) {
                    result += this.getWorkspaceStructure(path.join(dir, item.name), depth + 1, maxDepth);
                }
            }
        } catch (e) {
            console.error('[BWS Coder] Error reading workspace structure:', e);
        }
        return result;
    }
}
