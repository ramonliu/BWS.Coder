import { MessageBlock } from '../historyManager';
import { PATTERN_OP_START, PATTERN_OP_EOF, FILE_OP_ACTIONS } from '../constants';

export class StreamingParser {
    private blocks: MessageBlock[] = [];
    private lineBuffer: string = '';
    private state: 'SPEAK' | 'ACTION_MULTI' = 'SPEAK';
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
     * Returns an array of newly closed/ready action blocks for background execution.
     */
    public pushChunk(chunk: string): MessageBlock[] {
        let textToProcess = this.lineBuffer + chunk;
        let lines = textToProcess.split('\n');
        
        // The last element is always the remainder after the last \n
        // (If it strictly ends with \n, pop() returns an empty string)
        this.lineBuffer = lines.pop() || '';
        
        const readyOps: MessageBlock[] = [];

        for (const line of lines) {
            // Restore the \n for exact fidelity in strings
            this.processLine(line + '\n', readyOps); 
        }

        return readyOps;
    }

    /**
     * Call this when the stream entirely finishes to flush the buffer.
     */
    public close(): MessageBlock[] {
        const readyOps: MessageBlock[] = [];
        if (this.lineBuffer) {
            this.processLine(this.lineBuffer, readyOps);
            this.lineBuffer = '';
        }
        
        // If an action block was left open at EOF, close it forcefully
        if (this.state === 'ACTION_MULTI' && this.currentActionBlock) {
            this.currentActionBlock.isClosed = true;
            readyOps.push(this.currentActionBlock);
            this.currentActionBlock = null;
            this.state = 'SPEAK';
        }
        
        return readyOps;
    }

    private processLine(line: string, readyOps: MessageBlock[]) {
        if (this.state === 'SPEAK') {
            // [2026-03-30] [Bugfix-TagStripping] - Use centralized robust regex for multi-line action starts
            const multiRegex = new RegExp(PATTERN_OP_START, 'i');
            const multiMatch = line.match(multiRegex);
            if (multiMatch && (multiMatch[1].toLowerCase() === 'create' || multiMatch[1].toLowerCase() === 'write' || multiMatch[1].toLowerCase() === 'modify' || multiMatch[1].toLowerCase() === 'replace')) {
                const action = multiMatch[1].toLowerCase();
                const filePath = multiMatch[2].trim();
                
                this.currentActionBlock = {
                    id: this.generateId(),
                    type: 'action',
                    action,
                    filePath,
                    content: '',
                    isPending: true,
                    isClosed: false
                };
                this.blocks.push(this.currentActionBlock);
                this.state = 'ACTION_MULTI';
                
                // If there's text ON THE SAME LINE before the tag, it belongs to SPEAK
                const prefix = line.substring(0, multiMatch.index);
                if (prefix) {
                    this.appendToSpeak(prefix);
                }

                // If there's text after the start block on the SAME line, append it to content!
                const idx = multiMatch[0].length + multiMatch.index!;
                const remainder = line.substring(idx);
                if (remainder) {
                    this.processLineForMulti(remainder, readyOps);
                }
                return;
            }

            // [2026-03-30] [Bugfix-TagStripping] - Use centralized robust regex for single-line action starts
            const singleMatch = line.match(multiRegex);
            if (singleMatch && (singleMatch[1].toLowerCase() === 'read' || singleMatch[1].toLowerCase() === 'execute' || singleMatch[1].toLowerCase() === 'delete')) {
                const action = singleMatch[1].toLowerCase();
                const filePath = singleMatch[2].trim();
                
                // Text before the tag belongs to speak
                const prefix = line.substring(0, singleMatch.index);
                if (prefix) {
                    this.appendToSpeak(prefix);
                }

                const block: MessageBlock = {
                    id: this.generateId(),
                    type: 'action',
                    action,
                    filePath,
                    isPending: true,
                    isClosed: true // Single line actions are inherently closed immediately
                };
                this.blocks.push(block);
                readyOps.push(block);
                
                // If there's text after, it belongs back in SPEAK state
                const idx = singleMatch[0].length + singleMatch.index!;
                const remainder = line.substring(idx);
                if (remainder) {
                    // Usually this is just a \n after the tag.
                    this.appendToSpeak(remainder);
                }
                return;
            }

            // Normal text
            this.appendToSpeak(line);
        } else if (this.state === 'ACTION_MULTI') {
            this.processLineForMulti(line, readyOps);
        }
    }

    private processLineForMulti(line: string, readyOps: MessageBlock[]) {
        // [2026-03-30] [Bugfix-TagStripping] - Use centralized robust regex for EOF
        const eofRegex = new RegExp(PATTERN_OP_EOF, 'i');
        const eofMatch = line.match(eofRegex);
        if (eofMatch) {
            const idx = eofMatch.index!;
            const beforeEof = line.substring(0, idx);
            if (beforeEof) {
                this.currentActionBlock!.content += beforeEof;
            }
            
            this.currentActionBlock!.isClosed = true;
            readyOps.push(this.currentActionBlock!);
            this.currentActionBlock = null;
            this.state = 'SPEAK';
            
            const remainder = line.substring(idx + eofMatch[0].length);
            if (remainder) {
                // Eof found, remaining text goes purely to SPEAK state
                this.processLine(remainder, readyOps);
            }
        } else {
            this.currentActionBlock!.content += line;
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
