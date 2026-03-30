import * as vscode from 'vscode';
import { ProviderHtml } from './webview/providerHtml';

export interface ProviderConfig {
    id: string;
    name: string;
    model: string;
    endpoint: string;
    apiKeys: string[];
    enabled: boolean;
}

export class ProviderManagerPanel {
    public static readonly viewType = 'bwsCoder.providerManager';
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private static STORAGE_KEY = 'bwsCoder.providers';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public show(): void {
        if (this.panel) {
            this.panel.reveal();
            this.sendProviders();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            ProviderManagerPanel.viewType,
            'BWS.Coder - LLM 提供者管理',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'getProviders':
                    this.sendProviders();
                    break;
                case 'addProvider':
                    await this.addProvider(message.provider);
                    break;
                case 'updateProvider':
                    await this.updateProvider(message.provider);
                    break;
                case 'deleteProvider':
                    await this.deleteProvider(message.id);
                    break;
                case 'confirmDelete':
                    const providers = this.getProviders();
                    const p = providers.find(x => x.id === message.id);
                    if (p) {
                        const confirm = await vscode.window.showWarningMessage(
                            `確定要刪除「${p.name}」嗎？`,
                            { modal: true },
                            '確定刪除'
                        );
                        if (confirm === '確定刪除') {
                            await this.deleteProvider(message.id);
                        }
                    }
                    break;
                case 'toggleProvider':
                    await this.toggleProvider(message.id, message.enabled);
                    break;
                case 'resetAllApiKeyCD':
                    await this.resetAllApiKeyCD(message.keys);
                    break;
            }
        });

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    public getProviders(): ProviderConfig[] {
        // 從 globalState 讀取資料 (不再依賴 settings.json，避免註冊問題)
        const providers = this.context.globalState.get<any[]>(ProviderManagerPanel.STORAGE_KEY) || [];
        return providers.map(p => ({
            ...p,
            enabled: p.enabled === false ? false : true
        }));
    }

    private async saveProviders(providers: ProviderConfig[]) {
        await this.context.globalState.update(ProviderManagerPanel.STORAGE_KEY, providers);
        
        // 發送自定義事件通知 extension 更新 (因為 globalState 不會觸發 onDidChangeConfiguration)
        vscode.commands.executeCommand('bwsCoder.refreshProviders');
        
        this.sendProviders();
    }

    private sendProviders() {
        if (this.panel) {
            const exhaustedKeys = this.context.globalState.get<{ [key: string]: number }>('exhaustedApiKeys', {}) || {};
            this.panel.webview.postMessage({
                command: 'renderProviders',
                providers: this.getProviders(),
                exhaustedKeys: exhaustedKeys
            });
        }
    }

    private async addProvider(provider: ProviderConfig) {
        const providers = this.getProviders();
        const id = 'p_' + Math.random().toString(36).substring(2, 11);
        providers.push({ ...provider, id, enabled: true });
        await this.saveProviders(providers);
        vscode.window.showInformationMessage(`✅ 已新增提供者: ${provider.name}`);
    }

    private async updateProvider(updated: ProviderConfig) {
        let providers = this.getProviders();
        providers = providers.map(p => p.id === updated.id ? updated : p);
        await this.saveProviders(providers);
        vscode.window.showInformationMessage(`✅ 已更新提供者: ${updated.name}`);
    }

    private async deleteProvider(id: string) {
        let providers = this.getProviders();
        const p = providers.find(x => x.id === id);
        if (!p) return;
        providers = providers.filter(p => p.id !== id);
        await this.saveProviders(providers);
        vscode.window.showInformationMessage(`🗑️ 已刪除提供者: ${p.name}`);
    }

    private async toggleProvider(id: string, enabled: boolean) {
        let providers = this.getProviders();
        providers = providers.map(p => p.id === id ? { ...p, enabled } : p);
        await this.saveProviders(providers);
    }

    private async resetAllApiKeyCD(keys: string[]) {
        const exhaustedKeys = this.context.globalState.get<{ [key: string]: number }>('exhaustedApiKeys', {}) || {};
        let changed = false;
        for (const key of keys) {
            if (exhaustedKeys[key]) {
                delete exhaustedKeys[key];
                changed = true;
            }
        }
        if (changed) {
            await this.context.globalState.update('exhaustedApiKeys', exhaustedKeys);
            vscode.window.showInformationMessage(`🔄 已重置該提供者所有金鑰的冷卻狀態。`);
            this.sendProviders();
        }
    }

    private getWebviewContent(): string {
        return ProviderHtml.getHtml();
    }
}
