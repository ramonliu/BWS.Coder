import * as vscode from 'vscode';
import { ChatService } from './chatService';
import { WebviewComponents } from './webviewComponents';

export class ChatPanel implements vscode.Disposable {
  public static readonly viewType = 'bwsCoder.chat';
  private panel: vscode.WebviewPanel | undefined;
  private chatService: ChatService;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.chatService = new ChatService(context, async (msg) => {
        if (this.panel) {
            return this.panel.webview.postMessage(msg);
        }
        return false;
    });
  }

  public show(): void {
    if (this.panel) { this.panel.reveal(); return; }
    this.panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType, 'BWS.Coder - AI程式工程師', vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.context.extensionUri] }
    );

    this.panel.webview.html = this.getWebviewContent();

    this.panel.webview.onDidReceiveMessage(async (m) => {
      try { await this.chatService.handleMessage(m); }
      catch (e: any) { console.error(e); vscode.window.showErrorMessage(`BWS.Coder Error: ${e.message || e}`); }
    });

    this.panel.onDidDispose(() => { this.panel = undefined; this.chatService.dispose(); });
    this.chatService.updateWebview();
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BWS.Coder Chat</title>
    <style>${WebviewComponents.getStyles()}</style>
</head>
<body>
    ${WebviewComponents.getToolbarHtml()}
    ${WebviewComponents.getChatAreaHtml()}
    ${WebviewComponents.getInputAreaHtml()}
    <script>${WebviewComponents.getScripts()}</script>
</body>
</html>`;
  }

  public dispose() {
    this.panel?.dispose();
    this.chatService.dispose();
  }
}