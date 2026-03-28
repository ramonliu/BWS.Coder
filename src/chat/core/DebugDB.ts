import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatMessage } from '../historyManager';

export interface DebugLogEntry extends ChatMessage {
    turnIndex: number;
    prunedAt?: Date;
}

export class DebugDB {
    private static instance: DebugDB;
    private logPath: string;

    private constructor(context: vscode.ExtensionContext) {
        const debugDir = context.logUri.fsPath;
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        this.logPath = path.join(debugDir, 'debug_history.jsonl');
    }

    public static getInstance(context: vscode.ExtensionContext): DebugDB {
        if (!DebugDB.instance) {
            DebugDB.instance = new DebugDB(context);
        }
        return DebugDB.instance;
    }

    /**
     * Appends a message state to the debug history log (JSON-L format).
     * Only active if debugMode is enabled.
     */
    public async logMessageState(message: ChatMessage, turnIndex: number): Promise<void> {
        const config = vscode.workspace.getConfiguration('bwsCoder');
        if (!config.get<boolean>('debugMode')) return;

        try {
            const entry: DebugLogEntry = {
                ...message,
                turnIndex,
                prunedAt: message.isPruned ? new Date() : undefined
            };

            // Use appendFileSync for simple atomic-like writes in JSON-L
            fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n');
        } catch (error) {
            console.error('[DebugDB] Failed to log message state:', error);
        }
    }

    /**
     * Optional: Clear the debug log
     */
    public clear(): void {
        if (fs.existsSync(this.logPath)) {
            fs.unlinkSync(this.logPath);
        }
    }
}
