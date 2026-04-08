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
export const getFileOpRegex = () => new RegExp(`<tool_call>[\\s\\S]*?<name>(${FILE_OP_ACTIONS})</name>[\\s\\S]*?<path>([^<]*?)</path>[\\s\\S]*?</tool_call>`, 'gi');
export const getEofRegex = () => new RegExp(`</tool_call>`, 'gi');
export const getReplaceOldRegex = () => new RegExp(`${PATTERN_REPLACE_OLD}[ \\t]*\\r?\\n?`, 'im');
export const getReplaceDivRegex = () => new RegExp(`</search>\\s*<replace>`, 'im');
export const getReplaceNewRegex = () => new RegExp(`</replace>[ \\t]*\\r?\\n?`, 'im');

/**
 * matches: only block operations that contain code content (create, write, modify, replace, delete, execute, read)
 * Used by MemoryManager for pruning contents of successful operations.
 * Group 1: action, Group 2: path, Group 3: full internal content
 */
export const getPruneBlockRegex = () => new RegExp(`<tool_call>\\s*<name>(create|write|modify|replace|read|delete|execute)</name>[\\s\\S]*?<path>([^<]*?)</path>([\\s\\S]*?)</tool_call>`, 'gi');

/**
 * Used by MemoryManager to quickly check if a message contains any action.
 */
export const getHasActionRegex = () => new RegExp(`<tool_call>[\\s\\S]*?<name>(${FILE_OP_ACTIONS})</name>`, 'i');
