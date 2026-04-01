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
        
        let feedback = `[Execution Result]\n`;
        this.actions.forEach(a => {
            const status = a.success ? 'succeeded' : 'failed';
            if (a.action === 'execute') {
                feedback += `> Command \`${a.filePath}\` ${status}. (Content is available in your history record)\n`;
            } else if (a.action === 'read') {
                let truncationInfo = "";
                if (a.result && (a.result.includes('[Hint:') || a.result.includes('[提示：'))) {
                    truncationInfo = " (Truncated: 50 lines shown. Please continue reading if needed.)";
                }
                feedback += `> Read \`${a.filePath}\` ${status}${truncationInfo}. (Content available in history)\n`;
            } else {
                feedback += `> ${a.action} \`${a.filePath}\` ${status}${a.error ? `: ${a.error}` : ''}\n`;
            }
        });
        return feedback.trim();
    }
}
