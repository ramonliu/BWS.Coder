import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getFileOpRegex } from './constants';

export interface FileOperation {
  action: 'create' | 'write' | 'modify' | 'replace' | 'delete' | 'execute' | 'read';
  filePath: string;
  content?: string;
}

export interface FileOpResult {
  success: boolean;
  action: 'create' | 'write' | 'modify' | 'replace' | 'delete' | 'execute' | 'read';
  filePath: string;
  error?: string;
  output?: string;
}

let buildOutputChannel: vscode.OutputChannel | undefined;

function getOutputChannel() {
  if (!buildOutputChannel) {
    buildOutputChannel = vscode.window.createOutputChannel("BWS.Coder Build Output");
  }
  return buildOutputChannel;
}

export async function parseAndExecuteFileOps(
  response: string,
  workspacePath: string,
  acquireLock?: (filePath: string) => Promise<() => void>
): Promise<FileOpResult[]> {
  // 目前無執行到

  const ops = parseFileOps(response);
  if (ops.length === 0) return [];
  const results: FileOpResult[] = [];
  for (const op of ops) {
    const absolutePath = path.isAbsolute(op.filePath) ? op.filePath : path.join(workspacePath, op.filePath);
    let result: FileOpResult;
    // Acquire per-file lock before any write to prevent parallel step races
    let release: (() => void) | undefined;
    if (acquireLock && (op.action === 'create' || op.action === 'write' || op.action === 'modify' || op.action === 'replace' || op.action === 'delete')) {
      release = await acquireLock(absolutePath);
      // Re-read latest file content for modify/replace so we merge on top of newest version
      if ((op.action === 'modify' || op.action === 'replace') && fs.existsSync(absolutePath)) {
        // The AI already has its intended diff/content. We just ensure we're last-writer-wins
        // by waiting for the lock. For replace ops the line-based merge is already safe,
        // for full modify we simply write the AI's latest version on top.
      }
    }
    try {
      if (op.action === 'create' || op.action === 'write' || op.action === 'modify') {
        result = await createOrOverwriteFile(absolutePath, op.content || '');
        result.action = op.action;
      } else if (op.action === 'replace') {
        result = await replaceFileContent(absolutePath, op.content || '');
        result.action = 'replace';
      } else if (op.action === 'read') {
        result = await readFileAction(absolutePath);
        result.action = 'read';
      } else if (op.action === 'delete') {
        result = await deleteFile(absolutePath);
      } else {
        result = { success: false, action: op.action, filePath: op.filePath, error: 'Unknown operation' };
      }
    } finally {
      release?.();   // Always release lock even on error
    }
    result.filePath = op.filePath;
    results.push(result);
  }
  return results;
}

// [2026-03-24] UI Fix - Migrate to @@[action:path]@@ syntax to support single-line execute/delete without markdown issues
// [2026-03-25] Bugfix - Support isStreaming flag to prevent eager parsing of empty content blocks
export function parseFileOps(response: string, isStreaming: boolean = false): FileOperation[] {
  const ops: FileOperation[] = [];
  // [2026-03-24] UI Fix - Migrate to symmetric [@@ action:path @@] syntax against truncation
  const regex = getFileOpRegex();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(response)) !== null) {
    const action = match[1] as 'create' | 'write' | 'modify' | 'replace' | 'delete' | 'execute' | 'read';
    const filePath = match[2].trim();
    const startIndex = regex.lastIndex;
    
    let content = '';
    let matchLength = 0;
    let realEndIndex = startIndex;

    if (action === 'create' || action === 'write' || action === 'modify' || action === 'replace') {
        const closeTag = '[@@ eof @@]';
        let endIndex = response.indexOf(closeTag, startIndex);
        
        if (endIndex === -1) {
            // [2026-03-25] Bugfix: If still streaming, do NOT parse this block yet
            if (isStreaming) {
                continue; 
            }
            // Fallback: take the rest if AI forgot closing tag
            endIndex = response.length;
            realEndIndex = response.length;
        } else {
            realEndIndex = endIndex;
            matchLength = closeTag.length;
        }
        
        content = response.substring(startIndex, realEndIndex);
        // Trim leading and trailing newlines cleanly
        if (content.startsWith('\n')) content = content.substring(1);
        else if (content.startsWith('\r\n')) content = content.substring(2);
        if (content.endsWith('\n')) content = content.substring(0, content.length - 1);
        if (content.endsWith('\r')) content = content.substring(0, content.length - 1);
    } else {
        // execute, read, and delete have no content block
        content = '';
        realEndIndex = startIndex;
        matchLength = 0;
    }

    ops.push({ action, filePath, content });
    regex.lastIndex = realEndIndex + matchLength;
  }
  return ops;
}

