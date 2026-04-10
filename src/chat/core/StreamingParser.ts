import { MessageBlock } from '../historyManager';
import { FILE_OP_ACTIONS } from '../constants';
import { stripMarkdownCodeBlocks } from '../fileOperations';

type ParserState = 'TEXT' | 'TOOL_CALL' | 'THOUGHT';

/**
 * StreamingParser - A robust state-machine based scanner for AI output streams.
 * Refactored for XML <tool_call> protocol.
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
        if (readyOps.length > 0) {
            console.log(`[PARSER:streaming] emitted ${readyOps.length} op(s):`, readyOps.map(o => `${o.action}:${o.filePath}`));
        }
        return readyOps;
    }

    public close(): MessageBlock[] {
        const readyOps: MessageBlock[] = [];
        console.log(`[PARSER:close] called. state=${this.state}, bufferLen=${this.buffer.length}`);
        
        if (this.buffer) {
            if (this.state === 'TEXT') {
                this.appendToSpeak(this.buffer);
            } else if (this.state === 'TOOL_CALL' && this.currentActionBlock) {
                this.currentActionBlock.content += this.buffer;
            } else if (this.state === 'THOUGHT') {
                this.appendToThink(this.buffer);
            }
            this.buffer = '';
        }

        if (this.state === 'TOOL_CALL' && this.currentActionBlock) {
            this.finalizeToolCall(this.currentActionBlock);
            this.currentActionBlock.isClosed = true;
            readyOps.push(this.currentActionBlock);
            this.currentActionBlock = null;
            this.state = 'TEXT';
        } else if (this.state === 'THOUGHT') {
            const lastBlock = this.blocks[this.blocks.length - 1];
            if (lastBlock && lastBlock.type === 'think') {
                lastBlock.isPending = false;
                lastBlock.isClosed = true;
            }
            this.state = 'TEXT';
        }
        
        return readyOps;
    }

    private scan(readyOps: MessageBlock[]) {
        while (this.buffer.length > 0) {
            if (this.state === 'TEXT') {
                const toolCallIdx = this.buffer.indexOf('<tool_call>');
                const thoughtIdx = this.buffer.indexOf('<|channel>thought');

                if (thoughtIdx !== -1 && (toolCallIdx === -1 || thoughtIdx < toolCallIdx)) {
                    this.appendToSpeak(this.buffer.substring(0, thoughtIdx));
                    this.buffer = this.buffer.substring(thoughtIdx + 17); // consume '<|channel>thought'
                    
                    this.blocks.push({
                        id: this.generateId(),
                        type: 'think',
                        text: '',
                        isPending: true,
                        isClosed: false
                    });
                    this.state = 'THOUGHT';
                } else if (toolCallIdx !== -1) {
                    this.appendToSpeak(this.buffer.substring(0, toolCallIdx));
                    this.buffer = this.buffer.substring(toolCallIdx + 11); // consume '<tool_call>'
                    
                    this.currentActionBlock = {
                        id: this.generateId(),
                        type: 'action',
                        action: 'pending',
                        filePath: '',
                        content: '',
                        isPending: true,
                        isClosed: false
                    };
                    this.blocks.push(this.currentActionBlock);
                    this.state = 'TOOL_CALL';
                } else {
                    const fallbackIndex = this.buffer.lastIndexOf('<');
                    const holdBack = (fallbackIndex !== -1 && (this.buffer.length - fallbackIndex) < 18) ? (this.buffer.length - fallbackIndex) : 0;
                    const flushLength = this.buffer.length - holdBack;
                    
                    if (flushLength > 0) {
                        this.appendToSpeak(this.buffer.substring(0, flushLength));
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                }
            } else if (this.state === 'THOUGHT') {
                const endTagIdx = this.buffer.indexOf('<channel|>');
                if (endTagIdx !== -1) {
                    this.appendToThink(this.buffer.substring(0, endTagIdx));
                    this.buffer = this.buffer.substring(endTagIdx + 10); // consume '<channel|>'
                    
                    const lastBlock = this.blocks[this.blocks.length - 1];
                    if (lastBlock && lastBlock.type === 'think') {
                        lastBlock.isPending = false;
                        lastBlock.isClosed = true;
                    }
                    this.state = 'TEXT';
                } else {
                    const fallbackIndex = this.buffer.lastIndexOf('<');
                    const holdBack = (fallbackIndex !== -1 && (this.buffer.length - fallbackIndex) < 12) ? (this.buffer.length - fallbackIndex) : 0;
                    const flushLength = this.buffer.length - holdBack;
                    
                    if (flushLength > 0) {
                        this.appendToThink(this.buffer.substring(0, flushLength));
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                }
            } else if (this.state === 'TOOL_CALL') {
                const endTagIndex = this.buffer.indexOf('</tool_call>');
                
                if (endTagIndex !== -1) {
                    const innerStr = this.buffer.substring(0, endTagIndex);
                    this.currentActionBlock!.content += innerStr;
                    this.buffer = this.buffer.substring(endTagIndex + 12);
                    
                    this.finalizeToolCall(this.currentActionBlock!);
                    this.currentActionBlock!.isClosed = true;
                    readyOps.push(this.currentActionBlock!);
                    
                    this.currentActionBlock = null;
                    this.state = 'TEXT';
                } else {
                    // Peek ahead to grab name and path early for UI rendering while streaming
                    if (this.currentActionBlock!.action === 'pending' || !this.currentActionBlock!.filePath || !this.currentActionBlock!.toolCallId) {
                        const name = this.extractTag(this.buffer, 'name');
                        if (name) this.currentActionBlock!.action = name.toLowerCase();
                        
                        const id = this.extractTag(this.buffer, 'tool_call_id');
                        if (id) this.currentActionBlock!.toolCallId = id;
                        
                        const path = this.extractTag(this.buffer, 'path');
                        const cmd = this.extractTag(this.buffer, 'command');
                        if (path) this.currentActionBlock!.filePath = path;
                        else if (cmd) this.currentActionBlock!.filePath = cmd;
                    }

                    const fallbackIndex = this.buffer.lastIndexOf('<');
                    const holdBack = (fallbackIndex !== -1 && (this.buffer.length - fallbackIndex) < 15) ? (this.buffer.length - fallbackIndex) : 0;
                    const flushLength = this.buffer.length - holdBack;

                    if (flushLength > 0) {
                        this.currentActionBlock!.content += this.buffer.substring(0, flushLength);
                        this.buffer = this.buffer.substring(flushLength);
                    }
                    break;
                }
            }
        }
    }

    /**
     * [2026-04-10] Robust Tag Extraction - Replaces Regex with manual string parsing.
     * Supports "Lazy Closing" where the closing tag is omitted but the parent is closed.
     */
    private extractTag(source: string, tagName: string): string | null {
        const startTag = `<${tagName}>`;
        const startIdx = source.toLowerCase().indexOf(startTag.toLowerCase());
        if (startIdx === -1) return null;

        const contentStartIdx = startIdx + startTag.length;
        const endTag = `</${tagName}>`;
        const endIdx = source.toLowerCase().indexOf(endTag.toLowerCase(), contentStartIdx);

        if (endIdx === -1) {
            // No closing tag found? Take everything until the end of the source.
            // This handles LLM "lazy closing" behavior at the end of a block.
            return source.substring(contentStartIdx).trim();
        }

        return source.substring(contentStartIdx, endIdx).trim();
    }

    private finalizeToolCall(block: MessageBlock) {
        // Parse the inner XML properly for the final UI
        const innerXml = block.content || '';
        
        const name = this.extractTag(innerXml, 'name');
        if (name) block.action = name.toLowerCase();

        const id = this.extractTag(innerXml, 'tool_call_id');
        if (id) block.toolCallId = id;

        const path = this.extractTag(innerXml, 'path');
        const cmd = this.extractTag(innerXml, 'command');
        block.filePath = path || cmd || '';

        let realContent = '';
        if (['create', 'write', 'modify'].includes(block.action || '')) {
            realContent = this.extractTag(innerXml, 'content') || '';
        } else if (block.action === 'replace') {
            const search = this.extractTag(innerXml, 'search') || '';
            const replace = this.extractTag(innerXml, 'replace') || '';
            realContent = `<search>\n${search}\n</search>\n<replace>\n${replace}\n</replace>`;
        } else if (block.action === 'read') {
            const startStr = this.extractTag(innerXml, 'start_line');
            const endStr = this.extractTag(innerXml, 'end_line');
            if (startStr) {
                const start = startStr;
                const end = endStr || start;
                block.filePath += `#L${start}-${end}`;
            }
            realContent = block.filePath || '';
        } else if (block.action === 'execute') {
            realContent = block.filePath || '';
        }
        
        block.content = stripMarkdownCodeBlocks(realContent);
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

    private appendToThink(text: string) {
        if (!text) return;
        const lastBlock = this.blocks.length > 0 ? this.blocks[this.blocks.length - 1] : null;
        if (lastBlock && lastBlock.type === 'think') {
            lastBlock.text += text;
        } else {
            this.blocks.push({
                id: this.generateId(),
                type: 'think',
                text,
                isPending: true,
                isClosed: false
            });
        }
    }
}
