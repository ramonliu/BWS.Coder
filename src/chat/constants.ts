// Centralized Regex Patterns for File Operations (XML Tool Call Edition)
export const FILE_OP_ACTIONS = 'create|write|modify|replace|delete|execute|read';

// Tool Call Block Regex
export const PATTERN_TOOL_CALL = `<tool_call>[\\s\\S]*?</tool_call>`;

// Internal tags for replace operation (XML)
export const PATTERN_REPLACE_OLD = `<search>`;
export const PATTERN_REPLACE_NEW = `<replace>`;

/**
 * matches: <tool_call> ...
 * Used anywhere that needs to quickly find tool call starts.
 */
export const getFileOpRegex = () => new RegExp(`<tool_call>[\\s\\S]*?<name>\\s*(${FILE_OP_ACTIONS})\\s*</name>[\\s\\S]*?<path>\\s*([^<]*?)\\s*</path>[\\s\\S]*?</tool_call>`, 'gi');
export const getEofRegex = () => new RegExp(`</tool_call>`, 'gi');
export const getReplaceOldRegex = () => new RegExp(`${PATTERN_REPLACE_OLD}\\s*`, 'im');
export const getReplaceDivRegex = () => new RegExp(`</search>\\s*<replace>`, 'im');
export const getReplaceNewRegex = () => new RegExp(`</replace>\\s*`, 'im');


/**
 * Used by MemoryManager to quickly check if a message contains any action.
 */
export const getHasActionRegex = () => new RegExp(`<tool_call>[\\s\\S]*?<name>\\s*(${FILE_OP_ACTIONS})\\s*</name>`, 'i');

