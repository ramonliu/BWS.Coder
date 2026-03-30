import { ILLMAdapter, LLMMessage } from '../types';
import { ensureMandatoryRoles } from '../utils';

export class OpenAIAdapter implements ILLMAdapter {
    id = 'openai';

    isCloud(): boolean { return true; }

    getRotationKeys() {
        return {
            config: 'ollama.apiKeys', // 歷史遺留命名，實為 OpenAI Key
            index: 'lastUsedOpenAIKeyIndex',
            name: 'OpenAI'
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
        const { model } = options;
        const roleCorrectedMessages = ensureMandatoryRoles(messages);

        let endpoint = options.endpoint.replace(/\/+$/, '');
        if (endpoint.endsWith('/chat/completions')) {
            endpoint = endpoint.substring(0, endpoint.length - 17);
        } else if (endpoint.endsWith('/chat')) {
            endpoint = endpoint.substring(0, endpoint.length - 5);
        }

        if (!endpoint.includes('/v1')) {
            endpoint = `${endpoint}/v1`;
        }
        const url = `${endpoint}/chat/completions`;

        // [2026-03-25] [Parameter Injection Fix] - Inject temperature and max_tokens from global settings.
        const body: any = {
            model,
            messages: roleCorrectedMessages.map(m => ({ role: m.role, content: m.content })),
            stream: true
        };

        // [2026-03-30] Fix OpenRouter 400 Bad Request: 
        // 1. o1 and o3-mini models do not support `temperature` (must be 1 or omitted) and `max_tokens`
        const isReasoningModel = model.toLowerCase().includes('o1-') || model.toLowerCase().includes('o3-');

        if (!isReasoningModel) {
            if (options.temperature !== undefined) body.temperature = options.temperature;
            if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
        }

        return {
            url,
            body,
            headers: {
                'Content-Type': 'application/json',
                'X-OpenRouter-Title': 'BWS.Coder',
                'HTTP-Referer': 'https://github.com/ramonliu/BWS.Coder'
            }
        };
    }

    extractResponse(json: any) {
        const res: { content?: string, thinking?: string } = {};
        if (json.choices?.[0]?.delta?.content) res.content = json.choices[0].delta.content;
        if (json.choices?.[0]?.delta?.reasoning_content) res.thinking = json.choices[0].delta.reasoning_content;
        else if (json.choices?.[0]?.delta?.thinking) res.thinking = json.choices[0].delta.thinking;
        return res;
    }
}
