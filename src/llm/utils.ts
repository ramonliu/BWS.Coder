import { LLMMessage } from './types';

/**
 * 確保訊息清單中同時包含 system, user, assistant 三種角色。
 * 這是為了符合某些 API Gateway 或特定模型（如 Gemini）的嚴格要求。
 */
export function ensureMandatoryRoles(messages: LLMMessage[]): LLMMessage[] {
    const hasSystem = messages.some(m => m.role === 'system');
    const hasUser = messages.some(m => m.role === 'user');
    const hasAssistant = messages.some(m => m.role === 'assistant');

    if (hasSystem && hasUser && hasAssistant) return messages;

    const result = [...messages];
    
    // 1. 確保有 System
    if (!hasSystem) {
        result.unshift({ role: 'system', content: 'You are a helpful AI assistant and an expert software engineer.' });
    }

    // 2. 確保有 User 與 Assistant
    const stillHasUser = result.some(m => m.role === 'user');
    const stillHasAssistant = result.some(m => m.role === 'assistant');

    if (stillHasUser && !stillHasAssistant) {
        // 有 User 沒 Assistant：在第一個 User 前插入一對握手
        const firstUserIdx = result.findIndex(m => m.role === 'user');
        result.splice(firstUserIdx, 0, 
            { role: 'user', content: 'Hello.' },
            { role: 'assistant', content: 'Hello! I am your AI engineering agent. I understand my instructions and am ready to assist you autonomously.' }
        );
    } else if (!stillHasUser && stillHasAssistant) {
        // 有 Assistant 沒 User：在第一個 Assistant 前插入一個 User
        const firstAsstIdx = result.findIndex(m => m.role === 'assistant');
        result.splice(firstAsstIdx, 0, { role: 'user', content: 'Please help me with my request.' });
    } else if (!stillHasUser && !stillHasAssistant) {
        // 兩者皆無：直接補齊
        result.push({ role: 'user', content: 'Hello.' });
        result.push({ role: 'assistant', content: 'Hello! I am ready to assist.' });
        result.push({ role: 'user', content: 'Please follow my instructions.' });
    }

    return result;
}
