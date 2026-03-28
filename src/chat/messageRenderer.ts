import { ChatMessage } from './historyManager';
import { MessageTemplates } from './messageTemplates';
import * as vscode from 'vscode';
// [2026-03-28] [FileOps-Refactor] - getRenderBlockRegex no longer needed (replaced by fileOps[] rendering)


/**
 * Handles the conversion of ChatMessage objects to HTML strings.
 * This moves the rendering logic from the webview JS to the extension TS.
 */
export class MessageRenderer {

    /**
     * Renders a single message to HTML.
     */
    public static renderMessage(m: ChatMessage, isGenerating: boolean): string {
        const config = vscode.workspace.getConfiguration('bwsCoder');
        const debugMode = config.get<boolean>('debugMode') || false;

        // [2026-03-24] UI Fix - Hide raw [Execution Result] user messages unless debug mode is on
        const isExecutionResult = m.role === 'user' && m.content.startsWith('[Execution Result]');
        if (isExecutionResult && !debugMode) {
            return '';
        }

        if (m.role === 'system') {
            // 系統訊息也轉化為 Block 格式，更美觀
            return MessageTemplates.renderAutoReport('系統訊息', this.renderContent(m.content, isGenerating, m.id), m.id, false);
        }

        const isAutoReport = m.role === 'user' && m.content.indexOf('[系統自動回報]') === 0;
        const attsHtml = MessageTemplates.renderAttachments(m.attachments || []);
        
        if (m.role === 'user') {
            let contentHtml: string;
            // 判斷是否需要摺疊 (超過 3 行就只顯示約 2 行的高度)
            const lines = m.content.split('\n').length;
            const isCollapsible = !isAutoReport && (m.content.length > 150 || lines > 3);

            if (isAutoReport) {
                const firstLine = m.content.split('\n')[0];
                const rest = m.content.substring(firstLine.length).trim();
                contentHtml = MessageTemplates.renderAutoReport(firstLine, this.renderContent(rest, isGenerating, m.id), m.id);
            } else {
                contentHtml = this.renderContent(m.content, isGenerating, m.id);
            }
            return MessageTemplates.renderUserMessage(contentHtml, attsHtml, isAutoReport, isCollapsible, m.id);
        }

        if (m.role === 'assistant') {
            // [2026-03-24] UI Fix - Prevent global isGenerating from freezing older messages' fileop states
            const isMsgGenerating = m.isStreaming !== undefined ? m.isStreaming : isGenerating;
            const thinkingHtml = MessageTemplates.renderThinkingBox(m.thinking || '', isMsgGenerating, m.isThinking, m.id);

            // [2026-03-28] [State-Machine-Parser] - Iterate over blocks[] in strict sequence
            let contentHtml = '';
            if (m.blocks && m.blocks.length > 0) {
                for (const block of m.blocks) {
                    if (block.type === 'speak') {
                        contentHtml += this.renderContent(block.text || '', isMsgGenerating, m.id);
                    } else if (block.type === 'action') {
                        // [2026-03-28] [UI State Render] - Pass execution data dynamically to UI component
                        let displayContent = block.content || '';
                        let execResultStr: string | undefined = undefined;

                        if (block.action === 'read' || block.action === 'execute') {
                            if (block.result !== undefined) {
                                execResultStr = block.result;
                            }
                        } else {
                            if (block.success === false && block.result) {
                                execResultStr = block.result;
                            }
                        }

                        // Use the block's unique id for rendering key to prevent re-renders
                        contentHtml += block.isPending && !block.result 
                            ? MessageTemplates.renderStreamingLabel(block.action || '', block.filePath || '')
                            : MessageTemplates.renderFileOpLabel(block.action || '', block.filePath || '', displayContent, block.isPending, block.id, block.success, execResultStr);
                        contentHtml += '\n';
                    }
                }
            } else {
                // Fallback for legacy messages
                contentHtml = this.renderContent(m.content, isMsgGenerating, m.id);
            }

            return MessageTemplates.renderAssistantMessage(thinkingHtml, contentHtml, attsHtml, m.id, m.providerName, m.taskName);
        }

        return '';
    }

