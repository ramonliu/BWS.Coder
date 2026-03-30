import { t } from '../../utils/locale';

export class Toolbar {
    public static getHtml(lang?: string): string {
        return `
            <div class="toolbar">
                <!-- [2026-03-29] Dashboard-Fix - Directly call window.popOutDashboard() for direct popup -->
                <button class="toolbar-btn" onclick="window.popOutDashboard()" title="${t(lang, 'ui_dashboardTitle')}">
                    <svg viewBox="0 0 16 16"><path d="M13.5 1h-11C1.67 1 1 1.67 1 2.5v11c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5v-11c0-.83-.67-1.5-1.5-1.5zm0 12.5h-11v-11h11v11zM7 11h2V5H7v6zm-4 0h2V8H3v3zm8 0h2V7h-2v4z"/></svg>
                </button>
                <button class="toolbar-btn" onclick="window.toggleWorkflow()" title="${t(lang, 'wf_orchestration')}" style="color:#4ec9b0"><svg viewBox="0 0 16 16"><path d="M10 11H6V5h4v6zm1 1H5V4h6v8zM3 7H1V5h2v2zm0 4H1V9h2v2zm12-4h-2V5h2v2zm0 4h-2V9h2v2zM8 3h2V1H8v2zm0 12h2v-2H8v2z"/></svg></button>
                
                <div class="mode-selector">
                    <input type="radio" id="mode-workflow" name="chat-mode" value="Workflow" onchange="window.setChatMode('Workflow')">
                    <label for="mode-workflow" title="${t(lang, 'ui_workflowTitle')}">Workflow</label>
                    <input type="radio" id="mode-group" name="chat-mode" value="Group" onchange="window.setChatMode('Group')">
                    <label for="mode-group" title="${t(lang, 'ui_groupTitle')}">Group</label>
                    <input type="radio" id="mode-single" name="chat-mode" value="Single" checked onchange="window.setChatMode('Single')">
                    <label for="mode-single" title="${t(lang, 'ui_singleTitle')}">Single</label>
                </div>

                <div style="flex:1"></div>

                <button class="toolbar-btn" onclick="vscode.postMessage({command:'openLogPanel'})" title="${t(lang, 'ui_logTooltip')}"><svg viewBox="0 0 16 16"><path d="M11 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4zM3 14V2h7v3h3v9zM11 6H5v1h6zm0 2H5v1h6zm0 2H5v1h6z"/></svg></button>
                <button class="toolbar-btn" id="historyToggle" onclick="window.toggleHistory()" title="${t(lang, 'ui_historyTooltip')}"><svg viewBox="0 0 16 16"><path d="M8.5 2c-1.8 0-3.4.7-4.6 1.9L2.8 2.8C2.5 2.5 2 2.7 2 3.2V7c0 .6.4 1 1 1h3.8c.5 0 .7-.5.3-.8L5.7 5.7C6.4 5 7.4 4.5 8.5 4.5c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5c-1 0-2-.4-2.8-1-.4-.3-.9-.2-1.2.2-.3.4-.2.9.1 1.2 1.1.9 2.4 1.4 3.9 1.4 3.6 0 6.5-2.9 6.5-6.5S12.1 2 8.5 2z"/></svg></button>
                <button class="toolbar-btn" onclick="window.startNewChat()" title="${t(lang, 'ui_newChatTooltip')}"><svg viewBox="0 0 16 16"><path d="M14 7H9V2H7v5H2v2h5v5h2V9h5V7z"/></svg></button>
                <button class="toolbar-btn" onclick="window.sendHandover()" title="${t(lang, 'ui_handoverTooltip')}"><svg viewBox="0 0 16 16"><path d="M13.8 3l-1.6-1.6V1.4c0-.2-.1-.3-.2-.4H2.5c-.3 0-.5.2-.5.5v12.5c0 .3.2.5.5.5h11c.3 0 .5-.2.5-.5V3.4c0-.2-.1-.3-.2-.4zM8 13c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3-8H3V3h8v2z"/></svg></button>
            </div>
        `;
    }
}
