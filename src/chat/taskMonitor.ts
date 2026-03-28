import * as vscode from 'vscode';

export enum TaskMonitorStatus {
    STALLED = 'Stalled',
    EXHAUSTED = 'Exhausted',
    ERROR = 'Error',
    IDLE = 'Idle',
    THINKING = 'Thinking',
    EXECUTING = 'Executing',
    REPORTING = 'Reporting',
    FINISHED = 'Finished'
}

export interface TaskExecutionStats {
    providerId: string;
    name: string;
    status: TaskMonitorStatus;
    detailedReason?: string;
    lastUpdate: number;
    activeTime: number; // ms
    tokenCount: number;
    lastCmd?: string;
    isCloud: boolean;
    taskName?: string;
    keyNo?: number | string;
}

export class TaskMonitor {
    private static instance: TaskMonitor;
    private stats: Map<string, TaskExecutionStats> = new Map();
    private _onDidChange = new vscode.EventEmitter<void>();
    public readonly onDidChange = this._onDidChange.event;
    private context: vscode.ExtensionContext | undefined;

    private constructor() {}

    public static getInstance(context?: vscode.ExtensionContext): TaskMonitor {
        if (!TaskMonitor.instance) {
            TaskMonitor.instance = new TaskMonitor();
        }
        if (context && !TaskMonitor.instance.context) {
            TaskMonitor.instance.context = context;
            TaskMonitor.instance.load();
        }
        return TaskMonitor.instance;
    }

    private load() {
        if (!this.context) return;
        try {
            const saved = this.context.globalState.get<[string, TaskExecutionStats][]>('bwsCoder.taskStats', []);
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            // 載入並過濾掉超過 24 小時前的非運行中數據
            this.stats = new Map(saved.filter(([_, s]) => {
                return s.status === TaskMonitorStatus.IDLE || s.status === TaskMonitorStatus.THINKING || s.status === TaskMonitorStatus.EXECUTING || (now - s.lastUpdate < ONE_DAY);
            }));
            // 強制將所有狀態設為 IDLE，避免重啟後卡在 EXECUTING
            this.stats.forEach(s => {
                if (s.status === TaskMonitorStatus.EXECUTING || (s as any).status === 'Online') s.status = TaskMonitorStatus.IDLE;
            });
        } catch (e) {
            console.error('Failed to load Task stats:', e);
        }
    }

    private save() {
        if (!this.context) return;
        try {
            const data = Array.from(this.stats.entries());
            this.context.globalState.update('bwsCoder.taskStats', data);
        } catch (e) {
            console.error('Failed to save Task stats:', e);
        }
    }

    public updateStatus(providerId: string, name: string, status: TaskMonitorStatus, isCloud: boolean, reason?: string, taskName?: string, keyNo?: number | string, resetStats: boolean = false) {
        const key = taskName || providerId;
        let current = this.stats.get(key);
        const oldStatus = current?.status;
        
        if (!current) {
            current = { providerId, name, status, isCloud, lastUpdate: Date.now(), activeTime: 0, tokenCount: 0, taskName };
        }
        if (resetStats) {
            current.activeTime = 0;
            current.tokenCount = 0;
        }
        current.status = status;
        current.detailedReason = reason;
        current.lastUpdate = Date.now();
        if (taskName) current.taskName = taskName;
        if (keyNo !== undefined) current.keyNo = keyNo;
        this.stats.set(key, current);
        this.save();
        this._onDidChange.fire();

        // 輸出狀態切換到 Console 供使用者觀察
        if (oldStatus !== status) {
            const displayName = keyNo ? `${name} [#${keyNo}]` : name;
            console.info(`[TASK_STATUS] ${taskName || displayName}: ${oldStatus || 'NONE'} -> ${status}`);
        }
    }

    public recordActivity(providerId: string, tokens: number, duration: number, cmd?: string, taskName?: string) {
        const key = taskName || providerId;
        let current = this.stats.get(key);
        if (current) {
            current.tokenCount += tokens;
            current.activeTime += duration;
            if (cmd) current.lastCmd = cmd;
            current.lastUpdate = Date.now();
            this.stats.set(key, current);
            this.save();
            this._onDidChange.fire();
        }
    }

    public getStats(): TaskExecutionStats[] {
        return Array.from(this.stats.values());
    }

    public forceReset(providerId: string) {
        // [2026-03-25] Support Task Name as key for force reset
        const current = this.stats.get(providerId);
        if (current) {
            current.status = TaskMonitorStatus.IDLE;
            current.detailedReason = undefined;
            this.save();
            this._onDidChange.fire();
        }
    }
    
    public clearAll() {
        this.stats.clear();
        this.save();
        this._onDidChange.fire();
    }
}
