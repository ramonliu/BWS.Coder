import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Attachment {
  type: 'image' | 'file' | 'code';
  name: string;
  content: string;
  mimeType?: string;
  language?: string;
}

// [2026-03-28] [FileOps-Refactor] - Add structured FileOpRecord to support data-driven rendering
export interface FileOpRecord {
  action: string;           // 'create' | 'modify' | 'replace' | 'read' | 'execute' | 'delete'
  filePath: string;         // file path or command string for execute
  content?: string;         // file content for create/modify, or read result output
  result?: string;          // execution result / error output
  success?: boolean;        // whether the operation succeeded
  isPending?: boolean;      // true while still streaming/executing
}

// [2026-03-28] [State-Machine-Parser] - Core structural definitions for Line-by-Line architecture
export type BlockType = 'think' | 'speak' | 'action';

export interface MessageBlock {
  type: BlockType;
  
  // For 'speak' / 'think'
  text?: string; 
  
  // For 'action'
  action?: 'create' | 'modify' | 'replace' | 'read' | 'execute' | 'delete' | string;
  filePath?: string;
  content?: string;       // File operation text payload
  result?: string;        // Result of the operation (output/error)
  success?: boolean;      // Did it succeed?
  isClosed?: boolean;     // Has it received entirely? (e.g. eof received)
  isPending?: boolean;    // Is it still being modified/streamed/executed?
  id: string;             // Unique block ID for rendering key
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;            // Legacy content / AI combined text
  fileOps?: FileOpRecord[];   // [DEPRECATED] Use blocks instead.
  blocks?: MessageBlock[];    // [2026-03-28] [State-Machine-Parser] Semantic sequential layout
  thinking?: string;
  isThinking?: boolean;
  timestamp: Date | string;
  attachments?: Attachment[];
  providerName?: string;
  taskName?: string;
  isStreaming?: boolean;
  weight?: number;        // 0.0 to 1.0, reflects message importance
  isPruned?: boolean;      // Whether this message was omitted from the LLM context
  // [2026-03-29] [Workflow-Resume] - Explicitly track task completion
  isTaskDone?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: string;
  // [2026-03-24] Feature - Store chat mode for session restore
  chatMode?: string;
}

export class HistoryManager {
  private sessions: ChatSession[] = [];
  private chatHistoryPath: string = '';

  constructor(context: vscode.ExtensionContext) {
    this.initPaths(context);
    this.loadSessions();
  }

  private initPaths(context: vscode.ExtensionContext) {
    const storageUri = context.storageUri || context.globalStorageUri;
    const storageDir = storageUri.fsPath;
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    this.chatHistoryPath = path.join(storageDir, 'sessions.json');
  }

  private loadSessions() {
    try {
      if (fs.existsSync(this.chatHistoryPath)) {
        this.sessions = JSON.parse(fs.readFileSync(this.chatHistoryPath, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
      this.sessions = [];
    }
  }

  public getSessions(): ChatSession[] {
    return this.sessions;
  }

  public getSession(id: string): ChatSession | undefined {
    return this.sessions.find(s => s.id === id);
  }

  public saveSession(sessionId: string, messages: ChatMessage[], chatMode?: string) {
    if (messages.length === 0) return;

    let title = '';
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
        title = firstUserMsg.content.trim().substring(0, 50).replace(/\n/g, ' ');
        if (!title && firstUserMsg.attachments && firstUserMsg.attachments.length > 0) {
            const firstImage = (firstUserMsg.attachments as any[]).find(a => a.type === 'image');
            title = firstImage ? `[圖片] ${firstImage.name}` : `[檔案] ${firstUserMsg.attachments[0].name}`;
        }
    }
    if (!title) title = '新對話';

    const session: ChatSession = {
      id: sessionId,
      title,
      messages,
      timestamp: new Date().toISOString(),
      chatMode: chatMode // optional 3rd arg
    };

    const idx = this.sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      this.sessions[idx] = session;
    } else {
      this.sessions.unshift(session);
    }

    this.persist();
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return false;

    const answer = await vscode.window.showWarningMessage(
      `確定要刪除對話「${session.title}」嗎？`,
      { modal: true },
      '確定'
    );

    if (answer === '確定') {
      this.sessions = this.sessions.filter(s => s.id !== sessionId);
      this.persist();
      return true;
    }
    return false;
  }

  private persist() {
    try {
      fs.writeFileSync(this.chatHistoryPath, JSON.stringify(this.sessions.slice(0, 50), null, 2));
    } catch (e) {
      console.error('Failed to save chat sessions:', e);
    }
  }
}
