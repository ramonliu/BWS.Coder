import { MessageBlock } from '../historyManager';
import { FILE_OP_ACTIONS, PATTERN_OP_EOF } from '../constants';
import { stripMarkdownCodeBlocks } from '../fileOperations';

type ParserState = 'TEXT' | 'TAG' | 'CONTENT' | 'XML_HEADER' | 'XML_CONTENT' | 'XML_FOOTER';

// [2026-03-30] [XML-ToolCall] - Add support for XML tool_calls
// e.g., <tool_call><function=...><parameter=path>...</parameter>...

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
            if (this.state === 'TEXT' || this.state === 'XML_FOOTER') {
                if (this.state === 'TEXT') this.appendToSpeak(this.buffer);
            } else if (this.state === 'TAG') {
                // AI stopped mid-tag? Try process what we have
                this.processFullTag(this.buffer, readyOps, true);
            } else if (this.state === 'CONTENT' || this.state === 'XML_CONTENT') {
                // AI stopped without eof? Force close
                this.currentActionBlock!.content += this.buffer;
            }
            this.buffer = '';
        }

        // Final cleanup of open action blocks
        if ((this.state === 'CONTENT' || this.state === 'XML_CONTENT') && this.currentActionBlock) {
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
                const xmlStartIndex = this.buffer.indexOf('<tool_call>');

                let foundMatch = false;
                let isXml = false;
                let startIndex = -1;

                if (tagStartIndex !== -1 && xmlStartIndex !== -1) {
                    isXml = xmlStartIndex < tagStartIndex;
                    startIndex = isXml ? xmlStartIndex : tagStartIndex;
                    foundMatch = true;
                } else if (tagStartIndex !== -1) {
                    startIndex = tagStartIndex;
                    foundMatch = true;
                } else if (xmlStartIndex !== -1) {
                    isXml = true;
                    startIndex = xmlStartIndex;
                    foundMatch = true;
                }

                if (!foundMatch) {
                    // Only hold back if the buffer ends with a potential tag start
                    const lastOpenBracket = this.buffer.lastIndexOf('[');
                    const lastAngleBracket = this.buffer.lastIndexOf('<');
                    let holdBack = 0;
                    if (lastOpenBracket !== -1 && this.buffer.length - lastOpenBracket < 5) holdBack = this.buffer.length - lastOpenBracket;
                    if (lastAngleBracket !== -1 && this.buffer.length - lastAngleBracket < 15) holdBack = Math.max(holdBack, this.buffer.length - lastAngleBracket);
                    
                    const flushLength = this.buffer.length - holdBack;
                    if (flushLength > 0) {
                        this.appendToSpeak(this.buffer.substring(0, flushLength));
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                } else {
                    // Flush text before tag
                    this.appendToSpeak(this.buffer.substring(0, startIndex));
                    this.buffer = this.buffer.substring(startIndex + (isXml ? 11 : 3)); // 11 for <tool_call>, 3 for [@@
                    this.state = isXml ? 'XML_HEADER' : 'TAG';
                }
            } else if (this.state === 'TAG') {
                const tagEndIndex = this.buffer.indexOf('@@', 3); // skips starting '@@' if any
                if (tagEndIndex === -1) {
                    // Tag might be very long or contain brackets.
                    if (this.buffer.length > 1000 || (this.buffer.includes('\n') && this.buffer.length > 500)) {
                        this.appendToSpeak(this.buffer);
                        this.buffer = '';
                        this.state = 'TEXT';
                    }
                    break; // Wait for more data
                } else {
                    let consumeLen = 2;
                    if (this.buffer.length > tagEndIndex + 2 && this.buffer[tagEndIndex + 2] === ']') {
                        consumeLen = 3;
                    }
                    const tagFull = this.buffer.substring(0, tagEndIndex + consumeLen);
                    this.buffer = this.buffer.substring(tagEndIndex + consumeLen);
                    this.processFullTag(tagFull, readyOps);
                }
            } else if (this.state === 'CONTENT') {
                const eofRegex = new RegExp(PATTERN_OP_EOF, 'i');
                const eofMatch = this.buffer.match(eofRegex);

                if (eofMatch) {
                    const matchIndex = eofMatch.index!;
                    const contentBefore = this.buffer.substring(0, matchIndex);
                    this.currentActionBlock!.content += contentBefore;
                    this.currentActionBlock!.content = stripMarkdownCodeBlocks(this.currentActionBlock!.content || '');
                    this.currentActionBlock!.isClosed = true;
                    readyOps.push(this.currentActionBlock!);
                    
                    this.buffer = this.buffer.substring(matchIndex + eofMatch[0].length);
                    this.currentActionBlock = null;
                    this.state = 'TEXT';
                } else {
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
            } else if (this.state === 'XML_HEADER') {
                const match = this.buffer.match(/<\/parameter>\s*(?:<\/function>|<parameter(?:=| name=")content"?\s*>)/i);
                if (match) {
                    const headerStr = this.buffer.substring(0, match.index! + match[0].length);
                    const actionMatch = headerStr.match(/<function(?:=| name=")([^>"]+)/i);
                    const pathMatch = headerStr.match(/<parameter(?:=| name=")path"?>(.*?)<\/parameter>/si);
                    
                    if (actionMatch && pathMatch) {
                        const action = actionMatch[1].trim().toLowerCase();
                        const filePath = pathMatch[1].trim();
                        const validActions = FILE_OP_ACTIONS.split('|');
                        
                        if (validActions.includes(action)) {
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
                            
                            this.buffer = this.buffer.substring(match.index! + match[0].length);
                            if (this.currentActionBlock.isClosed) {
                                readyOps.push(this.currentActionBlock);
                                this.state = 'XML_FOOTER';
                            } else {
                                this.state = 'XML_CONTENT';
                            }
                            continue;
                        }
                    }
                    // Invalid XML action or path, discard
                    this.appendToSpeak(headerStr);
                    this.buffer = this.buffer.substring(match.index! + match[0].length);
                    this.state = 'TEXT';
                } else if (this.buffer.length > 1000) {
                    this.appendToSpeak(this.buffer);
                    this.buffer = '';
                    this.state = 'TEXT';
                } else {
                    break;
                }
            } else if (this.state === 'XML_CONTENT') {
                const match = this.buffer.match(/<\/parameter>/i);
                if (match) {
                    const matchIndex = match.index!;
                    const contentBefore = this.buffer.substring(0, matchIndex);
                    this.currentActionBlock!.content += contentBefore;
                    this.currentActionBlock!.content = stripMarkdownCodeBlocks(this.currentActionBlock!.content || '');
                    this.currentActionBlock!.isClosed = true;
                    readyOps.push(this.currentActionBlock!);
                    
                    this.buffer = this.buffer.substring(matchIndex + match[0].length);
                    this.currentActionBlock = null;
                    this.state = 'XML_FOOTER';
                } else {
                    const lastAngle = this.buffer.lastIndexOf('<');
                    const holdBackLen = (lastAngle !== -1 && (this.buffer.length - lastAngle) < 15) ? (this.buffer.length - lastAngle) : 0;
                    const flushLength = this.buffer.length - holdBackLen;
                    if (flushLength > 0) {
                        this.currentActionBlock!.content += this.buffer.substring(0, flushLength);
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                }
            } else if (this.state === 'XML_FOOTER') {
                const match = this.buffer.match(/<\/tool_call>/i);
                if (match) {
                    this.buffer = this.buffer.substring(match.index! + match[0].length);
                    this.state = 'TEXT';
                } else if (this.buffer.length > 200) {
                    this.state = 'TEXT';
                    this.buffer = '';
                } else {
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