    /**
     * Parses Markdown and custom tags into HTML.
     */
    private static renderContent(content: string, isGenerating: boolean, msgId: string): string {
        if (!content) return '';
        
        const protected_blocks: string[] = [];
        let text = content.trim(); // Trim at start to prevent leading \n translating into <br> gap

        // 1. 處理檔案操作區塊：
        // 為了避免使用者看到綠色的「✅ 已建立」誤認為已寫入硬碟，
        // 一律渲染為「建檔中...」(Streaming Label)，不管它的 Markdown 區塊是否已經閉合。
        
        // 1. 處理任務清單 (Task List / Plan)
        // 增強型正則：支援更多標題關鍵字，如「執行計畫」
        const taskRegex = /^(?:###|##)?\s*(任務計畫|任務清單|計畫|執行計畫)\s*\n((?:[-*] \[[ x/\]].*\n?)+)/im;
        const taskMatch = text.match(taskRegex);
        if (taskMatch) {
            const title = taskMatch[1];
            const taskLines = taskMatch[2].split('\n').filter(l => l.trim()).map(line => {
                const match = line.match(/^[-*] \[( |x|\/| )\] (.*)$/);
                if (match) {
                    const state = match[1] === 'x' ? 'done' : (match[1] === '/' ? 'current' : 'todo');
                    return { text: match[2], state: state as any };
                }
                return { text: line.replace(/^[-*] \[[ x/\]]\s*/, ''), state: 'todo' as any };
            });
            const taskHtml = MessageTemplates.renderTaskPanel(taskMatch[1], taskLines, msgId);
            const id = `__PROTECTED_BLOCK_${protected_blocks.length}__`;
            protected_blocks.push(taskHtml);
            text = text.replace(taskMatch[0], id);
        }

        // Fallback: strip any residual or manually typed raw tags from display
        const blockRegex = /\[@@\s*(?:create|modify|replace|read|execute|delete):[^\]]+@@\][\s\S]*?(?:\[@@\s*eof\s*@@\]|(?=\[@@ )|$)/gi;
        text = text.replace(blockRegex, () => '');

        // 3. 處理一般的程式碼區塊 (非 File Op)
        const codeRegex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
        text = text.replace(codeRegex, (m, lang, code) => {
            const id = `__PROTECTED_BLOCK_${protected_blocks.length}__`;
            protected_blocks.push(MessageTemplates.renderCodeBlock(lang || 'text', code));
            return id;
        });

        // [2026-03-25] Narrative Step Completion Signal - Support narrative markers in UI rendering.
        const doneRegex = /\[@@DONE@@\]|\[DONE\]|\([\s\S]+?\)已完成任務/g;
        text = text.replace(doneRegex, () => {
            const id = `__PROTECTED_BLOCK_${protected_blocks.length}__`;
            protected_blocks.push(MessageTemplates.renderDoneBlock(msgId));
            return id;
        });

        // 5. 對剩餘文字進行 HTML 轉義與基礎 Markdown 解析
        let esc = MessageTemplates.escapeHtml(text.trim());

        // 移除多餘換行 (如果是兩個保護塊相連)
        esc = esc.replace(/(__PROTECTED_BLOCK_\d+__)\s*\n\s*(?=__PROTECTED_BLOCK_\d+__)/g, '$1');

        esc = esc
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/^[ ]*[*|-][ ]+(.*)$/gm, '<ul><li>$1</li></ul>')
            .replace(/<\/ul>\n<ul>/g, '')
            .replace(/\n/g, '<br>');

        // 5. 最後把所有保護塊填回
        for (let i = 0; i < protected_blocks.length; i++) {
            const placeholder = `__PROTECTED_BLOCK_${i}__`;
            esc = esc.split(placeholder).join(protected_blocks[i]);
        }

        return esc;
    }
}
