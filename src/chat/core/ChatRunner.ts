import * as vscode from 'vscode';
import { ILLMClient } from '../../llm/types';
import { ChatMessage } from '../historyManager';
import { SingleChatRunner } from './runners/SingleChatRunner';
import { GroupChatRunner } from './runners/GroupChatRunner';
import { WorkflowRunner } from './runners/WorkflowRunner';
import { ConcurrentChatRunner } from './runners/ConcurrentChatRunner';

export class ChatRunner {
    constructor(private context: vscode.ExtensionContext) {
        const config = vscode.workspace.getConfiguration('bwsCoder');
        if (config.get<boolean>('debugMode')) {
            console.info('[BWS Coder] >>> Debug Mode: ON');
        }
    }

    /**
     * runSerialStrategy - 執行「串行/相依」策略 (對應 structure.md -> [TS1])
     */
    public async runSerialStrategy(
        state: { 
            messages: ChatMessage[], 
            isGenerating: boolean, 
            client: ILLMClient,
            generateId: () => string,
            updateWebview: () => void,
            broadcast: (msg: any) => void,
            acquireFileLock: (path: string) => Promise<() => void>
        },
        personaPrompt: string,
        actionFormatPrompt: string,
        images: string[], 
        isGroupChat: boolean,
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource,
        taskPrompt?: string,
        personas?: { name: string, persona: string }[]
    ) {
        if (isGroupChat) {
            const runner = new GroupChatRunner(this.context);
            return runner.run(state, personaPrompt, actionFormatPrompt, images, globalCts, streamCts, taskPrompt, personas);
        } else {
            const runner = new SingleChatRunner(this.context);
            return runner.run(state, personaPrompt, actionFormatPrompt, images, globalCts, streamCts, taskPrompt);
        }
    }

    /**
     * runConcurrentStrategy - 執行「並行/獨立」策略 (對應 structure.md -> [TP1])
     */
    public async runConcurrentStrategy(
        state: { 
            messages: ChatMessage[], 
            isGenerating: boolean, 
            client: ILLMClient,
            generateId: () => string,
            updateWebview: () => void,
            broadcast: (msg: any) => void,
            acquireFileLock: (path: string) => Promise<() => void>
        },
        personaPrompt: string,
        actionFormatPrompt: string,
        images: string[], 
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource,
        taskPrompt?: string
    ) {
        const runner = new ConcurrentChatRunner(this.context);
        return runner.run(state, personaPrompt, actionFormatPrompt, images, globalCts, streamCts, taskPrompt);
    }

    /**
     * runWorkflowStrategy - 執行工作流循環策略 (對應 structure.md -> 循環 Task)
     */
    public async runWorkflowStrategy(
        state: { 
            messages: ChatMessage[], 
            isGenerating: boolean, 
            client: ILLMClient,
            generateId: () => string,
            updateWebview: () => void,
            broadcast: (msg: any) => void,
            acquireFileLock: (path: string) => Promise<() => void>
        },
        personaPrompt: string,
        actionFormatPrompt: string,
        images: string[], 
        steps: any[], 
        initialText: string,
        globalCts?: vscode.CancellationTokenSource,
        streamCts?: vscode.CancellationTokenSource
    ) {
        const runner = new WorkflowRunner(this.context);
        return runner.run(state, personaPrompt, actionFormatPrompt, images, steps, initialText, globalCts, streamCts);
    }
}
