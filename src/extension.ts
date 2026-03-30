import * as vscode from 'vscode';
import { ILLMClient } from './llm/types';
import { LLMFactory } from './llm/factory';
import { ChatPanel } from './chat/panel';
import { ChatViewProvider } from './chat/chatViewProvider';
import { ProviderManagerPanel } from './chat/providerManager';
import { DashboardPanel } from './chat/dashboardPanel';
import { LogPanel } from './panels/LogPanel';
import { SettingsManagerPanel } from './chat/settingsManager';
import { t, getLang } from './utils/locale';

let client: ILLMClient;
let chatPanel: ChatPanel;
let chatViewProvider: ChatViewProvider;
let providerManager: ProviderManagerPanel;
let dashboardPanel: DashboardPanel;
let settingsManager: SettingsManagerPanel;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  console.log('BWS.Coder Starting up...');

  client = LLMFactory.getClient(context);

  // 遷移邏輯：如果 settings.json 有資料且 globalState 為空，搬移到 globalState (不刪除以維持使用者編輯彈性)
  const config = vscode.workspace.getConfiguration('bwsCoder');
  const oldProviders = config.get<any[]>('providers');
  if (oldProviders && oldProviders.length > 0) {
    const existing = context.globalState.get<any[]>('bwsCoder.providers');
    if (!existing || existing.length === 0) {
      await context.globalState.update('bwsCoder.providers', oldProviders);
      // [2026-03-25] [Settings Persistence Fix] - Stop deleting from settings.json to allow manual user management.
    }
  }

  // 建立 Provider Manager 與 Settings Panel 實例
  providerManager = new ProviderManagerPanel(context);
  settingsManager = new SettingsManagerPanel(context);

  // 註冊刷新指令 (供 ProviderManagerPanel 調用)
  context.subscriptions.push(
    vscode.commands.registerCommand('bwsCoder.refreshProviders', () => {
      client = LLMFactory.getClient(context);
      if (chatViewProvider) chatViewProvider.refresh();
      updateStatusBar(statusBarItem, context);
    })
  );

  // 監聽傳統設定改變 (如溫度、語言等)
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('bwsCoder')) {
        client = LLMFactory.getClient(context);
        updateStatusBar(statusBarItem, context);

        // [2026-03-30] Full Localization - Refresh Manager panels locale if language changed
        if (e.affectsConfiguration('bwsCoder.language')) {
          providerManager.refreshLocale();
          settingsManager.refreshLocale();
          // Update tooltip since it's only set once in createStatusBarItem
          statusBarItem.tooltip = t(getLang(), 'ui_statusBarAi');
        }
      }
    })
  );

  // Register Chat View Provider (Sidebar)
  chatViewProvider = new ChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  context.subscriptions.push(
    // [2026-03-27] [LogPanel] - Register command for opening raw stream Log viewer
    vscode.commands.registerCommand('bwsCoder.openLogPanel', () => {
      LogPanel.createOrShow(context.extensionUri, context.logUri.fsPath);
    }),
    vscode.commands.registerCommand('bwsCoder.openChatPanel', () => {
      if (chatViewProvider) chatViewProvider.showPanel();
    }),
    vscode.commands.registerCommand('bwsCoder.manageProviders', () => {
      providerManager.show();
    }),
    vscode.commands.registerCommand('bwsCoder.popOutDashboard', () => {
      if (!dashboardPanel) {
        dashboardPanel = new DashboardPanel(context, chatViewProvider.chatService);
      }
      dashboardPanel.show();
    }),
    vscode.commands.registerCommand('bwsCoder.configure', () => {
      settingsManager.show();
    })
  );

  // 啟動後自動開啟側邊欄 (如果使用者想要取代預設 AI Agent)
  // 使用 setImmediate 確保在其他視圖初始化後再聚焦
  setImmediate(() => {
    vscode.commands.executeCommand('bwsCoder.chatView.focus');
    // 如果想要強制開啟 Secondary Sidebar (視 VS Code 版本與配置而定)
    // vscode.commands.executeCommand('workbench.action.openSecondarySidebar'); 
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bwsCoder.selectModel', async () => {
      vscode.commands.executeCommand('bwsCoder.manageProviders');
    }),
    createStatusBarItem(context)
  );

  console.log('BWS.Coder 已啟動！');
}

function createStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  updateStatusBar(statusBarItem, context);
  statusBarItem.tooltip = t(getLang(), 'ui_statusBarAi');
  statusBarItem.command = 'bwsCoder.manageProviders';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);

  return statusBarItem;
}

function updateStatusBar(item: vscode.StatusBarItem, context: vscode.ExtensionContext) {
  if (!item) return;

  // 從 globalState 讀取 (與解決儲存問題一致)
  const providers = context.globalState.get<any[]>('bwsCoder.providers') || [];

  // 嚴格過濾已啟用的提供者 (預設啟用的也算)
  const enabled = providers.filter(p => p.enabled !== false);

  if (enabled.length === 0) {
    item.text = `$(warning) ${t(getLang(), 'ui_statusBarAi')} (0)`;
    item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else if (enabled.length === 1) {
    const p = enabled[0];
    const isGemini = p.endpoint && p.endpoint.includes('googleapis.com');
    item.text = `${isGemini ? '$(key)' : '$(hubot)'} ${p.name}`;
    item.backgroundColor = undefined;
  } else {
    item.text = `$(combine) ${t(getLang(), 'ui_statusBarAi')} (${enabled.length})`;
    item.backgroundColor = undefined;
  }
}

export function deactivate() {
  console.log('BWS.Coder 已停用');
}