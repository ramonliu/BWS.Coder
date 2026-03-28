import * as vscode from 'vscode';

export interface WorkflowStep {
    id: string;
    role: string; // e.g., "程式撰寫", "安全性審查", "反對者"
    prompt: string; // System Prompt for this step
    providerId: string; // The specific provider ID to use
    enabled: boolean;
    parallel?: boolean;
}

export class WorkflowManager {
    private steps: WorkflowStep[] = [];
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    private load() {
        this.steps = this.context.globalState.get<WorkflowStep[]>('bwsCoder.workflows') || [
            { id: '1', role: '主要工程師', prompt: '你是一位資深全端工程師。', providerId: 'default', enabled: true }
        ];
    }

    public save(steps: WorkflowStep[]) {
        this.steps = steps;
        this.context.globalState.update('bwsCoder.workflows', steps);
    }

    public getSteps(): WorkflowStep[] {
        return this.steps.filter(s => s.enabled);
    }

    public getAllSteps(): WorkflowStep[] {
        return this.steps;
    }
}
