import { MessageBlock } from '../historyManager';
import { FILE_OP_ACTIONS, findToolCallStart, TAG_TOOL_CALL_END } from '../constants';
import { extractTag, unescapeXml } from '../../utils/xmlUtils';
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
                const toolCallInfo = findToolCallStart(this.buffer);
                const thoughtIdx = this.buffer.indexOf('<|channel>thought');

                if (thoughtIdx !== -1 && (!toolCallInfo || thoughtIdx < toolCallInfo.index)) {
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
                } else if (toolCallInfo) {
                    this.appendToSpeak(this.buffer.substring(0, toolCallInfo.index));
                    this.buffer = this.buffer.substring(toolCallInfo.index + toolCallInfo.length); // consume start tag
                    
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
                const endTagIndex = this.buffer.indexOf(TAG_TOOL_CALL_END);
                
                if (endTagIndex !== -1) {
                    const innerStr = this.buffer.substring(0, endTagIndex);
                    this.currentActionBlock!.content += innerStr;
                    this.buffer = this.buffer.substring(endTagIndex + TAG_TOOL_CALL_END.length);
                    
                    this.finalizeToolCall(this.currentActionBlock!);
                    this.currentActionBlock!.isClosed = true;
                    readyOps.push(this.currentActionBlock!);
                    
                    this.currentActionBlock = null;
                    this.state = 'TEXT';
                } else {
                    // Peek ahead to grab name and path early for UI rendering while streaming
                    if (this.currentActionBlock!.action === 'pending' || !this.currentActionBlock!.filePath || !this.currentActionBlock!.toolCallId) {
                        const name = extractTag(this.buffer, 'name');
                        if (name) this.currentActionBlock!.action = name.toLowerCase();
                        
                        const id = extractTag(this.buffer, 'tool_call_id');
                        if (id) this.currentActionBlock!.toolCallId = id;
                        
                        const path = extractTag(this.buffer, 'path');
                        const cmd = extractTag(this.buffer, 'command');
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

    private finalizeToolCall(block: MessageBlock) {
        // Parse the inner XML properly for the final UI
        const innerXml = block.content || '';
        
        const name = extractTag(innerXml, 'name');
        if (name) block.action = name.toLowerCase();

        const id = extractTag(innerXml, 'tool_call_id');
        if (id) block.toolCallId = id;

        const path = extractTag(innerXml, 'path');
        const cmd = extractTag(innerXml, 'command');
        block.filePath = path || cmd || '';

        let realContent = '';
        if (['create', 'write', 'modify'].includes(block.action || '')) {
            realContent = extractTag(innerXml, 'content') || '';
        } else if (block.action === 'replace') {
            const search = extractTag(innerXml, 'search') || '';
            const replace = extractTag(innerXml, 'replace') || '';
            realContent = `<search>\n${search}\n</search>\n<replace>\n${replace}\n</replace>`;
        } else if (block.action === 'read') {
            const startStr = extractTag(innerXml, 'start_line');
            const endStr = extractTag(innerXml, 'end_line');
            if (startStr) {
                const start = startStr;
                const end = endStr || start;
                block.filePath += `#L${start}-${end}`;
            }
            realContent = block.filePath || '';
        } else if (block.action === 'execute') {
            realContent = block.filePath || '';
        }
        block.content = unescapeXml(stripMarkdownCodeBlocks(realContent));
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
