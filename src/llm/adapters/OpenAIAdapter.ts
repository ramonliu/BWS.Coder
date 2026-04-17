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
        maxTokens?: number,
        topP?: number,
        topK?: number
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
        // [2026-04-17] Multimodal Support - Transform last user message to content blocks if images exist
        const body: any = {
            model,
            messages: roleCorrectedMessages.map((m, idx) => {
                const isLast = idx === roleCorrectedMessages.length - 1;
                if (isLast && m.role === 'user' && images && images.length > 0) {
                    const contentBlocks: any[] = [{ type: 'text', text: m.content }];
                    images.forEach(img => {
                        // Ensure data URI prefix if missing (OpenAI requires it)
                        const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
                        contentBlocks.push({ type: 'image_url', image_url: { url } });
                    });
                    return { role: m.role, content: contentBlocks };
                }
                return { role: m.role, content: m.content };
            }),
            stream: true
        };

        // [2026-03-30] Fix OpenRouter 400 Bad Request: 
        // 1. o1 and o3-mini models do not support `temperature` (must be 1 or omitted) and `max_tokens`
        const isReasoningModel = model.toLowerCase().includes('o1-') || model.toLowerCase().includes('o3-');

        if (!isReasoningModel) {
            if (options.temperature !== undefined) body.temperature = options.temperature;
            if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
            if (options.topP !== undefined) body.top_p = options.topP;
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
        const chunk = json.choices?.[0]?.delta || json.choices?.[0]?.message;
        
        if (chunk?.content) res.content = chunk.content;
        
        // 擷取各種廠牌或 Proxy 對應的 thinking 欄位
        if (chunk?.reasoning_content) res.thinking = chunk.reasoning_content;
        else if (chunk?.thinking) res.thinking = chunk.thinking;
        else if (chunk?.reasoning) res.thinking = chunk.reasoning; // 支援 gpt-oss-120b
        
        return res;
    }
}
