// Centralized Tags for File Operations (XML Tool Call Edition)
export const FILE_OP_ACTIONS = 'create|write|modify|replace|delete|execute|read';

// Tool Call Start/End Tags
export const TAG_TOOL_CALL_START = '<tool_call>';
export const TAG_TOOL_CALL_START_ALT = '<|tool_call>call';
export const TAG_TOOL_CALL_END = '</tool_call>';

export const TAG_SEARCH_START = '<search>';
export const TAG_SEARCH_END = '</search>';
export const TAG_REPLACE_START = '<replace>';
export const TAG_REPLACE_END = '</replace>';

/**
 * [2026-04-16] Non-Regex Tool Call Detection
 */
export function findToolCallStart(text: string, fromIndex: number = 0): { index: number, length: number } | null {
    const idx1 = text.indexOf(TAG_TOOL_CALL_START, fromIndex);
    const idx2 = text.indexOf(TAG_TOOL_CALL_START_ALT, fromIndex);

    if (idx1 !== -1 && (idx2 === -1 || idx1 < idx2)) {
        return { index: idx1, length: TAG_TOOL_CALL_START.length };
    } else if (idx2 !== -1) {
        return { index: idx2, length: TAG_TOOL_CALL_START_ALT.length };
    }
    return null;
}

/**
 * Checks if a string contains any tool call action.
 */
export function hasToolCall(text: string): boolean {
    return findToolCallStart(text) !== null;
}

