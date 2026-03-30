import * as vscode from 'vscode';
import axios from 'axios';
import { ILLMClient, LLMMessage, ILLMAdapter } from './types';
import { ProviderConfig } from '../chat/providerManager';
import { processStream } from './streamHandler';

export class UniversalLLMClient implements ILLMClient {
    constructor(
        protected context: vscode.ExtensionContext, 
        protected config: ProviderConfig,
        protected adapter: ILLMAdapter
    ) {}

    getProviderId(): string { return this.config.id || this.adapter.id; }
    getProviderName(): string { return this.config.name || this.adapter.id; }
    getModelName(): string { return this.config.model; }
    isCloudProvider(): boolean { return this.adapter.isCloud(); }

    async testConnection(): Promise<boolean> {
        try {
            const { config: configKey } = this.adapter.getRotationKeys();
            const keys = this.getApiKeys(configKey);
            const { url, body, headers } = this.adapter.prepareRequest([], undefined, {
                keys,
                currentIndex: 0,
                model: this.config.model,
                endpoint: this.config.endpoint
            });
            await axios.post(url, body, { 
                headers: this.buildHeaders(keys[0], headers), 
                timeout: 5000 
            });
            return true;
        } catch { return false; }
    }

    private buildHeaders(key: string, adapterHeaders: any): any {
        // [2026-03-26] [Fix Gemini API Key Auth] - Prevent injecting dummy Bearer Token if x-goog-api-key exists
        const skipBearer = !!adapterHeaders['x-goog-api-key'];
        return {
            ...adapterHeaders,
            ...(key && !adapterHeaders['Authorization'] && !skipBearer ? { 'Authorization': `Bearer ${key}` } : {})
        };
    }

    async getModels(): Promise<any[]> {
        return [{ name: this.config.model }];
    }

    async isExhausted(): Promise<boolean> {
        const { config: configKey } = this.adapter.getRotationKeys();
        const keys = this.getApiKeys(configKey);
        if (keys.length === 0) return false;
        const exhaustedKeys = this.context.globalState.get<{ [key: string]: number }>('exhaustedApiKeys', {}) || {};
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        return keys.every(k => !!exhaustedKeys[k] && (now - exhaustedKeys[k] < ONE_DAY));
    }

    private getApiKeys(configKey: string): string[] {
        if (this.config.apiKeys && this.config.apiKeys.length > 0) return this.config.apiKeys;
        const config = vscode.workspace.getConfiguration('bwsCoder');
        const keys = config.get<any>(configKey);
        if (Array.isArray(keys)) return keys.filter(k => typeof k === 'string' && k.trim()).map(k => k.trim());
        return [''];
    }

