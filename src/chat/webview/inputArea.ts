export class InputArea {
    public static getHtml(): string {
        return `
            <div class="input-wrapper">
                <div class="input-content-area">
                    <div id="attachmentsPreview" style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap"></div>
                    <div class="input-row">
                        <button class="toolbar-btn" onclick="window.uploadFile()" title="上傳檔案"><svg viewBox="0 0 16 16"><path d="M11.646 3.646l-5.5 5.5a1.5 1.5 0 0 0 2.122 2.122l5.5-5.5a.5.5 0 1 1 .707.707l-5.5 5.5a2.5 2.5 0 0 1-3.536-3.536l5.5-5.5a3.5 3.5 0 1 1 4.95 4.95l-7 7a.5.5 0 0 1-.707-.707l7-7a2.5 2.5 0 1 0-3.536-3.536z"/></svg></button>
                        <textarea id="input" placeholder="按 Shift+Enter 換行, Enter 發送..."></textarea>
                        <button id="sendBtn" class="toolbar-btn" onclick="window.sendMessage()" style="background:var(--vscode-button-background); color:var(--vscode-button-foreground); width:32px; height:32px" title="發送"><svg viewBox="0 0 16 16"><path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.109z"/></svg></button>
                        <button id="stopBtn" class="toolbar-btn" onclick="vscode.postMessage({command:'stop'})" style="display:none; background:#d32f2f; color:white; width:32px; height:32px" title="停止"><svg viewBox="0 0 16 16"><rect x="5" y="5" width="6" height="6" fill="currentColor"/></svg></button>
                    </div>
                </div>
            </div>
        `;
    }
}
