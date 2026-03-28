import { ILLMAdapter, LLMMessage } from '../types';

export class OllamaAdapter implements ILLMAdapter {
    id = 'ollama';

    isCloud(): boolean { return false; }

    getRotationKeys() {
        return {
            config: 'ollama.apiKeys', // Ollama 通常不需 Key，此處僅為相容性
            index: 'lastUsedOllamaIndex',
            name: 'Ollama'
        };
    }

    prepareRequest(messages: LLMMessage[], images: string[] | undefined, options: { 
        keys: string[], 
        currentIndex: number, 
        model: string, 
        endpoint: string,
        temperature?: number,
        maxTokens?: number
    }) {
        const { model, endpoint } = options;
        const url = `${endpoint.replace(/\/+$/, '')}/api/chat`;

        // [2026-03-25] [Parameter Injection Fix] - Inject temperature and num_predict from global settings.
        const body: any = {
            model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            stream: true,
            options: {}
        };
        if (options.temperature !== undefined) body.options.temperature = options.temperature;
        if (options.maxTokens !== undefined) body.options.num_predict = options.maxTokens;

        return {
            url,
            body,
            headers: { 'Content-Type': 'application/json' }
        };
    }

    extractResponse(json: any) {
        return { content: json.message?.content || '' };
    }
}
