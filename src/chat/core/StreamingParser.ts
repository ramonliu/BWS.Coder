import { MessageBlock } from '../historyManager';
import { FILE_OP_ACTIONS, PATTERN_OP_EOF } from '../constants';
import { stripMarkdownCodeBlocks } from '../fileOperations';

type ParserState = 'TEXT' | 'TAG' | 'CONTENT';

/**
 * StreamingParser - A robust state-machine based scanner for AI output streams.
 * [2026-03-30] [Parser-Refactor-StateMachine] - Replaced Regex with scanner to avoid bracket issues (like [math]).
 */
export class StreamingParser {
    private blocks: MessageBlock[] = [];
    private state: ParserState = 'TEXT';
    private buffer: string = '';
    private currentActionBlock: MessageBlock | null = null;
    private generateId: () => string;

    constructor(generateId: () => string) {
        this.generateId = generateId;
    }

    public getBlocks(): MessageBlock[] {
        return this.blocks;
    }

    /**
     * Feed a network stream chunk into the parser.
     */
    public pushChunk(chunk: string): MessageBlock[] {
        this.buffer += chunk;
        const readyOps: MessageBlock[] = [];
        this.scan(readyOps);
        return readyOps;
    }

    /**
     * Call this when the stream entirely finishes to flush the remaining buffer.
     */
    public close(): MessageBlock[] {
        const readyOps: MessageBlock[] = [];
        
        // Handle remaining buffer at EOF
        if (this.buffer) {
            if (this.state === 'TEXT') {
                this.appendToSpeak(this.buffer);
            } else if (this.state === 'TAG') {
                // AI stopped mid-tag? Try process what we have
                this.processFullTag(this.buffer, readyOps, true);
            } else if (this.state === 'CONTENT') {
                // AI stopped without eof? Force close
                this.currentActionBlock!.content += this.buffer;
            }
            this.buffer = '';
        }

        // Final cleanup of open action blocks
        if (this.state === 'CONTENT' && this.currentActionBlock) {
            this.currentActionBlock.content = stripMarkdownCodeBlocks(this.currentActionBlock.content || '');
            this.currentActionBlock.isClosed = true;
            readyOps.push(this.currentActionBlock);
            this.currentActionBlock = null;
            this.state = 'TEXT';
        }

        return readyOps;
    }

