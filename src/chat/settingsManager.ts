import * as vscode from 'vscode';
import { SettingsHtml } from './webview/settingsHtml';
import { getLang, t, LocaleStrings } from '../utils/locale';

export class SettingsManagerPanel {
    public static readonly viewType = 'bwsCoder.settingsPanel';
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public show(): void {
        const lang = getLang();
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            SettingsManagerPanel.viewType,
            t(lang, 'set_title'),
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'saveSettings':
                    await this.saveSettings(message.config, message.showNote);
                    break;
                case 'resetDefaults':
                    await this.resetDefaults();
                    break;
            }
        });

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    public refreshLocale(): void {
        if (this.panel) {
            const lang = getLang();
            this.panel.title = t(lang, 'set_title');
            this.panel.webview.postMessage({
                command: 'updateLocale',
                i18n: this.getI18nBundle(lang)
            });
        }
    }

    private async saveSettings(config: any, showNote: boolean = true) {
        const target = vscode.ConfigurationTarget.Global;
        const bwsConfig = vscode.workspace.getConfiguration('bwsCoder');
        
        const tasks = Object.keys(config).map(key => 
            bwsConfig.update(key, config[key], target)
        );
        
        await Promise.all(tasks);
        
        if (showNote) {
            const lang = getLang();
            vscode.window.showInformationMessage(t(lang, 'set_msgSaved'));
        }
    }

    private async resetDefaults() {
        const target = vscode.ConfigurationTarget.Global;
        const bwsConfig = vscode.workspace.getConfiguration('bwsCoder');
        const properties = [
            'temperature', 'maxTokens', 'language', 'debugMode',
            'saveRawStream', 'saveAiRequest', 'groupChatMaxRounds',
            'maxTurnsPerStep', 'heartbeatTimeout', 'autoFallback',
            'maxMemoryBudget', 'topP', 'topK'
        ];
        
        const tasks = properties.map(key => bwsConfig.update(key, undefined, target));
        await Promise.all(tasks);
        
        // Refresh UI
        if (this.panel) {
            this.panel.webview.html = this.getWebviewContent();
        }
        
        const lang = getLang();
        vscode.window.showInformationMessage(t(lang, 'set_msgSaved'));
    }

    private getWebviewContent(): string {
        const lang = getLang();
        const bwsConfig = vscode.workspace.getConfiguration('bwsCoder');
        const config = {
            temperature: bwsConfig.get('temperature', 0.3),
            maxTokens: bwsConfig.get('maxTokens', 4096),
            language: bwsConfig.get('language', 'en'),
            debugMode: bwsConfig.get('debugMode', false),
            saveRawStream: bwsConfig.get('saveRawStream', false),
            saveAiRequest: bwsConfig.get('saveAiRequest', false),
            groupChatMaxRounds: bwsConfig.get('groupChatMaxRounds', 0),
            maxTurnsPerStep: bwsConfig.get('maxTurnsPerStep', 30),
            heartbeatTimeout: bwsConfig.get('heartbeatTimeout', 30),
            autoFallback: bwsConfig.get('autoFallback', false),
            maxMemoryBudget: bwsConfig.get('maxMemoryBudget', 5000),
            topP: bwsConfig.get('topP', 0.95),
            topK: bwsConfig.get('topK', 64)
        };
        
        return SettingsHtml.getHtml(this.getI18nBundle(lang), config);
    }

    private getI18nBundle(lang: string) {
        const bundle: any = {};
        const keys: (keyof LocaleStrings)[] = [
            'set_title', 'set_temperature', 'set_temperature_desc',
            'set_topP', 'set_topP_desc', 'set_topK', 'set_topK_desc',
            'set_maxTokens', 'set_maxTokens_desc', 'set_language', 'set_language_desc',
            'set_debugMode', 'set_debugMode_desc', 'set_saveRawStream', 'set_saveRawStream_desc',
            'set_saveAiRequest', 'set_saveAiRequest_desc', 'set_groupChatMaxRounds', 'set_groupChatMaxRounds_desc',
            'set_maxTurnsPerStep', 'set_maxTurnsPerStep_desc', 'set_heartbeatTimeout', 'set_heartbeatTimeout_desc',
            'set_autoFallback', 'set_autoFallback_desc', 
            'set_maxMemoryBudget', 'set_maxMemoryBudget_desc',
            'set_btnSave', 'set_btnReset'
        ];
        keys.forEach(k => { bundle[k] = t(lang, k); });
        return bundle;
    }
}
