import { ChatMessage } from '../historyManager';
import { ProviderConfig } from '../providerManager';

export enum TaskState {
    INIT = 'INIT',           // 建立中
    IDLE = 'IDLE',           // 建立完畢，閒置中 (對應圖中 [Wait/Speak/Think])
    THINKING = 'THINKING',   // 後端開始收到資料 (對應圖中 [Think/分片解析])
    PARSE_OPS = 'PARSE_OPS', // 正在解析 Action Blocks (對應圖中 [找出對應Task])
    EXECUTING = 'EXECUTING', // 正在執行檔案或系統指令 (對應圖中 [執行指令])
    FEEDBACK = 'FEEDBACK',   // 正在將執行結果餵回給歷史紀錄 (對應圖中 [執行結果 -> AI])
    FINISHED = 'FINISHED',   // 任務完成
    ERROR = 'ERROR',         // 發生不可恢復的錯誤
    RESCUE = 'RESCUE'        // 自我救援
}

export interface Action {
    id?: string;
    action: 'create' | 'modify' | 'replace' | 'delete' | 'execute' | 'read';
    filePath: string;
    content?: string;
    result?: string;
    success?: boolean;
    error?: string;
}

export class Task {
    public state: TaskState = TaskState.INIT;
    public actions: Action[] = [];
    public assistantMessage?: ChatMessage;

    /**
     * [2026-04-02] Tracks files that were auto-truncated on first read (too large).
     * Key: relative filePath (no #L suffix), Value: total line count.
     * Used to distinguish "pagination continuation" from "deliberate range reads".
     */
    private fileReadProgress: Map<string, number> = new Map();

    constructor(
        public id: string,
        public name: string,
        public systemPrompt: string,
        public provider: ProviderConfig,
        public history: ChatMessage[]
    ) {
        this.state = TaskState.IDLE;
    }

    public transition(nextState: TaskState) {
        console.info(`[Task:${this.name}] Transition: ${this.state} -> ${nextState}`);
        this.state = nextState;
        // 未來可以在這裡加入廣播狀態給 UI 的邏輯
    }

    public addAction(action: Action) {
        // [2026-04-02] Dedup guard: prevent same (action, filePath) from being recorded twice.
        // Can occur if AI outputs the same tag twice in one stream, or async batch races.
        const isDuplicate = this.actions.some(
            a => a.action === action.action && a.filePath === action.filePath
        );
        if (isDuplicate) {
            console.log(`[Task:${this.name}] Duplicate action ignored: ${action.action}:${action.filePath}`);
            return;
        }

        // [2026-04-02] Track large-file reads: when a no-range read is truncated,
        // record the total line count so subsequent range reads can be identified as continuations.
        if (action.action === 'read' && action.result && !action.filePath.includes('#L')) {
            const totalMatch = action.result.match(/(?:共\s*(\d+)\s*行)|(?:(\d+)\s*lines?\s*total)/i);
            if (totalMatch) {
                const total = parseInt(totalMatch[1] || totalMatch[2]);
                if (!isNaN(total)) {
                    this.fileReadProgress.set(action.filePath, total);
                    console.log(`[Task:${this.name}] Tracking large file: ${action.filePath} totalLines=${total}`);
                }
            }
        }

        this.actions.push(action);
    }

    public clearActions() {
        this.actions = [];
    }

    /**
     * 將執行結果轉換為給 AI 看的 Feedback 訊息內容
     */
    public getFeedbackContent(): string {
        if (this.actions.length === 0) return '';
        
        const results = this.actions.map(a => {
            const status = a.success ? 'succeeded' : 'failed';
            let outputContent = ``;

            if (a.action === 'execute') {
                outputContent = `${a.result || a.error || ''}`;
            } else if (a.action === 'read') {
                let truncationInfo = "";
                const hashIdx = a.filePath.lastIndexOf('#L');
                const isRangeRead = hashIdx !== -1;

                if (!isRangeRead) {
                    if (a.result && (a.result.includes('[Hint:') || a.result.includes('[提示：'))) {
                        truncationInfo = "\n(Truncated: 50 lines shown. Please continue reading if needed.)";
                    }
                } else {
                    const baseFilePath = a.filePath.substring(0, hashIdx);
                    const totalLines = this.fileReadProgress.get(baseFilePath);
                    if (totalLines !== undefined) {
                        const rangeStr = a.filePath.substring(hashIdx + 2);
                        const dashIdx = rangeStr.indexOf('-');
                        const startLine = parseInt(rangeStr.substring(0, dashIdx !== -1 ? dashIdx : undefined));
                        const endLine = dashIdx !== -1 ? parseInt(rangeStr.substring(dashIdx + 1)) : startLine;
                        const remaining = isNaN(endLine) ? 0 : totalLines - endLine;
                        if (remaining > 0) {
                            const windowSize = isNaN(startLine) ? 50 : (endLine - startLine + 1);
                            const nextStart = endLine + 1;
                            const nextEnd = Math.min(endLine + windowSize, totalLines);
                            truncationInfo = `\n(${remaining} more lines remaining of ${totalLines} total. Continue with \`<tool_call><name>read</name><arguments><path>${baseFilePath}</path><start_line>${nextStart}</start_line><end_line>${nextEnd}</end_line></arguments></tool_call>\`)`;
                        }
                    }
                }

                outputContent = `${a.result || ''}${truncationInfo}`;
            } else {
                outputContent = `${a.result || a.error || ''}`;
            }

            return {
                role: "tool",
                tool_call_id: a.id || String(Math.floor(Math.random() * 100000000)),
                name: a.action,
                path: a.filePath,
                result: status,
                content: outputContent.trim()
            };
        });

        // Return as a JSON array wrapped in markdown, with the required Execution Result header for pruning
        return `[Execution Result]\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``;
    }
}