export async function createOrOverwriteFile(filePath: string, content: string): Promise<FileOpResult> {
  try {
    console.info(`[BWS Coder][FileOp] createOrOverwriteFile: ${filePath}`);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      console.info(`[BWS Coder][FileOp] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.info(`[BWS Coder][FileOp] Write successfully: ${filePath} (${content.length} chars)`);
    return { success: true, action: 'create', filePath };
  } catch (error) {
    console.error(`[BWS Coder][FileOp] Write failed: ${filePath}`, error);
    return { success: false, action: 'create', filePath, error: String(error) };
  }
}

export async function replaceFileContent(filePath: string, patchContent: string): Promise<FileOpResult> {
  try {
    console.info(`[BWS Coder][FileOp] replaceFileContent: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      return { success: false, action: 'replace', filePath, error: '檔案不存在，無法進行局部替換 (replace)' };
    }

    // 1. 解析行號資訊 (例如 L10-L20:)
    let startLine = -1;
    let endLine = -1;
    const lineMatch = patchContent.match(/L(\d+)-L?(\d+):/i);
    let cleanPatch = patchContent;
    if (lineMatch) {
      startLine = parseInt(lineMatch[1]);
      endLine = parseInt(lineMatch[2]);
      cleanPatch = patchContent.replace(lineMatch[0], '').trim();
    }

    // [2026-03-27] [Change Replace Parse] - Switch to [@@<@@], [@@=@@], [@@>@@] syntax
    const startMatch = cleanPatch.match(/^\[@@<@@\][ \t]*\r?\n/im);
    const dividerMatch = cleanPatch.match(/^\[@@=@@\][ \t]*\r?\n/im);
    const endMatch = cleanPatch.match(/^\[@@>@@\][ \t]*\r?\n?/im);

    if (!startMatch || !dividerMatch || !endMatch) {
      return { success: false, action: 'replace', filePath, error: 'replace 區塊格式錯誤，必須包含獨立的一行 [@@<@@]、[@@=@@] 與 [@@>@@] 標籤' };
    }

    const startIdx = startMatch.index!;
    const dividerIdx = dividerMatch.index!;
    const endIdx = endMatch.index!;

    if (dividerIdx < startIdx || endIdx < dividerIdx) {
      return { success: false, action: 'replace', filePath, error: 'replace 標籤順序錯誤，必須依序為 [@@<@@]、[@@=@@]、[@@>@@]' };
    }

    let oldCode = cleanPatch.substring(startIdx + startMatch[0].length, dividerIdx).trim();
    let newCode = cleanPatch.substring(dividerIdx + dividerMatch[0].length, endIdx).trim();

    // 移除可能因為排版產生的多餘換行
    oldCode = oldCode.replace(/^\n+|\n+$/g, '');
    newCode = newCode.replace(/^\n+|\n+$/g, '');

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const fileLines = fileContent.split('\n');

    // 策略 A: 如果有行號，優先在範圍內尋找
    if (startLine > 0) {
      // VS Code 行號通常從 1 開始
      const searchStart = Math.max(0, startLine - 5); // 緩衝 5 行
      const searchEnd = Math.min(fileLines.length, endLine + 5);
      const subContent = fileLines.slice(searchStart, searchEnd).join('\n');

      if (subContent.includes(oldCode)) {
        const newSubContent = subContent.replace(oldCode, newCode);
        const newFullLines = [...fileLines.slice(0, searchStart), ...newSubContent.split('\n'), ...fileLines.slice(searchEnd)];
        fs.writeFileSync(filePath, newFullLines.join('\n'), 'utf-8');
        return { success: true, action: 'replace', filePath };
      }
    }

    // 策略 B: 如果行號沒對上，或者沒給行號，則在全域尋找 (唯一匹配)
    if (fileContent.includes(oldCode)) {
      const parts = fileContent.split(oldCode);
      if (parts.length > 2) {
        return { success: false, action: 'replace', filePath, error: '找到多個相同的舊代碼區塊，請提供行號或更多上下文以精確定位' };
      }
      const newFileContent = fileContent.replace(oldCode, newCode);
      fs.writeFileSync(filePath, newFileContent, 'utf-8');
      console.info(`[BWS Coder][FileOp] Replace successfully: ${filePath}`);
      return { success: true, action: 'replace', filePath };
    }

    // 策略 C: 模糊匹配 (忽略縮排差異)
    const normalize = (s: string) => s.split('\n').map(l => l.trim()).join('\n').trim();
    const normalizedOld = normalize(oldCode);

    // 如果內容很短，不建議用模糊匹配以防改錯
    if (normalizedOld.length > 20) {
      let bestMatchStart = -1;
      // 簡單的滑動窗口或逐行比對 (這裡簡化處理：如果全域 normalize 後能對上)
      if (normalize(fileContent).includes(normalizedOld)) {
        // 找到大致位置後嘗試替換 (這部分邏輯較複雜，暫時提示手動修正，或讓 AI 重新提供完整 modify)
        return { success: false, action: 'replace', filePath, error: '內容匹配但縮排不一致，請確保舊代碼的縮排與原檔完全一致，或改用 modify 完全覆寫' };
      }
    }

    return { success: false, action: 'replace', filePath, error: '找不到完全匹配的舊代碼區塊。建議：1.檢查縮排 2.確保行號正確 3.改用 modify 強制覆寫' };
  } catch (error) {
    return { success: false, action: 'replace', filePath, error: String(error) };
  }
}

