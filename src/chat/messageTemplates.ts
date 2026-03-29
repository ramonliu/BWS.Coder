import { Attachment } from './historyManager';

/**
 * Provides HTML templates for different message components using a unified block-based architecture.
 */
export class MessageTemplates {

    // --- Icons (SVG) ---
    private static readonly ICONS = {
        user: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0-2.21-1.79-4-4-4H6c-2.21 0-4 1.79-4 4 0 .55.45 1 1 1h10c.55 0 1-.45 1-1zM3.07 13c.42-1.7 1.93-3 3.73-3h2.4c1.8 0 3.31 1.3 3.73 3H3.07z"/></svg>',
        assistant: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M12 2H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM4 3h8c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1zm1 2h2v2H5V5zm4 0h2v2H9V5zm-4 4h6v2H5V9z"/></svg>',
        thinking: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8.5 2c-1.8 0-3.4.7-4.6 1.9L2.8 2.8C2.5 2.5 2 2.7 2 3.2V7c0 .6.4 1 1 1h3.8c.5 0 .7-.5.3-.8L5.7 5.7C6.4 5 7.4 4.5 8.5 4.5c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5c-1 0-2-.4-2.8-1-.4-.3-.9-.2-1.2.2-.3.4-.2.9.1 1.2 1.1.9 2.4 1.4 3.9 1.4 3.6 0 6.5-2.9 6.5-6.5S12.1 2 8.5 2z"/></svg>',
        code: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M4.7 3.3L0 8l4.7 4.7.7-.7L1.4 8l4-4-.7-.7zm6.6 0l-.7.7 4 4-4 4 .7.7L16 8l-4.7-4.7z"/></svg>',
        file: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M13.5 1h-11c-.3 0-.5.2-.5.5v13c0 .3.2.5.5.5h11c.3 0 .5-.2.5-.5V3.4c0-.2-.1-.3-.2-.4l-1.6-1.6c-.1-.1-.2-.1-.2-.2zM13 14H3V3h10v11zM8 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3-8H3V3h8v2z"/></svg>',
        success: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3 5l-4 4-2-2 .7-.7 1.3 1.3 3.3-3.3.7.7z"/></svg>',
        error: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7 5h2v4H7V5zm0 6h2v2H7v-2z"/></svg>',
        funnel: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15 2L1 2 1 3 7 9 7 15 9 15 9 9 15 3 15 2z"/></svg>'
    };

