export class Popup {
    public static getHtml(): string {
        return `
            <div class="popped-out-overlay">
                <div class="popped-card">
                    <div class="popped-icon">🚀</div>
                    <div style="font-size: 13px; margin-bottom: 4px;">對話已在獨立視窗開啟</div>
                    <div style="font-size: 11px; opacity: 0.6;">(關閉獨立視窗即可恢復此處)</div>
                    <button class="popped-btn" onclick="vscode.postMessage({command:'returnToSidebar'})">收回至側邊欄</button>
                </div>
            </div>
        `;
    }
}
