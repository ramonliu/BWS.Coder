// Centralized Regex Patterns for File Operations
export const FILE_OP_ACTIONS = 'create|write|modify|replace|delete|execute|read';
// [2026-03-30] [Bugfix-TagStripping] - Refine regex to be more robust against truncated or slightly malformed tags 
// (Removed dangerous single-bracket `]` delimiter to avoid clashing with commands like [math])
export const PATTERN_OP_START = `\\[@@\\s*(${FILE_OP_ACTIONS})(?:\\{[^\\}]*\\})?:\\s*([^\\r\\n]+?)(?:\\s*@@\\]?|\\s*$)`;
export const PATTERN_OP_EOF = `\\[@@\\s*eof\\s*@@\\]?`;

// [2026-03-30] [Replace-Regex] - Internal tags for replace operation
export const PATTERN_REPLACE_OLD = `\\[@@<@@\\]?`;
export const PATTERN_REPLACE_DIV = `\\[@@=@@\\]?`;
export const PATTERN_REPLACE_NEW = `\\[@@>@@\\]?`;

/**
 * matches: [@@ action:path @@]
 * group 1 = action, group 2 = filePath
 */
export const getFileOpRegex = () => new RegExp(PATTERN_OP_START, 'g');
export const getEofRegex = () => new RegExp(PATTERN_OP_EOF, 'gi');
export const getReplaceOldRegex = () => new RegExp(`^${PATTERN_REPLACE_OLD}[ \\t]*\\r?\\n?`, 'im');
export const getReplaceDivRegex = () => new RegExp(`^${PATTERN_REPLACE_DIV}[ \\t]*\\r?\\n?`, 'im');
export const getReplaceNewRegex = () => new RegExp(`^${PATTERN_REPLACE_NEW}[ \\t]*\\r?\\n?`, 'im');

/**
 * matches: [@@ action:path @@] content [@@ eof @@] 
 * Used by messageRenderer to parse blocks for UI components.
 * [2026-03-30] Robustified with the same logic as the start tag.
 */
export const getRenderBlockRegex = () => new RegExp(`${PATTERN_OP_START}([\\s\\S]*?)(?:\\[@@\\s*eof\\s*@@\\]?|(?=\\[@@\\s*(?:${FILE_OP_ACTIONS}):)|$)`, 'g');

/**
 * matches: only block operations that contain code content (create, write, modify, replace)
 * Used by MemoryManager for pruning contents of successful operations.
 */
export const getPruneBlockRegex = () => new RegExp(`\\[@@\\s*(create|write|modify|replace):\\s*(.*?)(?:\\s*@@\\]?|\\s*$)([\\s\\S]*?)\\[@@\\s*eof\\s*@@\\]?`, 'g');

/**
 * Used by MemoryManager to quickly check if a message contains any action.
 */
export const getHasActionRegex = () => new RegExp(`\\[@@\\s*(${FILE_OP_ACTIONS}):`);
