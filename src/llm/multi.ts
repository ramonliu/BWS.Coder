import * as vscode from 'vscode';
import { ILLMClient, LLMMessage } from './types';
import { ProviderConfig } from '../chat/providerManager';
import { UniversalLLMClient } from './UniversalLLMClient';
import { t, getLang } from '../utils/locale';
import { GeminiAdapter } from './adapters/GeminiAdapter';
import { OpenAIAdapter } from './adapters/OpenAIAdapter';
import { OllamaAdapter } from './adapters/OllamaAdapter';

export class MultiLLMClient implements ILLMClient {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 動態獲取當前所有「已啟用」的客戶端
   */
  public getActiveClients(): ILLMClient[] {
    const clients: ILLMClient[] = [];
    const providers = this.context.globalState.get<ProviderConfig[]>('bwsCoder.providers') || [];

    providers.forEach(p => {
      if (p.enabled !== false) {
        const isGemini = p.endpoint.includes('googleapis.com') || p.name.toLowerCase().includes('gemini');
        const isOllama = p.endpoint.includes('ollama.com');

        if (isGemini) {
          clients.push(new UniversalLLMClient(this.context, p, new GeminiAdapter()));
        } else if (isOllama) {
          clients.push(new UniversalLLMClient(this.context, p, new OllamaAdapter()));
        } else {
          clients.push(new UniversalLLMClient(this.context, p, new OpenAIAdapter()));
        }
      }
    });

    // 如果沒自定義，則看傳統設定
    if (clients.length === 0) {
      const config = vscode.workspace.getConfiguration('bwsCoder');

      // 檢查 Gemini 是否有 Key
      const geminiKeys = config.get<any>('gemini.apiKeys');
      const hasGemini = Array.isArray(geminiKeys) ? geminiKeys.some(k => k) : !!geminiKeys;

      if (hasGemini) {
        clients.push(new UniversalLLMClient(this.context, { id: 'gemini', name: 'Gemini', endpoint: '', model: config.get<string>('gemini.model') || 'gemini-1.5-pro', enabled: true, apiKeys: [] }, new GeminiAdapter()));
      }
      clients.push(new UniversalLLMClient(this.context, { id: 'ollama', name: 'Ollama', endpoint: config.get<string>('ollama.endpoint') || 'http://localhost:11434', model: config.get<string>('ollama.model') || 'codestral', enabled: true, apiKeys: [] }, new OllamaAdapter()));
    }

    return clients;
  }

  public getAvailableProviders(): { id: string, name: string }[] {
    const providers = this.context.globalState.get<ProviderConfig[]>('bwsCoder.providers') || [];
    return providers.filter(p => p.enabled !== false).map(p => ({ id: p.name, name: p.name }));
  }

  public getProviderById(id: string): ILLMClient | undefined {
    const clients = this.getActiveClients();
    return clients.find(c => c.getProviderId() === id || c.getProviderName() === id || c.getModelName() === id);
  }

  async testConnection(): Promise<boolean> {
    const clients = this.getActiveClients();
    for (const client of clients) {
      if (await client.testConnection()) return true;
    }
    return false;
  }

  async getModels(): Promise<any[]> {
    const clients = this.getActiveClients();
    for (const client of clients) {
      try {
        const models = await client.getModels();
        if (models && models.length > 0) return models;
      } catch (e) { }
    }
    return [];
  }

  getModelName(): string {
    const clients = this.getActiveClients();
    return clients.length > 0 ? clients[0].getModelName() : 'unknown';
  }

  getProviderName(): string {
    return '[system: connecting...]';
  }
  getProviderId(): string {
    const clients = this.getActiveClients();
    return clients.length > 0 ? clients[0].getProviderId() : 'default';
  }

  async isExhausted(): Promise<boolean> {
    const clients = this.getActiveClients();
    if (clients.length === 0) return true;
    for (const c of clients) {
      if (!(await c.isExhausted())) return false;
    }
    return true;
  }

  isCloudProvider(): boolean {
    const clients = this.getActiveClients();
    return clients.length > 0 ? clients[0].isCloudProvider() : false;
  }

