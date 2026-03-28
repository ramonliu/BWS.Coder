import * as vscode from 'vscode';
import { ChatService } from './chatService';
import { WebviewComponents } from './webviewComponents';

export class DashboardPanel implements vscode.Disposable {
    public static readonly viewType = 'bwsCoder.dashboardPanel';
    private panel: vscode.WebviewPanel | undefined;
    private chatService: ChatService;
    private messageProvider: (msg: any) => Thenable<boolean>;

    constructor(private readonly context: vscode.ExtensionContext, chatService: ChatService) {
        this.chatService = chatService;
        this.messageProvider = async (msg: any) => {
            if (this.panel) {
                return this.panel.webview.postMessage(msg);
            }
            return false;
        };
    }

    public async show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Active);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'BWS.Coder - Task 監控儀表板',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(async (m) => {
            await this.chatService.handleMessage(m);
        });

        this.chatService.addMessageProvider(this.messageProvider);

        this.panel.onDidDispose(() => {
            this.chatService.removeMessageProvider(this.messageProvider);
            this.panel = undefined;
        });

        // Move to new window
        await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');

        // Sync stats immediately
        this.chatService.sendLLMStats();
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM 監控儀表板</title>
    <style>
        ${WebviewComponents.getStyles()}
        body { padding: 0; margin: 0; background: var(--vscode-editor-background); overflow: hidden; }
        .standalone-dashboard { height: 100vh; display: flex; flex-direction: column; padding: 20px; }
        .dashboard-overlay { position: static; display: flex; flex-direction: column; opacity: 1; pointer-events: auto; padding: 0; box-shadow: none; border: none; width: 100%; height: 100%; background: transparent; backdrop-filter: none; }
        .dashboard-close, .dashboard-action-btn { display: none; } /* Standalone window doesn't need these controls */
        .dashboard-grid { flex: 1; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="standalone-dashboard">
        <div class="dashboard-overlay active" id="dashboardOverlay">
            <div class="dashboard-header">
                <div class="dashboard-title">Task 運作監控 Dashboard</div>
            </div>
            <div class="dashboard-grid" id="dashboardGrid"></div>
        </div>
    </div>
    <script>${WebviewComponents.getScripts()}</script>
</body>
</html>`;
    }

    public dispose() {
        this.panel?.dispose();
    }
}
