import { ILLMAdapter, LLMMessage } from '../types';
import { ensureMandatoryRoles } from '../utils';

export class GeminiAdapter implements ILLMAdapter {
    id = 'gemini';

    isCloud(): boolean { return true; }

    getRotationKeys() {
        return {
            config: 'gemini.apiKeys',
            index: 'lastUsedGeminiKeyIndex',
            name: 'Gemini'
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
        const { keys, currentIndex, model } = options;
        const key = keys[currentIndex];
        // [2026-03-26] [Fix Gemini API Key Auth] - Remove key from URL and use x-goog-api-key header for security
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
        
        const roleCorrectedMessages = ensureMandatoryRoles(messages);
        const contents = roleCorrectedMessages.map(m => {
            const parts: any[] = [{ text: m.content }];
            // 只有最後一則 user message 附帶圖片
            if (m.role === 'user' && images && images.length > 0 && messages.indexOf(m) === messages.length - 1) {
                images.forEach(img => {
                    const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
                    if (match) {
                        parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
                    }
                });
            }
            return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        });

        // [2026-03-25] [Parameter Injection Fix] - Inject temperature and maxOutputTokens from global settings.
        const generationConfig: any = {};
        if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
        if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
        if (options.topP !== undefined) generationConfig.topP = options.topP;
        if (options.topK !== undefined) generationConfig.topK = options.topK;

        return {
            url,
            body: { 
                contents,
                generationConfig
            },
            // [2026-03-26] [Fix Gemini API Key Auth] - Add x-goog-api-key explicitly
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': key
            }
        };
    }

    extractResponse(json: any) {
        return { content: json.candidates?.[0]?.content?.parts?.[0]?.text || '' };
    }
}
