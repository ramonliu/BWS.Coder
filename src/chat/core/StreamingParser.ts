import { MessageBlock } from '../historyManager';
import { FILE_OP_ACTIONS, PATTERN_OP_EOF } from '../constants';
import { stripMarkdownCodeBlocks } from '../fileOperations';

type ParserState = 'TEXT' | 'TAG' | 'CONTENT' | 'XML_HEADER' | 'XML_CONTENT' | 'XML_FOOTER';

/**
 * StreamingParser - A robust state-machine based scanner for AI output streams.
 * [2026-03-31] [Parser-Behavior-Driven] - Refactored to trigger on [@@ then check behavior (action).
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

    public pushChunk(chunk: string): MessageBlock[] {
        this.buffer += chunk;
        const readyOps: MessageBlock[] = [];
        this.scan(readyOps);
        return readyOps;
    }

    public close(): MessageBlock[] {
        const readyOps: MessageBlock[] = [];
        if (this.buffer) {
            if (this.state === 'TEXT' || this.state === 'XML_FOOTER') {
                if (this.state === 'TEXT') this.appendToSpeak(this.buffer);
            } else if (this.state === 'TAG') {
                this.processFullTag(this.buffer, readyOps);
            } else if (this.state === 'CONTENT' || this.state === 'XML_CONTENT') {
                this.currentActionBlock!.content += this.buffer;
            }
            this.buffer = '';
        }

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
        const validActions = FILE_OP_ACTIONS.split('|');

        while (this.buffer.length > 0) {
            if (this.state === 'TEXT') {
                const tagStartIndex = this.buffer.indexOf('[@@');
                const xmlMatch = this.buffer.match(/<(?:[a-z0-9_-]+:)?tool_call>/i);
                const xmlStartIndex = xmlMatch ? xmlMatch.index! : -1;

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
                    const lastOpenBracket = this.buffer.lastIndexOf('[');
                    const lastAngleBracket = this.buffer.lastIndexOf('<');
                    let holdBack = 0;
                    if (lastOpenBracket !== -1 && this.buffer.length - lastOpenBracket < 5) holdBack = this.buffer.length - lastOpenBracket;
                    if (lastAngleBracket !== -1 && this.buffer.length - lastAngleBracket < 30) holdBack = Math.max(holdBack, this.buffer.length - lastAngleBracket);
                    
                    const flushLength = this.buffer.length - holdBack;
                    if (flushLength > 0) {
                        this.appendToSpeak(this.buffer.substring(0, flushLength));
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                } else {
                    if (!isXml) {
                        // Action-Strict Check
                        const afterTag = this.buffer.substring(startIndex + 3).trimStart().toLowerCase();
                        // wait for enough data to identify behavior
                        if (afterTag.length < 10 && !afterTag.includes('@@')) {
                            this.appendToSpeak(this.buffer.substring(0, startIndex));
                            this.buffer = this.buffer.substring(startIndex);
                            break; 
                        }

                        const behaviorMatch = afterTag.match(/^([a-z-]+)\s*(:|\{|\@\@)/i);
                        if (behaviorMatch) {
                            const actionName = behaviorMatch[1];
                            if (validActions.includes(actionName) || actionName === 'eof') {
                                this.appendToSpeak(this.buffer.substring(0, startIndex));
                                this.buffer = this.buffer.substring(startIndex + 3);
                                this.state = 'TAG';
                                continue;
                            }
                        }
                        // Not a command behavior, treat as text
                        this.appendToSpeak(this.buffer.substring(0, startIndex + 3));
                        this.buffer = this.buffer.substring(startIndex + 3);
                    } else {
                        this.appendToSpeak(this.buffer.substring(0, startIndex));
                        this.buffer = this.buffer.substring(startIndex + xmlMatch![0].length);
                        this.state = 'XML_HEADER';
                    }
                }
            } else if (this.state === 'TAG') {
                const tagEndIndex = this.buffer.indexOf('@@'); 
                if (tagEndIndex === -1) {
                    if (this.buffer.length > 500) {
                        this.appendToSpeak('[@@' + this.buffer);
                        this.buffer = '';
                        this.state = 'TEXT';
                    }
                    break; 
                } else {
                    let consumeLen = 2;
                    if (this.buffer.length > tagEndIndex + 2 && this.buffer[tagEndIndex + 2] === ']') {
                        consumeLen = 3;
                    }
                    const tagFull = this.buffer.substring(0, tagEndIndex);
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
                const match = this.buffer.match(/<\/parameter>\s*(?:<\/(?:function|invoke)>|<parameter(?:=| name=")(?:content|text)"?\s*>)/i);
                if (match) {
                    const headerStr = this.buffer.substring(0, match.index! + match[0].length);
                    const actionMatch = headerStr.match(/<(?:function|invoke)(?:=| name=")([^>"]+)/i);
                    const pathMatch = headerStr.match(/<parameter(?:=| name=")(?:path|commandline|command)"?>(.*?)<\/parameter>/si);
                    
                    if (actionMatch && pathMatch) {
                        const action = actionMatch[1].trim().toLowerCase();
                        const filePath = pathMatch[1].trim();
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
                const match = this.buffer.match(/<\/(?:[a-z0-9_-]+:)?tool_call>/i);
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

    private processFullTag(inner: string, readyOps: MessageBlock[]) {
        const trimmed = inner.trim().toLowerCase();
        
        // Handle EOF behavior first
        if (trimmed === 'eof' && this.currentActionBlock) {
            this.currentActionBlock.isClosed = true;
            readyOps.push(this.currentActionBlock);
            this.currentActionBlock = null;
            this.state = 'TEXT';
            return;
        }

        const colonIndex = inner.indexOf(':');
        if (colonIndex === -1) {
            this.appendToSpeak('[@@' + inner + '@@]');
            this.state = 'TEXT';
            return;
        }

        let action = inner.substring(0, colonIndex).trim().toLowerCase();
        if (action.includes('{')) {
            action = action.split('{')[0].trim();
        }
        const filePath = inner.substring(colonIndex + 1).trim();
        const validActions = FILE_OP_ACTIONS.split('|');

        if (!validActions.includes(action)) {
            this.appendToSpeak('[@@' + inner + '@@]');
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