export async function deleteFile(filePath: string): Promise<FileOpResult> {
  try {
    console.info(`[BWS Coder][FileOp] deleteFile: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.info(`[BWS Coder][FileOp] File does not exist: ${filePath}`);
      return { success: false, action: 'delete', filePath, error: '檔案或目錄不存在' };
    }
    fs.rmSync(filePath, { recursive: true, force: true });
    console.info(`[BWS Coder][FileOp] Deleted successfully: ${filePath}`);
    return { success: true, action: 'delete', filePath };
  } catch (error) {
    console.error(`[BWS Coder][FileOp] Delete failed: ${filePath}`, error);
    return { success: false, action: 'delete', filePath, error: String(error) };
  }
}

// [2026-03-27] [Add Read Command] - Implement native read action
export async function readFileAction(filePath: string): Promise<FileOpResult> {
  try {
    console.info(`[BWS Coder][FileOp] readFileAction: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      return { success: false, action: 'read', filePath, error: '檔案不存在' };
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return { success: false, action: 'read', filePath, error: '無法讀取目錄，請提供檔案路徑' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, action: 'read', filePath, output: content };
  } catch (error) {
    return { success: false, action: 'read', filePath, error: String(error) };
  }
}

export function formatFileOpResults(results: FileOpResult[]): string {
  if (results.length === 0) return '';
  const lines = results.map(r => {
    if (r.success) {
      const icons: Record<string, string> = { create: '✅ 已建立', write: '✅ 已建立', modify: '✏️ 已修改', delete: '🗑️ 已刪除', read: '📄 已讀取' };
      return `${icons[r.action] || '✅'} \`${r.filePath}\``;
    } else {
      const icons: Record<string, string> = { create: '❌ 建立失敗', write: '❌ 建立失敗', modify: '❌ 修改失敗', delete: '❌ 刪除失敗', read: '❌ 讀取失敗' };
      return `${icons[r.action] || '❌'} \`${r.filePath}\`：${r.error}`;
    }
  });
  return '\n\n---\n**📁 檔案操作結果：**\n' + lines.join('\n');
}

/**
 * 專門給自動回報 (Auto-Report) 餵給 AI 看的精簡版報告。
 * 目的：節省 Token，只有報錯或 execute 產出才詳細條列。
 */
export function formatAutoReport(results: FileOpResult[]): string {
  if (!results || results.length === 0) return '';

  let successLines: string[] = [];
  let lines: string[] = [];

  for (const r of results) {
    if (r.success && (r.action === 'create' || r.action === 'write' || r.action === 'modify' || r.action === 'replace' || r.action === 'delete')) {
      successLines.push(`✅ ${r.action} 成功: ${r.filePath}`);
    } else if (r.action === 'read' && r.success) {
      // 給 AI 看的讀取檔案內容
      lines.push(`📄 已讀取檔案 \`${r.filePath}\`，內容如下：\n\`\`\`\n${r.output || ''}\n\`\`\`\n`);
    } else if (r.action === 'execute') {
      // 終端機指令：這對 AI 很重要，無論成功失敗都要給出 stdout/stderr
      lines.push(`指令 \`${r.filePath}\` 執行${r.success ? '成功' : '失敗'}\n輸出內容：\n${r.output || r.error || '(無輸出)'}\n`);
    } else {
      // 檔案操作失敗：一定要回報讓 AI 自己修正 (Self-Healing)
      lines.push(`❌ 操作 ${r.filePath} 失敗：${r.error}`);
    }
  }

  let finalReport = '';
  if (successLines.length > 0) {
    finalReport += successLines.join('\n') + '\n';
  }
  if (lines.length > 0) {
    finalReport += lines.join('\n');
  }

  return finalReport.trim();
}

/**
 * 執行系統指令並擷取輸出，支援逾時與中途取消。
 * 使用 Output Channel 顯示日誌，避免干擾終端機輸入。
 */
export async function executeCommand(command: string, token?: vscode.CancellationToken): Promise<FileOpResult> {
  return new Promise((resolve) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      resolve({ success: false, action: 'execute', filePath: command, error: '未開啟工作區' });
      return;
    }

    const { spawn } = require('child_process');
    const cwd = workspaceFolders[0].uri.fsPath;
    const channel = getOutputChannel();

    console.info(`[BWS Coder][FileOp] executeCommand: ${command}`);
    channel.clear();
    channel.show(true);
    channel.appendLine(`[BWS.Coder] 啟動指令: ${command}`);
    channel.appendLine(`[BWS.Coder] 工作目錄: ${cwd}`);
    channel.appendLine(`--------------------------------------------------`);

    // 啟動進程
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    const child = spawn(shell, [process.platform === 'win32' ? '-Command' : '-c', command], { cwd });

    let fullOutput = '';
    let lastActivity = Date.now();
    const baseHeartbeat = vscode.workspace.getConfiguration('bwsCoder').get<number>('heartbeatTimeout') || 30;
    const configInterval = baseHeartbeat * 10;
    const INACTIVITY_TIMEOUT = configInterval * 1000;

    let cancelDisposable: vscode.Disposable | undefined;

    let resolved = false;
    const safeResolve = (res: FileOpResult) => {
      if (!resolved) {
        resolved = true;
        clearInterval(checkTimeout);
        if (cancelDisposable) {
          cancelDisposable.dispose();
        }
        resolve(res);
      }
    };

    const checkTimeout = setInterval(() => {
      if (!resolved && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        child.kill();
        const timeoutMsg = `\n[系統提示] 編譯偵測到長時間無反應（${configInterval}秒），已自動停止。`;
        channel.appendLine(timeoutMsg);
        safeResolve({ success: false, action: 'execute', filePath: command, output: fullOutput + timeoutMsg, error: '執行逾時' });
      }
    }, 5000);

    child.stdout.on('data', (data: any) => {
      lastActivity = Date.now();
      const str = data.toString();
      fullOutput += str;
      channel.append(str);
    });

    child.stderr.on('data', (data: any) => {
      lastActivity = Date.now();
      const str = data.toString();
      fullOutput += str;
      channel.append(str);
    });

    if (token) {
      cancelDisposable = token.onCancellationRequested(() => {
        child.kill();
        channel.appendLine('\n[使用者已點擊 Stop，已終止進程]');
        safeResolve({ success: false, action: 'execute', filePath: command, output: fullOutput + '\n[已停止]', error: '已停止' });
      });
    }

    child.on('close', (code: number | null) => {
      channel.appendLine(`\n--------------------------------------------------`);
      channel.appendLine(`[BWS.Coder] 指令結束，結束代碼: ${code}`);
      if (code === 0) {
        safeResolve({ success: true, action: 'execute', filePath: command, output: fullOutput });
      } else {
        const errorDetail = code === null ? '進程被異常終止' : `Exit Code ${code}`;
        safeResolve({ success: false, action: 'execute', filePath: command, output: fullOutput, error: errorDetail });
      }
    });

    child.on('error', (err: any) => {
      channel.appendLine(`[BWS.Coder] 執行出錯: ${err.message}`);
      safeResolve({ success: false, action: 'execute', filePath: command, error: err.message, output: fullOutput });
    });
  });
}