    private scan(readyOps: MessageBlock[]) {
        while (this.buffer.length > 0) {
            if (this.state === 'TEXT') {
                const tagStartIndex = this.buffer.indexOf('[@@');
                if (tagStartIndex === -1) {
                    // Only hold back if the buffer ends with a potential tag start
                    const match = this.buffer.match(/\[@?$/);
                    const holdBack = match ? match[0].length : 0;
                    
                    const flushLength = this.buffer.length - holdBack;
                    if (flushLength > 0) {
                        this.appendToSpeak(this.buffer.substring(0, flushLength));
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                } else {
                    // Flush text before tag
                    this.appendToSpeak(this.buffer.substring(0, tagStartIndex));
                    this.buffer = this.buffer.substring(tagStartIndex);
                    this.state = 'TAG';
                }
            } else if (this.state === 'TAG') {
                const tagEndIndex = this.buffer.indexOf('@@', 3); // 3 skips '[@@'
                if (tagEndIndex === -1) {
                    // Tag might be very long or contain brackets.
                    // But if it's way too long without closure, it's likely just talking.
                    if (this.buffer.length > 1000 || (this.buffer.includes('\n') && this.buffer.length > 500)) {
                        this.appendToSpeak(this.buffer);
                        this.buffer = '';
                        this.state = 'TEXT';
                    }
                    break; // Wait for more data
                } else {
                    // Check if it's followed by ']'
                    let consumeLen = 2;
                    if (this.buffer.length > tagEndIndex + 2 && this.buffer[tagEndIndex + 2] === ']') {
                        consumeLen = 3;
                    }
                    const tagFull = this.buffer.substring(0, tagEndIndex + consumeLen);
                    this.buffer = this.buffer.substring(tagEndIndex + consumeLen);
                    this.processFullTag(tagFull, readyOps);
                }
            } else if (this.state === 'CONTENT') {
                // In CONTENT mode, we look for [@@ eof @@]
                const eofRegex = new RegExp(PATTERN_OP_EOF, 'i');
                const eofMatch = this.buffer.match(eofRegex);

                if (eofMatch) {
                    const matchIndex = eofMatch.index!;
                    const contentBefore = this.buffer.substring(0, matchIndex);
                    this.currentActionBlock!.content += contentBefore;
                    // Fix content once closed
                    this.currentActionBlock!.content = stripMarkdownCodeBlocks(this.currentActionBlock!.content || '');
                    this.currentActionBlock!.isClosed = true;
                    readyOps.push(this.currentActionBlock!);
                    
                    this.buffer = this.buffer.substring(matchIndex + eofMatch[0].length);
                    this.currentActionBlock = null;
                    this.state = 'TEXT';
                } else {
                    // Only hold back if the buffer ends with something that could be the start of PATTERN_OP_EOF
                    // [@@ eof @@] is about 15 chars max. We look for '[' near the end.
                    const lastOpenBracket = this.buffer.lastIndexOf('[');
                    const holdBackLen = (lastOpenBracket !== -1 && (this.buffer.length - lastOpenBracket) < 20)
                        ? (this.buffer.length - lastOpenBracket)
                        : 0;

                    const flushLength = this.buffer.length - holdBackLen;
                    if (flushLength > 0) {
                        this.currentActionBlock!.content += this.buffer.substring(0, flushLength);
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                }
            }
        }
    }

    private processFullTag(rawTag: string, readyOps: MessageBlock[], isFinal: boolean = false) {
        // Strip [@@ and @@] or @@
        let inner = rawTag.trim();
        if (inner.startsWith('[@@')) inner = inner.substring(3);
        if (inner.endsWith('@@]')) inner = inner.substring(0, inner.length - 3);
        else if (inner.endsWith('@@')) inner = inner.substring(0, inner.length - 2);

        // Find first colon to split action and path
        const colonIndex = inner.indexOf(':');
        if (colonIndex === -1) {
            // Not a valid tag format, revert to text
            this.appendToSpeak(rawTag);
            this.state = 'TEXT';
            return;
        }

        let action = inner.substring(0, colonIndex).trim().toLowerCase();
        // [2026-03-30] [Parser-Metadata-Support] - Handle optional metadata in curly braces (e.g. execute{Out-String}: ...)
        if (action.includes('{')) {
            action = action.split('{')[0].trim();
        }

        const filePath = inner.substring(colonIndex + 1).trim();

        // Validate action
        const validActions = FILE_OP_ACTIONS.split('|');
        if (!validActions.includes(action)) {
            this.appendToSpeak(rawTag);
            this.state = 'TEXT';
            return;
        }

        this.currentActionBlock = {
            id: this.generateId(),
            type: 'action',
            action,
            filePath,
            content: '',
            isPending: true,
            isClosed: (action === 'read' || action === 'execute' || action === 'delete')
        };
        this.blocks.push(this.currentActionBlock);

        if (this.currentActionBlock.isClosed) {
            readyOps.push(this.currentActionBlock);
            this.state = 'TEXT';
        } else {
            this.state = 'CONTENT';
        }
    }

    private appendToSpeak(text: string) {
        if (!text) return;
        const lastBlock = this.blocks.length > 0 ? this.blocks[this.blocks.length - 1] : null;
        if (lastBlock && lastBlock.type === 'speak') {
            lastBlock.text += text;
        } else {
            this.blocks.push({
                id: this.generateId(),
                type: 'speak',
                text
            });
        }
    }
}
