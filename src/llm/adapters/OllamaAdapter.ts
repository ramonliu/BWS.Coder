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
        maxTokens?: number,
        topP?: number,
        topK?: number
    }) {
        const { model, endpoint } = options;
        const url = `${endpoint.replace(/\/+$/, '')}/api/chat`;

        // [2026-03-25] [Parameter Injection Fix] - Inject temperature and num_predict from global settings.
        // [2026-04-17] Multimodal Support - Inject images into the last user message if present
        const body: any = {
            model,
            messages: messages.map((m, idx) => {
                const isLast = idx === messages.length - 1;
                const msgObj: any = { role: m.role, content: m.content };
                if (isLast && m.role === 'user' && images && images.length > 0) {
                    msgObj.images = images.map(img => {
                        // Ollama expects raw base64 without the "data:image/...;base64," prefix
                        return img.includes('base64,') ? img.split('base64,')[1] : img;
                    });
                }
                return msgObj;
            }),
            stream: true,
            options: {}
        };
        if (options.temperature !== undefined) body.options.temperature = options.temperature;
        if (options.maxTokens !== undefined) body.options.num_predict = options.maxTokens;
        if (options.topP !== undefined) body.options.top_p = options.topP;
        if (options.topK !== undefined) body.options.top_k = options.topK;

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