    public static escapeHtml(t: string): string {
        if (!t) return '';
        return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    /**
     * Core rendering engine for all types of blocks (bubbles, thinking, file operations, etc.)
     */
    private static renderBaseBlock(props: {
        id?: string,
        role?: 'user' | 'assistant' | 'system',
        typeClass: string,
        icon: string,
        title: string,
        contentHtml: string,
        footerHtml?: string,
        isCollapsible?: boolean,
        collapsed?: boolean,
        isThinking?: boolean,
        collapsibleType?: 'thinking' | 'message' | 'fileop' | 'code' | 'report' | 'generic',
        subId?: string,
        style?: string
    }): string {
        const styleAttr = props.style ? `style="${props.style}"` : '';
        const idAttr = props.id ? `data-id="${props.id}"` : '';
        const typeAttr = props.collapsibleType ? `data-type="${props.collapsibleType}"` : '';
        const subIdAttr = props.subId ? `data-subid="${this.escapeHtml(props.subId)}"` : '';
        const collapsibleClass = props.isCollapsible ? 'collapsible' : '';
        const expandedClass = (props.isCollapsible && props.collapsed === false) ? 'expanded' : '';
        const activeClass = props.isThinking ? 'active' : '';
        const encodedSubId = props.subId ? this.escapeHtml(props.subId).replace(/'/g, "\\'") : '';
        const onclick = props.isCollapsible ? `onclick="window.toggleBlock(event, this, '${props.collapsibleType || 'generic'}', '${encodedSubId}')"` : '';

        return `
            <div class="block-container ${props.typeClass} ${collapsibleClass} ${expandedClass}" ${idAttr} ${typeAttr} ${subIdAttr} ${onclick} ${styleAttr}>
                <div class="block-header ${activeClass}">
                    <span class="block-icon">${props.icon}</span>
                    <span class="block-title">${this.escapeHtml(props.title)}</span>
                    ${props.isCollapsible ? '<span class="block-toggle-icon">▼</span>' : ''}
                </div>
                <div class="block-content">
                    ${props.contentHtml}
                    ${props.footerHtml || ''}
                </div>
            </div>
        `;
    }

    public static renderUserMessage(contentHtml: string, attachmentsHtml: string, isAutoReport: boolean, isCollapsible: boolean, id: string): string {
        if (isAutoReport) {
            // 自動回報本身已經是個完整的 Block (renderAutoReport 回傳的)，直接返回即可
            return `<div class="message user auto-report-container">${contentHtml}${attachmentsHtml}</div>`;
        }

        return this.renderBaseBlock({
            id,
            role: 'user',
            typeClass: 'message user block-user',
            icon: this.ICONS.user,
            title: '你',
            contentHtml: contentHtml + attachmentsHtml,
            isCollapsible: isCollapsible,
            collapsed: true, // 依照要求，預設摺疊 (CSS 會處理 2 行截斷)
            collapsibleType: 'message'
        });
    }

    public static renderAssistantMessage(thinkingHtml: string, contentHtml: string, attsHtml: string, id: string, providerName?: string, taskName?: string): string {
        const isInitialLoading = !thinkingHtml && !contentHtml && !attsHtml;
        // [2026-03-30] D-3 Fix - 移除冗餘中間變數 bodyHtml = bodyContent
        const bodyContent = isInitialLoading ? this.renderInitialLoader() : ((thinkingHtml || '') + (contentHtml || '') + (attsHtml || ''));
        let style = '';
        let typeClass = 'message assistant block-assistant';

        if (providerName) {
            const colorInfo = this.getProviderColor(providerName);
            // 動態 HSL: 背景深色 (12%), 邊框稍亮 (25%), 飽和度適中 (35-40%)
            // 2026-03-23 UI Fix - chat block background slightly transparent for glass effect
            style = `--ai-accent-color: ${colorInfo.accent}; background: hsla(${colorInfo.hue}, 35%, 12%, 0.15); border-color: hsla(${colorInfo.hue}, 40%, 25%, 0.4);`;
            if (id) typeClass += ' latest'; // 標記為最新，用於動態效果
        }

        return this.renderBaseBlock({
            id,
            typeClass: typeClass,
            icon: this.ICONS.assistant,
            title: this.formatAssistantTitle(providerName, taskName),
            contentHtml: bodyContent,
            isCollapsible: false, // AI 主泡泡預設不摺疊
            collapsibleType: 'message',
            style
        });
    }

    private static formatAssistantTitle(providerName?: string, taskName?: string): string {
        if (taskName && taskName !== '新任務' && taskName !== 'SingleChat') {
            return taskName + ' (' + providerName + ')';
        }
        return providerName || 'AI 程式工程師';
    }

    private static getProviderColor(name: string): { hue: number, accent: string } {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('gemini')) return { hue: 250, accent: '#a142f4' }; // Purple/Blue
        if (lowerName.includes('openai') || lowerName.includes('gpt')) return { hue: 160, accent: '#10a37f' }; // Emerald
        if (lowerName.includes('ollama')) return { hue: 35, accent: '#ed8a19' }; // Orange
        if (lowerName.includes('claude') || lowerName.includes('anthropic')) return { hue: 15, accent: '#d97757' }; // Terracotta

        // Default hash-based hue
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return { hue, accent: `hsl(${hue}, 70%, 50%)` };
    }

    public static renderTaskPanel(title: string, tasks: { text: string, state: 'done' | 'todo' | 'current' }[], msgId?: string): string {
        const doneCount = tasks.filter(t => t.state === 'done').length;
        const progress = Math.round((doneCount / tasks.length) * 100) || 0;

        const tasksHtml = tasks.map(t => `
            <div class="task-item ${t.state}">
                <span class="task-check">${t.state === 'done' ? '✓' : (t.state === 'current' ? '▶' : '○')}</span>
                <span class="task-text">${this.escapeHtml(t.text)}</span>
            </div>
        `).join('');

        const contentHtml = `
            <div class="progress-info" style="display:flex; justify-content:space-between; font-size:11px; color:var(--bws-glow-color)">
                <span>進度: ${progress}%</span>
                <span>${doneCount}/${tasks.length}</span>
            </div>
            <div class="progress-container"><div class="progress-bar" style="width:${progress}%"></div></div>
            <div class="task-list">${tasksHtml}</div>
        `;

        return this.renderBaseBlock({
            id: msgId,
            typeClass: 'block-task',
            icon: this.ICONS.thinking,
            title: title || '任務執行計畫',
            contentHtml: contentHtml,
            isCollapsible: true,
            collapsed: false, // 任務面板預設展開以顯示進度
            collapsibleType: 'report',
            subId: 'taskpanel'
        });
    }

    public static renderThinkingBox(thinking: string, isGenerating: boolean, isThinking?: boolean, msgId?: string): string {
        // [2026-03-30] UX Refinement - Only show the box if there's actual text.
        // This allows renderAssistantMessage to show "正在預入中..." until the first chunk arrives.
        if (!thinking) return '';
        
        // [2026-03-30] Fix - 嚴格判斷：isThinking === true 才代表「思考中」；
        // isThinking === false 代表「思考完畢但正在說話」；
        // 若 !isGenerating 則串流已結束，一律為「思考完畢」。
        const showThinkingState = isGenerating === true && isThinking === true;
        const status = showThinkingState ? '思考中...' : '思考完畢';
        
        const content = `<div class="thinking-text">${this.escapeHtml(thinking)}</div>`;

        return this.renderBaseBlock({
            id: msgId,
            typeClass: 'block-think',
            icon: showThinkingState ? `<span class="spin">${this.ICONS.thinking}</span>` : this.ICONS.thinking,
            title: status,
            contentHtml: content,
            isCollapsible: true, // 思考塊一向可摺疊
            collapsed: true, // 依照要求，預設摺疊
            isThinking: showThinkingState,
            collapsibleType: 'thinking',
            subId: 'think'
        });
    }

    public static renderInitialLoader(): string {
        // [2026-03-30] Fix - 狀態文字對齊用戶要求：「預入中...」 = 送出 request 後至第一個 chunk 到來前
        return `<div class="initial-loader"><span class="spin">${this.ICONS.funnel}</span> 預入中...</div>`;
    }

    // [2026-03-28] [UI State Render] - Added isSuccess and executionResult parameters
    public static renderFileOpLabel(action: string, filePath: string, content?: string, isPending?: boolean, msgId?: string, isSuccess?: boolean, executionResult?: string): string {
        // [2026-03-24] UI Fix - If eager execution already injected the result, this block is no longer pending
        if (isPending && content && content.includes('--- 執行結果')) {
            isPending = false;
        }

        const labels: Record<string, string> = isPending ? {
            create: '待建立', modify: '待修改', replace: '待局部修改', 'delete': '待刪除',
            execute: '待執行', 'execute-status': '狀態', 'execute-result': '執行結果'
        } : {
            create: '已建立', modify: '已修改', replace: '已局部修改', 'delete': '已刪除',
            // [2026-03-24] UI Fix - Rename '執行' to '已執行' for clarity when finished
            execute: '已執行', 'execute-status': '狀態', 'execute-result': '執行結果'
        };

        const actionIcons: Record<string, string> = {
            create: this.ICONS.file, modify: this.ICONS.file, replace: this.ICONS.file,
            'delete': this.ICONS.error, execute: this.ICONS.code, 'execute-status': this.ICONS.thinking, 'execute-result': this.ICONS.success
        };

        const labelText = labels[action] || action;
        const icon = actionIcons[action] || this.ICONS.file;
        let statusClass = '';
        let statusIcon = '';

        if (!isPending) {
            // [2026-03-28] [UI State Render] - Decode success param directly
            if (isSuccess !== undefined) {
                statusClass = isSuccess ? 'success' : 'error';
                statusIcon = isSuccess ? this.ICONS.success : this.ICONS.error;
            } else if (content) {
                // Legacy fallback for embedded chat histories
                if (content.includes('✅') || content.includes('(成功)')) {
                    statusClass = 'success';
                    statusIcon = this.ICONS.success;
                } else if (content.includes('❌') || content.includes('(失敗)')) {
                    statusClass = 'error';
                    statusIcon = this.ICONS.error;
                }
            }
        }

        // [2026-03-28] [UI State Render] - Render execution result natively from parser
        let cleanCode = content || '';
        let resultHtml = '';
        
        if (!isPending && executionResult !== undefined) {
            const statusStr = isSuccess ? '成功' : '失敗';
            const resultBoxClass = isSuccess ? 'success' : 'error';
            resultHtml = `
                <div class="execution-result-box ${resultBoxClass}">
                    <div class="result-header">↳ 回報 AI 執行結果 (${statusStr})</div>
                    <div class="result-body"><pre><code>${this.escapeHtml(executionResult.trim())}</code></pre></div>
                </div>
            `;
        } else {
            const resultMatch = cleanCode.match(/\n\n--- 執行結果 \((.*?)\) ---\n([\s\S]*)$/);
            if (resultMatch) {
                cleanCode = cleanCode.substring(0, resultMatch.index).trim();
                const statusStr = resultMatch[1];
                const resultContent = resultMatch[2].trim();
                const resultBoxClass = statusStr.includes('成功') ? 'success' : 'error';
                resultHtml = `
                    <div class="execution-result-box ${resultBoxClass}">
                        <div class="result-header">↳ 回報 AI 執行結果 (${statusStr})</div>
                        <div class="result-body"><pre><code>${this.escapeHtml(resultContent)}</code></pre></div>
                    </div>
                `;
            }
        }

        let processedContent = (action === 'replace' && cleanCode) ? this.renderDiff(cleanCode) : (cleanCode ? `<pre><code>${this.escapeHtml(cleanCode.trim())}</code></pre>` : '');
        if (resultHtml) {
            processedContent += resultHtml;
        }
        const hasContent = !!processedContent;

        return this.renderBaseBlock({
            id: msgId,
            typeClass: `block-fileop ${action} ${statusClass} ${isPending ? 'pending' : ''}`,
            icon: isPending ? `<span class="spin">${icon}</span>` : (statusIcon || icon),
            title: `${labelText}: ${filePath}`,
            contentHtml: processedContent,
            isCollapsible: hasContent,
            collapsed: true, // 依照要求，預設摺疊
            collapsibleType: 'fileop',
            subId: filePath
        });
    }

    /**
     * Renders a specialized diff view for 'replace' actions.
     */
    private static renderDiff(content: string): string {
        const lineMatch = content.match(/L(\d+)-L?(\d+):/i);
        let headerHtml = '';
        let cleanContent = content;
        if (lineMatch) {
            headerHtml = `<div class="line-info">${this.escapeHtml(lineMatch[0])}</div>`;
            cleanContent = content.replace(lineMatch[0], '').trim();
        }

        const markerStart = cleanContent.indexOf('[@@<@@]');
        const markerDivider = cleanContent.indexOf('[@@=@@]');
        const markerEnd = cleanContent.indexOf('[@@>@@]');

        if (markerStart !== -1 && markerDivider !== -1 && markerEnd !== -1) {
            let oldCode = cleanContent.substring(markerStart + 7, markerDivider).trim();
            let newCode = cleanContent.substring(markerDivider + 7, markerEnd).trim();

            // 移除可能的 SEARCH / REPLACE 關鍵字以美化顯示
            oldCode = oldCode.replace(/^SEARCH[ \t\r\n]*/i, '').trim();
            newCode = newCode.replace(/[ \t\r\n]*REPLACE$/i, '').trim();

            let html = `<div class="diff-block">${headerHtml}`;
            if (oldCode) {
                html += oldCode.split('\n').map(l => `<div class="diff-remove">- ${this.escapeHtml(l)}</div>`).join('');
            }
            if (newCode) {
                html += newCode.split('\n').map(l => `<div class="diff-add">+ ${this.escapeHtml(l)}</div>`).join('');
            }
            html += `</div>`;
            return html;
        }
        return `<pre><code>${this.escapeHtml(content.trim())}</code></pre>`;
    }

    public static renderCodeBlock(lang: string, code: string): string {
        const trimmedCode = code.trim();
        const encodedCode = encodeURIComponent(trimmedCode);
        const lineCount = trimmedCode.split('\n').length;
        const isCollapsible = lineCount > 5;

        const contentHtml = `
            <pre><code class="language-${lang}">${this.escapeHtml(trimmedCode)}</code></pre>
            <div class="code-actions">
                <button class="code-btn" onclick="window.copyCode(decodeURIComponent('${encodedCode}'))">📋 複製</button>
                <button class="code-btn" onclick="window.applyCode(decodeURIComponent('${encodedCode}'))">✨ 應用</button>
            </div>
        `;

        // 使用程式碼內容的長度與前 10 個字元作為 subId，以區分同一個訊息中的多個 code block
        const subId = `code_${lang}_${code.length}_${trimmedCode.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;

        return this.renderBaseBlock({
            typeClass: 'block-code',
            icon: this.ICONS.code,
            title: `${lang.toUpperCase()} (${lineCount} 行)`,
            contentHtml: contentHtml,
            isCollapsible: isCollapsible,
            collapsed: true, // 依照要求，預設摺疊
            collapsibleType: 'code',
            subId: subId
        });
    }

    // [2026-03-30] Fix - 改用 renderBaseBlock 結構，確保 streaming 狀態也有 block-header（icon 行）
    public static renderStreamingLabel(action: string, path: string): string {
        const labels: Record<string, string> = {
            create: '待建檔...', modify: '待修改...', replace: '待局部修改...', 'delete': '待刪除...',
            execute: '待執行...', read: '讀取中...', 'execute-status': '處理中...', 'execute-result': '結果傳回中...'
        };
        const actionIcons: Record<string, string> = {
            create: this.ICONS.file, modify: this.ICONS.file, replace: this.ICONS.file,
            'delete': this.ICONS.error, execute: this.ICONS.code, read: this.ICONS.code
        };
        const labelText = labels[action] || action;
        const icon = actionIcons[action] || this.ICONS.thinking;

        return this.renderBaseBlock({
            typeClass: `block-fileop ${action} pending streaming`,
            icon: `<span class="spin">${icon}</span>`,
            // [2026-03-30] BUG-5 Fix - 統一為冒號格式，與 renderFileOpLabel 一致，避免切換時閣動
            title: `${labelText}: ${this.escapeHtml(path)}`,
            contentHtml: `<span class="dots"></span>`,
            isCollapsible: false,
            collapsibleType: 'fileop',
            subId: path
        });
    }

    public static renderAttachments(attachments: Attachment[]): string {
        if (!attachments || attachments.length === 0) return '';
        let html = '<div class="chat-image-container">';
        attachments.forEach(a => {
            if (a.type === 'image') {
                html += `<img src="${a.content}" class="chat-image" onclick="window.showFullImage(this.src)" alt="${this.escapeHtml(a.name)}">`;
            } else {
                html += `<div class="file-attachment">📄 ${this.escapeHtml(a.name)}</div>`;
            }
        });
        html += '</div>';
        return html;
    }

    public static renderAutoReport(firstLine: string, bodyHtml: string, msgId: string, collapsed: boolean = true): string {
        return this.renderBaseBlock({
            id: msgId,
            typeClass: 'block-auto-report',
            icon: this.ICONS.thinking,
            title: firstLine,
            contentHtml: bodyHtml,
            isCollapsible: true,
            collapsed: collapsed, // 預設摺疊
            collapsibleType: 'report',
            subId: 'autoreport'
        });
    }

    public static renderDoneBlock(msgId?: string): string {
        return this.renderBaseBlock({
            id: msgId,
            typeClass: 'block-done success',
            icon: this.ICONS.success,
            title: '🎉 任務已完成',
            contentHtml: '<div class="done-text" style="font-size: 13px; opacity: 0.9;">所有作業已全數執行完畢。</div>',
            isCollapsible: false,
            collapsibleType: 'generic',
            subId: 'done'
        });
    }
}
