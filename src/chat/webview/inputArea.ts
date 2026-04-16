import { t } from '../../utils/locale';

export class InputArea {
    public static getHtml(lang?: string): string {
        return `
            <div class="input-wrapper">
                <div class="input-content-area">
                    <div id="attachmentsPreview" style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap"></div>
                    <div class="input-row">
                        <button class="toolbar-btn" onclick="window.uploadFile()" title="${t(lang, 'ui_attached')}"><svg viewBox="0 0 16 16"><path d="M11.646 3.646l-5.5 5.5a1.5 1.5 0 0 0 2.122 2.122l5.5-5.5a.5.5 0 1 1 .707.707l-5.5 5.5a2.5 2.5 0 0 1-3.536-3.536l5.5-5.5a3.5 3.5 0 1 1 4.95 4.95l-7 7a.5.5 0 0 1-.707-.707l7-7a2.5 2.5 0 1 0-3.536-3.536z"/></svg></button>
                        <textarea id="input" placeholder="${t(lang, 'ui_input_instruction')}"></textarea>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <button id="continueBtn" class="toolbar-btn" onclick="document.getElementById('input').value='continue'; window.sendMessage()" style="width:28px; height:28px; background:rgba(255,255,255,0.05)" title="${t(lang, 'ui_continueHint')}">
                                <svg viewBox="0 0 16 16" fill="currentColor" style="width:13px; height:13px"><path d="M3.5 3L9.5 8L3.5 13V3Z"/><path d="M9.5 3L15.5 8L9.5 13V3Z"/></svg>
                            </button>
                            <button id="sendBtn" class="toolbar-btn" onclick="window.sendMessage()" style="background:var(--vscode-button-background); color:var(--vscode-button-foreground); width:28px; height:28px" title="${t(lang, 'ui_send')}">
                                <svg viewBox="0 0 16 16" fill="currentColor" style="width:13px; height:13px"><path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.109z"/></svg>
                            </button>
                            <button id="stopBtn" class="toolbar-btn" onclick="vscode.postMessage({command:'stop'})" style="display:none; background:#d32f2f; color:white; width:28px; height:28px" title="${t(lang, 'ui_close')}">
                                <svg viewBox="0 0 16 16" fill="currentColor" style="width:13px; height:13px"><rect x="4" y="4" width="8" height="8" fill="currentColor"/></svg>
                            </button>
                        </div>
                    </div>
                    <div id="ctxUsage" class="ctx-usage-container">
                        <div class="ctx-usage-indicator">
                            <span class="ctx-usage-dot"></span>
                            <span class="ctx-usage-label">${t(lang, 'ui_context_usage')}:</span>
                            <span class="ctx-usage-value" id="ctxUsageValue">0</span>
                            <span class="ctx-usage-unit">/ 128k ${t(lang, 'ui_tokens')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
