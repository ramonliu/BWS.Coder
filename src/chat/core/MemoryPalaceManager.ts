import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface MemoryPalaceData {
    wings: {
        [wingName: string]: {
            halls: {
                facts: string[];
                events: string[];
                discoveries: string[];
                preferences: string[];
            };
            rooms: {
                [roomName: string]: string[];
            };
        };
    };
}

export class MemoryPalaceManager {
    private static instance: MemoryPalaceManager;
    private data: MemoryPalaceData = { wings: {} };
    private storagePath: string = '';

    private constructor(private context: vscode.ExtensionContext) {
        this.initPath();
        this.load();
    }

    public static getInstance(context?: vscode.ExtensionContext): MemoryPalaceManager {
        if (!MemoryPalaceManager.instance && context) {
            MemoryPalaceManager.instance = new MemoryPalaceManager(context);
        }
        return MemoryPalaceManager.instance;
    }

    private initPath() {
        // [2026-04-16] Use globalStorageUri as the primary home for the "Global Wing" 
        // and project-specific storage for project wings if needed.
        // For simplicity, we'll store a single memory_palace.json in the storageUri.
        const storageUri = this.context.storageUri || this.context.globalStorageUri;
        const storageDir = storageUri.fsPath;
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
        this.storagePath = path.join(storageDir, 'memory_palace.json');
    }

    public load() {
        try {
            if (fs.existsSync(this.storagePath)) {
                this.data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
            }
        } catch (e) {
            console.error('[MemoryPalace] Failed to load:', e);
            this.data = { wings: {} };
        }
    }

    public save() {
        try {
            fs.writeFileSync(this.storagePath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (e) {
            console.error('[MemoryPalace] Failed to save:', e);
        }
    }

    /**
     * Get or create a wing. 
     * If no name provided, returns the current workspace name or "Global".
     */
    private getWing(name?: string) {
        const wingName = name || vscode.workspace.name || 'Global';
        if (!this.data.wings[wingName]) {
            this.data.wings[wingName] = {
                halls: { facts: [], events: [], discoveries: [], preferences: [] },
                rooms: {}
            };
        }
        return this.data.wings[wingName];
    }

    /**
     * Add multiple memories at once (typically from extraction results).
     */
    public addMemories(extracted: any, wingName?: string) {
        const wing = this.getWing(wingName);

        if (extracted.halls) {
            if (extracted.halls.facts) wing.halls.facts = Array.from(new Set([...wing.halls.facts, ...extracted.halls.facts]));
            if (extracted.halls.events) wing.halls.events = Array.from(new Set([...wing.halls.events, ...extracted.halls.events]));
            if (extracted.halls.discoveries) wing.halls.discoveries = Array.from(new Set([...wing.halls.discoveries, ...extracted.halls.discoveries]));
            if (extracted.halls.preferences) wing.halls.preferences = Array.from(new Set([...wing.halls.preferences, ...extracted.halls.preferences]));
        }

        if (extracted.rooms) {
            for (const [room, items] of Object.entries(extracted.rooms)) {
                if (!wing.rooms[room]) wing.rooms[room] = [];
                wing.rooms[room] = Array.from(new Set([...wing.rooms[room], ...(items as string[])]));
            }
        }

        this.save();
    }

    /**
     * Retrieve relevant memory snippets based on query keywords or topics.
     */
    public retrieveRelevant(query: string, wingName?: string): string {
        const wing = this.getWing(wingName);
        const lowerQuery = query.toLowerCase();
        let snippets: string[] = [];

        // 1. Always include core facts and preferences (they are small and high-value)
        if (wing.halls.facts.length > 0) snippets.push(`--- FACTS ---\n${wing.halls.facts.join('\n')}`);
        if (wing.halls.preferences.length > 0) snippets.push(`--- PREFERENCES ---\n${wing.halls.preferences.join('\n')}`);

        // 2. Search for relevant rooms based on keyword matching
        const relevantRooms: string[] = [];
        for (const [room, items] of Object.entries(wing.rooms)) {
            if (lowerQuery.includes(room.toLowerCase()) || items.some(i => i.toLowerCase().includes(lowerQuery))) {
                relevantRooms.push(`--- ROOM: ${room} ---\n${items.join('\n')}`);
            }
        }

        if (relevantRooms.length > 0) {
            snippets.push(...relevantRooms);
        }

        return snippets.join('\n\n');
    }

    public getRawData(): MemoryPalaceData {
        return this.data;
    }

    /**
     * Automatic Extraction (The Janitor).
     * Analyzes the conversation and updates the palace.
     */
    public async extractAndStore(messages: any[], client: any, context: vscode.ExtensionContext) {
        try {
            const promptPath = path.join(context.extensionPath, 'prompts', 'MemoryExtraction.md');
            if (!fs.existsSync(promptPath)) return;
            const janitorPrompt = fs.readFileSync(promptPath, 'utf8');

            // Format conversation for the Janitor
            const dialogue = messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .slice(-10) // Only look at recent context to avoid token bloat
                .map(m => `${m.role.toUpperCase()}: ${m.content}`)
                .join('\n\n');

            const extractionMessages = [
                { role: 'system', content: janitorPrompt },
                { role: 'user', content: `Analyze this conversation:\n\n${dialogue}` }
            ];

            const stream = client.chat(extractionMessages, undefined, undefined, undefined, undefined, undefined, undefined, 'Memory Extraction');
            let fullResponse = '';
            for await (const chunk of stream) {
                if (chunk.content) fullResponse += chunk.content;
            }

            let jsonStr = fullResponse.trim();
            if (jsonStr.includes('```')) {
                const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (match) jsonStr = match[1];
            }

            const extracted = JSON.parse(jsonStr);
            console.info('[MemoryPalace] Extraction successful:', extracted);
            this.addMemories(extracted);
        } catch (e) {
            console.error('[MemoryPalace] Extraction failed:', e);
        }
    }
}
