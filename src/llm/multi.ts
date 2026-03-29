import * as vscode from 'vscode';
import { ILLMClient, LLMMessage } from './types';
import { ProviderConfig } from '../chat/providerManager';
import { UniversalLLMClient } from './UniversalLLMClient';
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
    onFirstChunk?: () => void | Promise<void>,
    cancellationToken?: vscode.CancellationToken,
    images?: string[],
    dumpPath?: string,
    providerId?: string,
    taskName?: string
  ): AsyncGenerator<{ content?: string, thinking?: string }> {
    const clients = this.getActiveClients();
    let lastError: any = null;
    let fallbackTriggered = false;

    if (clients.length === 0) {
      throw new Error('請先在 Provider Manager 中啟用至少一個 AI 提供者');
    }

    const config = vscode.workspace.getConfiguration('bwsCoder');
    const autoFallback = config.get<boolean>('autoFallback') ?? false;

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
      try {
        if (i > 0 && autoFallback && !fallbackTriggered) {
          // [2026-03-29] [Fix-Fallback-Visibility] - Notify user about switching even if onProgress is undefined
          yield { content: `\n[系統通知: 優先服務失敗，正在切換至備援服務...]` };
          fallbackTriggered = true;
        }

        const generator = client.chat(messages, onProgress, onFirstChunk, cancellationToken, images, dumpPath, undefined, taskName);
        for await (const chunk of generator) {
          if (cancellationToken?.isCancellationRequested) break;
          yield chunk;
        }

        // 成功：記住這次用的 provider，下次從這裡開始
        await this.context.globalState.update('lastSuccessfulClientIndex', clientIndex);
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`[MultiLLM] 客戶端 ${clientIndex} 錯誤:`, error);

        // 如果不允許自動換 LLM，則在第一個失敗時就跳出
        if (!autoFallback) break;

        if (i < clients.length - 1) {
          if (cancellationToken?.isCancellationRequested) throw error;
          continue;
        }
      }
    }
    throw lastError || new Error('所有 AI 服務皆無法連線');
  }

  async* generate(
    prompt: string,
    onProgress?: (chunk: { content?: string, thinking?: string }) => void | Promise<void>,
    cancellationToken?: vscode.CancellationToken
  ): AsyncGenerator<{ content?: string, thinking?: string }> {
    yield* this.chat([{ role: 'user', content: prompt }], onProgress, undefined, cancellationToken);
  }
}
