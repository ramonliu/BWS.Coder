// Centralized Regex Patterns for File Operations
export const FILE_OP_ACTIONS = 'create|write|modify|replace|delete|execute|read';
// [2026-03-27] [Fix-Parsing] - Make the trailing bracket `]` optional just in case AI drops it (e.g. `[@@ create:C:\path\to\file @@\n`)
export const PATTERN_OP_START = `\\[@@\\s*(${FILE_OP_ACTIONS}):\\s*([^\\r\\n]+?)\\s*@@\\]?`;

/**
 * matches: [@@ action:path @@]
 * group 1 = action, group 2 = filePath
 */
export const getFileOpRegex = () => new RegExp(PATTERN_OP_START, 'g');

/**
 * matches: [@@ action:path @@] content [@@ eof @@]
 * Used by messageRenderer to parse blocks for UI components.
 */
export const getRenderBlockRegex = () => new RegExp(`${PATTERN_OP_START}([\\s\\S]*?)(?:\\[@@\\s*eof\\s*@@\\]?|(?=\\[@@\\s*(?:${FILE_OP_ACTIONS}):)|$)`, 'g');

/**
 * matches: only block operations that contain code content (create, write, modify, replace)
 * Used by MemoryManager for pruning contents of successful operations.
 */
export const getPruneBlockRegex = () => new RegExp(`\\[@@\\s*(create|write|modify|replace):\\s*(.*?)\\s*@@\\]?([\\s\\S]*?)\\[@@\\s*eof\\s*@@\\]?`, 'g');

/**
 * Used by MemoryManager to quickly check if a message contains any action.
 */
export const getHasActionRegex = () => new RegExp(`\\[@@\\s*(${FILE_OP_ACTIONS}):`);
