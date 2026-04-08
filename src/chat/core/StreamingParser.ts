import { MessageBlock } from '../historyManager';
import { FILE_OP_ACTIONS } from '../constants';
import { stripMarkdownCodeBlocks } from '../fileOperations';

type ParserState = 'TEXT' | 'TOOL_CALL';

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
            }
            this.buffer = '';
        }

        if (this.state === 'TOOL_CALL' && this.currentActionBlock) {
            this.finalizeToolCall(this.currentActionBlock);
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
                const tagStartIndex = this.buffer.indexOf('<tool_call>');
                if (tagStartIndex !== -1) {
                    this.appendToSpeak(this.buffer.substring(0, tagStartIndex));
                    this.buffer = this.buffer.substring(tagStartIndex + 11); // consume '<tool_call>'
                    
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
                    const holdBack = (fallbackIndex !== -1 && (this.buffer.length - fallbackIndex) < 12) ? (this.buffer.length - fallbackIndex) : 0;
                    const flushLength = this.buffer.length - holdBack;
                    
                    if (flushLength > 0) {
                        this.appendToSpeak(this.buffer.substring(0, flushLength));
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
                    if (this.currentActionBlock!.action === 'pending' || !this.currentActionBlock!.filePath) {
                        const nameMatch = this.buffer.match(/<name>\s*(.*?)\s*<\/name>/i);
                        if (nameMatch) this.currentActionBlock!.action = nameMatch[1].toLowerCase();
                        
                        const pathMatch = this.buffer.match(/<path>\s*(.*?)\s*<\/path>/i);
                        const cmdMatch = this.buffer.match(/<command>\s*(.*?)\s*<\/command>/i);
                        if (pathMatch) this.currentActionBlock!.filePath = pathMatch[1];
                        else if (cmdMatch) this.currentActionBlock!.filePath = cmdMatch[1];
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
        
        const nameMatch = /<name>\s*(.*?)\s*<\/name>/i.exec(innerXml);
        if (nameMatch) block.action = nameMatch[1].toLowerCase();

        const pathMatch = /<path>\s*(.*?)\s*<\/path>/i.exec(innerXml);
        const cmdMatch = /<command>\s*(.*?)\s*<\/command>/i.exec(innerXml);
        block.filePath = pathMatch ? pathMatch[1] : (cmdMatch ? cmdMatch[1] : '');

        let realContent = '';
        if (['create', 'write', 'modify'].includes(block.action || '')) {
            const contentMatch = /<content>\s*([\s\S]*?)\s*<\/content>/i.exec(innerXml);
            realContent = contentMatch ? contentMatch[1] : '';
        } else if (block.action === 'replace') {
            const searchMatch = /<search>\s*([\s\S]*?)\s*<\/search>/i.exec(innerXml);
            const replaceMatch = /<replace>\s*([\s\S]*?)\s*<\/replace>/i.exec(innerXml);
            realContent = `<search>\n${searchMatch?searchMatch[1]:''}\n</search>\n<replace>\n${replaceMatch?replaceMatch[1]:''}\n</replace>`;
        } else if (block.action === 'read') {
            const startMatch = /<start_line>\s*(\d+)\s*<\/start_line>/i.exec(innerXml);
            const endMatch = /<end_line>\s*(\d+)\s*<\/end_line>/i.exec(innerXml);
            if (startMatch) {
                const start = startMatch[1];
                const end = endMatch ? endMatch[1] : start;
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
}
