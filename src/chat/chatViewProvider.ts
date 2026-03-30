import * as vscode from 'vscode';
import { ChatService } from './chatService';
import { WebviewComponents } from './webviewComponents';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'bwsCoder.chatView';
  private _view?: vscode.WebviewView;
  private _panel?: vscode.WebviewPanel;
  private isPoppedOut: boolean = false;
  public chatService: ChatService;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.chatService = new ChatService(context, async (msg) => {
        if (this.isPoppedOut && this._panel) {
            return this._panel.webview.postMessage(msg);
        } else if (this._view) {
            return this._view.webview.postMessage(msg);
        }
        return false;
    });

    // Listen to language changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('bwsCoder.language')) {
            const lang = vscode.workspace.getConfiguration('bwsCoder').get<string>('language') || 'en';
            vscode.window.showInformationMessage(`BWS.Coder language changed to ${lang}. Please restart the Chat Panel to fully apply the language interface.`, 'OK');
        }
    }));
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.context.extensionUri] };
    webviewView.webview.html = this.getWebviewContent();

    webviewView.webview.onDidReceiveMessage(async (m) => {
      try { await this.chatService.handleMessage(m); }
      catch (e: any) { console.error(e); vscode.window.showErrorMessage(`BWS.Coder Error: ${e.message || e}`); }
    });

    webviewView.onDidDispose(() => { this._view = undefined; });
    this.chatService.updateWebview();
  }

  public async showPanel() {
    if (this._panel) { this._panel.reveal(vscode.ViewColumn.Active); return; }

    this._panel = vscode.window.createWebviewPanel(
      'bwsCoder.chatPanel', 'BWS.Coder Chat', vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.context.extensionUri] }
    );

    this.isPoppedOut = true;
    if (this._view) this._view.webview.postMessage({ command: 'setPoppedOut', value: true });

    await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');

    this._panel.webview.html = this.getWebviewContent();
    this._panel.webview.onDidReceiveMessage(async (m) => {
      try {
        if (m.command === 'returnToSidebar') { if (this._panel) this._panel.dispose(); return; }
        await this.chatService.handleMessage(m);
      }
      catch (e: any) { console.error(e); vscode.window.showErrorMessage(`BWS.Coder Error: ${e.message || e}`); }
    });

    this._panel.onDidDispose(() => {
      this._panel = undefined;
      this.isPoppedOut = false;
      if (this._view) {
        this._view.webview.postMessage({ command: 'setPoppedOut', value: false });
        vscode.commands.executeCommand('bwsCoder.chatView.focus');
      }
    }, null, this.context.subscriptions);

    this.chatService.updateWebview();
  }

  private getWebviewContent(): string {
    const lang = vscode.workspace.getConfiguration('bwsCoder').get<string>('language') || 'en';
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BWS.Coder Chat</title>
    <style>${WebviewComponents.getStyles()}</style>
</head>
<body>
    ${WebviewComponents.getToolbarHtml(lang)}
    ${WebviewComponents.getChatAreaHtml(lang)}
    ${WebviewComponents.getInputAreaHtml(lang)}
    <script>${WebviewComponents.getScripts(lang)}</script>
</body>
</html>`;
  }

  public refresh() {
    this._view?.webview.postMessage({ command: 'update' });
    this._panel?.webview.postMessage({ command: 'update' });
  }
}