  async* chat(
    messages: LLMMessage[],
    onProgress?: (chunk: { content?: string, thinking?: string }) => void | Promise<void>,
    // [2026-03-30] Fix - 對齊 UniversalLLMClient 的型別，切換後能即時更新 UI 顯示的 provider 名稱
    onFirstChunk?: (info?: { provider: string, model: string, keyIndex?: number }) => void | Promise<void>,
    cancellationToken?: vscode.CancellationToken,
    images?: string[],
    dumpPath?: string,
    providerId?: string,
    taskName?: string
  ): AsyncGenerator<{ content?: string, thinking?: string }> {
    const clients = this.getActiveClients();
    let lastError: any = null;
    let switchCount = 0;

    // [2026-03-30] Universal Localization - Final Touches Phase 7
    if (clients.length === 0) {
      throw new Error(t(getLang(), 'err_noActiveProviders'));
    }

    const config = vscode.workspace.getConfiguration('bwsCoder');
    // [2026-03-30] Fix - 預設改為 true，讓自動切換預設開啟，無需手動設定
    const autoFallback = config.get<boolean>('autoFallback') ?? true;

    // 如果指定了 providerId，優先尋找該 provider
    let startIndex = 0;
    if (providerId && providerId !== 'default') {
      const foundIndex = clients.findIndex(c => c.getModelName() === providerId || c.getProviderName() === providerId);
      if (foundIndex !== -1) startIndex = foundIndex;
    } else {
      const lastSuccessfulIndex = this.context.globalState.get<number>('lastSuccessfulClientIndex', 0);
      startIndex = Math.min(lastSuccessfulIndex, clients.length - 1);
    }

    for (let i = 0; i < clients.length; i++) {
      const clientIndex = (startIndex + i) % clients.length;
      const client = clients[clientIndex];

      // [2026-03-30] Fix - 預先偵測 API Keys 是否已用光，直接跳過，不等 error
      if (await client.isExhausted()) {
        console.log(`[MultiLLM] 客戶端 ${clientIndex} (${client.getProviderName()}) Keys 已耗盡，跳過`);
        if (!autoFallback) {
          // [2026-03-30] UX Fix - 當備援沒打勾時，給出明確錯誤說明
          throw new Error(t(getLang(), 'err_fallbackExhausted', client.getProviderName()));
        }
        continue;
      }

      try {
        if (i > 0) {
          // [2026-03-30] Fix - 每次切換都清楚公告，避免 switchCount > 0 時靜默失敗
          const nextName = client.getProviderName();
          const actionMsg = switchCount === 0 ? t(getLang(), 'msg_switchingFallback') : t(getLang(), 'msg_fallbackFailed');
          yield { content: `\n\n> [BWS.Coder] ${actionMsg} **${nextName}** ...\n\n` };
          switchCount++;
        }

        const generator = client.chat(messages, onProgress, onFirstChunk, cancellationToken, images, dumpPath, undefined, taskName);
        for await (const chunk of generator) {
          if (cancellationToken?.isCancellationRequested) {
            throw new Error('ABORTED');
          }
          yield chunk;
        }

        // 成功：記住這次用的 provider，下次從這裡開始
        await this.context.globalState.update('lastSuccessfulClientIndex', clientIndex);
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`[MultiLLM] 客戶端 ${clientIndex} 錯誤:`, error);
        
        // [2026-03-30] 若錯誤包含被放棄的關鍵字，則一併記錄到對話
        if (error.message) {
             yield { content: `> ⚠️ **${client.getProviderName()}** ${t(getLang(), 'err_connectionFailed')}: ${error.message}\n\n` };
        }

        // [2026-03-30] UX Fix - 當不允許自動換 LLM 時，附上原因拋出
        if (!autoFallback) {
          throw new Error(`${t(getLang(), 'err_fallbackExhausted', client.getProviderName())} (${error.message || String(error)})`);
        }

        if (i < clients.length - 1) {
          if (cancellationToken?.isCancellationRequested) throw error;
          continue;
        }
      }
    }
    throw lastError || new Error(t(getLang(), 'err_allExhausted'));
  }

  async* generate(
    prompt: string,
    onProgress?: (chunk: { content?: string, thinking?: string }) => void | Promise<void>,
    cancellationToken?: vscode.CancellationToken
  ): AsyncGenerator<{ content?: string, thinking?: string }> {
    yield* this.chat([{ role: 'user', content: prompt }], onProgress, undefined, cancellationToken);
  }
}
