import { t } from '../../utils/locale';

export class Popup {
    public static getHtml(lang?: string): string {
        return `
            <div class="popped-out-overlay">
                <div class="popped-card">
                    <div class="popped-icon">🚀</div>
                    <div style="font-size: 13px; margin-bottom: 4px;">${t(lang, 'ui_poppedOutMessage')}</div>
                    <div style="font-size: 11px; opacity: 0.6;">${t(lang, 'ui_poppedOutHint')}</div>
                    <button class="popped-btn" onclick="vscode.postMessage({command:'returnToSidebar'})">${t(lang, 'ui_returnToSidebar')}</button>
                </div>
            </div>
        `;
    }
}