    async *chat(
        messages: LLMMessage[],
        onProgress?: (chunk: { content?: string, thinking?: string }) => void | Promise<void>,
        onFirstChunk?: (info?: { provider: string, model: string, keyIndex?: number }) => void | Promise<void>,
        cancellationToken?: vscode.CancellationToken,
        images?: string[],
        dumpPath?: string,
        providerId?: string,
        taskName?: string
    ): AsyncGenerator<{ content?: string, thinking?: string }> {
        const { config: configKey, index: indexKey, name: providerName } = this.adapter.getRotationKeys();
        const keys = this.getApiKeys(configKey);
        const startIndex = this.context.globalState.get<number>(indexKey, 0) || 0;
        
        // 清理過期 Key
        let exhaustedKeys = this.context.globalState.get<{ [key: string]: number }>('exhaustedApiKeys', {}) || {};
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        let changed = false;
        for (const k in exhaustedKeys) {
            if (now - exhaustedKeys[k] > ONE_DAY) { delete exhaustedKeys[k]; changed = true; }
        }
        if (changed) await this.context.globalState.update('exhaustedApiKeys', exhaustedKeys);

        if (keys.every(k => !!exhaustedKeys[k])) {
            throw new Error(`所有 ${providerName} API Key 皆已耗盡並進入 1 天冷卻期`);
        }

        let lastError: any = null;
        let triedAny = false;

        for (let i = 0; i < keys.length; i++) {
            const currentIndex = (startIndex + i) % keys.length;
            const key = keys[currentIndex];
            if (exhaustedKeys[key]) continue;
            triedAny = true;

            try {
                const configVsc = vscode.workspace.getConfiguration('bwsCoder');
                const temperature = configVsc.get<number>('temperature');
                const maxTokens = configVsc.get<number>('maxTokens');

                const { url, body, headers } = this.adapter.prepareRequest(messages, images, {
                    keys,
                    currentIndex,
                    model: this.config.model,
                    endpoint: this.config.endpoint,
                    temperature,
                    maxTokens
                });

                console.info(`[${providerName}] >>> 發送請求至: ${url} (Key 組: ${currentIndex + 1})`);
                
                let isCloud = this.adapter.isCloud();
                const endpoint = this.config.endpoint.toLowerCase();
                const isLocal = endpoint.includes('localhost') || 
                               endpoint.includes('127.0.0.1') || 
                               endpoint.includes('192.168.') || 
                               endpoint.includes('10.') || 
                               endpoint.includes('172.');
                
                if (isLocal) isCloud = false;

                const response = await axios.post(url, body, {
                    responseType: 'stream',
                    timeout: isCloud ? 120000 : 600000, // 雲端 2 分鐘，地端放寬至 10 分鐘以利 Heartbeat 運作
                    headers: this.buildHeaders(key, headers),
                    cancelToken: cancellationToken ? new axios.CancelToken(c => cancellationToken.onCancellationRequested(() => c())) : undefined
                });

                const generator = processStream(response.data, {
                    onProgress,
                    onFirstChunk: () => {
                        if (onFirstChunk) onFirstChunk({ provider: this.getProviderName(), model: this.config.model, keyIndex: currentIndex });
                    },
                    cancellationToken,
                    providerName: this.getProviderName(),
                    providerId: providerId || this.adapter.id,
                    isCloud: isCloud,
                    dumpPath,
                    taskName,
                    extractor: (json) => this.adapter.extractResponse(json)
                });

                yield* generator;
                
                await this.context.globalState.update(indexKey, currentIndex);
                return;
            } catch (error: any) {
                lastError = error;
                // [2026-03-26] [APIKeyLoopFix] - Abort immediately without rotating keys if the error is a user cancellation
                if (cancellationToken?.isCancellationRequested || axios.isCancel(error) || error.name === 'AbortError') {
                    throw error;
                }
                
                if (error.response?.status === 429) {
                    exhaustedKeys[key] = Date.now();
                    await this.context.globalState.update('exhaustedApiKeys', exhaustedKeys);
                }
                if (i < keys.length - 1 && (!error.response || error.response.status === 401 || error.response.status === 429)) {
                    continue;
                }

                // [2026-03-30] Extract API error message from stream when failing (e.g. 400 Bad Request)
                if (error.response?.data && typeof error.response.data.on === 'function') {
                    try {
                        const errData = await new Promise<string>((resolve) => {
                            let data = '';
                            error.response.data.on('data', (chunk: any) => data += chunk);
                            error.response.data.on('end', () => resolve(data));
                            error.response.data.on('error', () => resolve(''));
                        });
                        const parsed = JSON.parse(errData);
                        const msg = parsed?.error?.message || parsed?.message || errData;
                        lastError = new Error(`API 拒絕請求 (${error.response.status}): ${msg}`);
                    } catch (e) {
                        // ignore parsing error
                    }
                }

                break;
            }
        }
        if (!triedAny) throw new Error(`所有 ${providerName} API Key 都在冷卻中`);
        throw lastError || new Error(`${providerName} 錯誤: ${lastError?.message || '未知錯誤'}`);
    }

    async *generate(prompt: string, onProgress?: any, ct?: any): AsyncGenerator<{ content?: string, thinking?: string }> {
        yield* this.chat([{ role: 'user', content: prompt }], onProgress, undefined, ct);
    }
}
