import * as vscode from 'vscode';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ILLMAdapter {
  id: string;
  isCloud(): boolean;
  getRotationKeys(): { config: string, index: string, name: string };
  prepareRequest(messages: LLMMessage[], images: string[] | undefined, options: { 
    keys: string[], 
    currentIndex: number, 
    model: string, 
    endpoint: string,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
    topK?: number
  }): { url: string, body: any, headers: any };
  extractResponse(json: any): { content?: string, thinking?: string };
}

export interface ILLMClient {
  chat(
    messages: LLMMessage[],
    onProgress?: (chunk: { content?: string, thinking?: string }) => void | Promise<void>,
    onFirstChunk?: (info?: { provider: string, model: string, keyIndex?: number }) => void | Promise<void>,
    cancellationToken?: vscode.CancellationToken,
    images?: string[],
    dumpPath?: string,
    providerId?: string,
    taskName?: string
  ): AsyncGenerator<{ content?: string, thinking?: string }>;
  
  generate(
    prompt: string,
    onProgress?: (chunk: { content?: string, thinking?: string }) => void | Promise<void>,
    cancellationToken?: vscode.CancellationToken
  ): AsyncGenerator<{ content?: string, thinking?: string }>;
  
  getModels(): Promise<any[]>;
  testConnection(): Promise<boolean>;
  getModelName(): string;
  getProviderName(): string;
  getProviderId(): string;
  isCloudProvider(): boolean;
  isExhausted(): Promise<boolean>;
}
