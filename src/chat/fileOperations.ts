import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { findToolCallStart, TAG_TOOL_CALL_END, TAG_SEARCH_START, TAG_SEARCH_END, TAG_REPLACE_START, TAG_REPLACE_END } from './constants';
import { extractTag } from '../utils/xmlUtils';
import { t, getLang } from '../utils/locale';

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
  const ops = parseFileOps(response);
  if (ops.length === 0) return [];
  const results: FileOpResult[] = [];
  for (const op of ops) {
    const absolutePath = path.isAbsolute(op.filePath) ? op.filePath : path.join(workspacePath, op.filePath);
    let result: FileOpResult;
    let release: (() => void) | undefined;
    if (acquireLock && (op.action === 'create' || op.action === 'write' || op.action === 'modify' || op.action === 'replace' || op.action === 'delete')) {
      release = await acquireLock(absolutePath);
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
      release?.();
    }
    result.filePath = op.filePath;
    results.push(result);
  }
  return results;
}

export function parseFileOps(response: string, isStreaming: boolean = false): FileOperation[] {
  const ops: FileOperation[] = [];

  let pos = 0;
  while (true) {
    const startInfo = findToolCallStart(response, pos);
    if (!startInfo) break;

    const endIdx = response.indexOf(TAG_TOOL_CALL_END, startInfo.index + startInfo.length);
    if (endIdx === -1) break;

    const innerXml = response.substring(startInfo.index + startInfo.length, endIdx);
    pos = endIdx + TAG_TOOL_CALL_END.length;

    // Extract name
    const actionStr = extractTag(innerXml, 'name');
    if (!actionStr) continue;
    const action = actionStr.toLowerCase() as FileOperation['action'];

    // Extract path or command
    const path = extractTag(innerXml, 'path');
    const command = extractTag(innerXml, 'command');
    let filePath = path || command || '';

    let content = '';

    if (action === 'create' || action === 'write' || action === 'modify') {
      content = extractTag(innerXml, 'content') || '';
    } else if (action === 'replace') {
      const searchContent = extractTag(innerXml, 'search') || '';
      const replaceContent = extractTag(innerXml, 'replace') || '';
      content = `${TAG_SEARCH_START}\n${searchContent}\n${TAG_SEARCH_END}\n${TAG_REPLACE_START}\n${replaceContent}\n${TAG_REPLACE_END}`;
    } else if (action === 'read') {
      const start = extractTag(innerXml, 'start_line');
      const end = extractTag(innerXml, 'end_line');
      if (start) {
        filePath = `${filePath}#L${start}-${end || start}`;
      }
      content = filePath;
    } else if (action === 'execute') {
      content = filePath; // command string acts as filePath
    }

    if (content.startsWith('\n')) content = content.substring(1);
    if (content.endsWith('\n')) content = content.slice(0, -1);
    const cleanedContent = stripMarkdownCodeBlocks(content);

    ops.push({ action, filePath, content: cleanedContent });
  }

  // Handle unclosed block if streaming
  if (isStreaming) {
    const lastStart = findToolCallStart(response);
    if (lastStart && response.indexOf(TAG_TOOL_CALL_END, lastStart.index) === -1) {
      const innerXml = response.substring(lastStart.index);
      const actionStr = extractTag(innerXml, 'name');

      if (actionStr) {
        const action = actionStr.toLowerCase() as FileOperation['action'];
        const path = extractTag(innerXml, 'path');
        const command = extractTag(innerXml, 'command');
        let filePath = path || command || '';

        let content = '';
        if (action === 'create' || action === 'write' || action === 'modify') {
          content = extractTag(innerXml, 'content') || '';
          // If it still ends with the partial opening but is being closed (not likely here), 
          // the extractTag handles the missing end tag by returning until EOF.
          content = innerXml; // Fallback to raw inner for partial streaming visibility
        } else if (action === 'read') {
          const start = extractTag(innerXml, 'start_line');
          const end = extractTag(innerXml, 'end_line');
          if (start) {
            filePath = `${filePath}#L${start}-${end || start}`;
          }
          content = filePath;
        }

        ops.push({ action, filePath, content: stripMarkdownCodeBlocks(content) });
      }
    }
  }

  return ops;
}

export function stripMarkdownCodeBlocks(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('```')) return content;
  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 2) return content;
  if (lines[lines.length - 1].trim().startsWith('```')) {
    return lines.slice(1, -1).join('\n');
  }
  return content;
}

export async function createOrOverwriteFile(filePath: string, content: string): Promise<FileOpResult> {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, action: 'create', filePath };
  } catch (error) {
    return { success: false, action: 'create', filePath, error: String(error) };
  }
}

export async function replaceFileContent(filePath: string, patchContent: string): Promise<FileOpResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceFileNotFound') };
    }

    const startIdx = patchContent.indexOf(TAG_SEARCH_START);
    const dividerIdx = patchContent.indexOf(TAG_SEARCH_END);
    const replaceStartIdx = patchContent.indexOf(TAG_REPLACE_START);
    const endIdx = patchContent.indexOf(TAG_REPLACE_END);

    if (startIdx === -1 || dividerIdx === -1 || replaceStartIdx === -1 || endIdx === -1) {
      return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceTagsMissing') };
    }

    if (dividerIdx < startIdx || replaceStartIdx < dividerIdx || endIdx < replaceStartIdx) {
      return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceTagsOrder') };
    }

    const normLF = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const stripEdge = (s: string) => s.replace(/^\n+|\n+$/g, '');

    let oldCode = stripEdge(normLF(patchContent.substring(startIdx + TAG_SEARCH_START.length, dividerIdx)));
    let newCode = stripEdge(normLF(patchContent.substring(replaceStartIdx + TAG_REPLACE_START.length, endIdx)));

    // Read file, detect original line endings, normalize to LF for matching
    const fileRaw = fs.readFileSync(filePath, 'utf-8');
    const originalHasCR = fileRaw.includes('\r\n');
    const fileContent = normLF(fileRaw);

    const writeBack = (content: string): FileOpResult => {
      const out = originalHasCR ? content.replace(/\n/g, '\r\n') : content;
      fs.writeFileSync(filePath, out, 'utf-8');
      return { success: true, action: 'replace', filePath };
    };

    // ── Strategy 1: Exact match ──────────────────────────────────────────────
    if (fileContent.includes(oldCode)) {
      const parts = fileContent.split(oldCode);
      if (parts.length > 2) {
        return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceMultipleFound') };
      }
      return writeBack(parts.join(newCode));
    }

    // ── Strategy 2: Line-by-line fuzzy match (ignores leading AND trailing whitespace) ─
    // Each line in the search block is fully trim()-compared against the file.
    // This handles cases where the AI-generated search block has mismatched indentation.
    // On match, the original file lines are replaced (preserving indentation
    // of non-replaced content), using the new block as-is.
    const fileLines = fileContent.split('\n');
    const oldLines = oldCode.split('\n').map(l => l.trim());
    const newLines = newCode.split('\n');
    const n = oldLines.length;

    // Skip matching if all search lines are empty (would match anywhere)
    const hasNonEmptySearchLine = oldLines.some(l => l.length > 0);

    let matchStart = -1;
    if (hasNonEmptySearchLine) {
      outer: for (let i = 0; i <= fileLines.length - n; i++) {
        for (let j = 0; j < n; j++) {
          if (fileLines[i + j].trim() !== oldLines[j]) { continue outer; }
        }
        matchStart = i;
        break;
      }
    }

    if (matchStart >= 0) {
      const resultLines = [
        ...fileLines.slice(0, matchStart),
        ...newLines,
        ...fileLines.slice(matchStart + n),
      ];
      return writeBack(resultLines.join('\n'));
    }

    return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceNotFound') };
  } catch (error) {
    return { success: false, action: 'replace', filePath, error: String(error) };
  }
}

export async function deleteFile(filePath: string): Promise<FileOpResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, action: 'delete', filePath, error: t(getLang(), 'err_fileNotFound') };
    }
    fs.rmSync(filePath, { recursive: true, force: true });
    return { success: true, action: 'delete', filePath };
  } catch (error) {
    return { success: false, action: 'delete', filePath, error: String(error) };
  }
}

export async function readFileAction(filePath: string, displayPath?: string): Promise<FileOpResult> {
  try {
    let actualPath = filePath;
    let lineRange: { start: number, end: number } | undefined;

    // [2026-04-01] Feature - Line Range Reading (No Regex)
    const hashIndex = filePath.lastIndexOf('#L');
    if (hashIndex !== -1) {
      actualPath = filePath.substring(0, hashIndex);
      const rangeStr = filePath.substring(hashIndex + 2);
      if (rangeStr) {
        const dashIndex = rangeStr.indexOf('-');
        if (dashIndex !== -1) {
          const startStr = rangeStr.substring(0, dashIndex);
          const endStr = rangeStr.substring(dashIndex + 1);
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (!isNaN(start) && !isNaN(end)) {
            lineRange = { start, end };
          }
        } else {
          const lineNum = parseInt(rangeStr);
          if (!isNaN(lineNum)) {
            lineRange = { start: lineNum, end: lineNum };
          }
        }
      }
    }

    if (!fs.existsSync(actualPath)) {
      return { success: false, action: 'read', filePath, error: t(getLang(), 'err_fileNotFound') };
    }
    const stat = fs.statSync(actualPath);
    if (stat.isDirectory()) {
      // [2026-04-09] Feature - Support directory listing via 'read' tool
      const items = fs.readdirSync(actualPath, { withFileTypes: true });
      items.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      let structure = `[Directory Structure: ${actualPath}]\n`;
      const ignoreList = ['.git', 'node_modules', 'dist', 'out', '.vscode', '.bws.coder', 'bin', 'obj'];

      for (const item of items) {
        if (ignoreList.includes(item.name)) continue;
        structure += `${item.isDirectory() ? '📁' : '📄'} ${item.name}${item.isDirectory() ? '/' : ''}\n`;
      }

      return { success: true, action: 'read', filePath, output: structure };
    }
    const fullContent = fs.readFileSync(actualPath, 'utf-8');
    const lines = fullContent.split(/\r?\n/);

    if (lineRange) {
      const startIdx = Math.max(0, lineRange.start - 1);
      const endIdx = Math.min(lines.length, lineRange.end);

      if (startIdx >= lines.length) {
        return { success: true, action: 'read', filePath, output: t(getLang(), 'op_readEmptyRange') || '(outside of file range)' };
      }

      const subContent = lines.slice(startIdx, endIdx).join('\n');
      return { success: true, action: 'read', filePath, output: subContent };
    }

    // [2026-04-01] Feature - Large File Truncation (if no range specified)
    // [2026-04-02] TBD temporarily disabled
    /*
    if (lines.length > 50) {
      const truncatedContent = lines.slice(0, 50).join('\n');
      const pathForHint = displayPath || filePath;
      const hint = t(getLang(), 'op_readTruncatedHint', lines.length, pathForHint); 
      return { success: true, action: 'read', filePath, output: truncatedContent + hint };
    }
    */

    return { success: true, action: 'read', filePath, output: fullContent };
  } catch (error) {
    return { success: false, action: 'read', filePath, error: String(error) };
  }
}

export function formatFileOpResults(results: FileOpResult[]): string {
  if (results.length === 0) return '';
  const lang = getLang();
  const lines = results.map(r => {
    if (r.success) {
      const icons: Record<string, string> = {
        create: t(lang, 'op_created'),
        write: t(lang, 'op_created'),
        modify: t(lang, 'op_modified'),
        delete: t(lang, 'op_deleted'),
        read: t(lang, 'op_read')
      };
      return `${icons[r.action] || '✅'} \`${r.filePath}\``;
    } else {
      const icons: Record<string, string> = {
        create: t(lang, 'op_createFailed'),
        write: t(lang, 'op_createFailed'),
        modify: t(lang, 'op_modifyFailed'),
        delete: t(lang, 'op_deleteFailed'),
        read: t(lang, 'op_readFailed')
      };
      return `${icons[r.action] || '❌'} \`${r.filePath}\`：${r.error}`;
    }
  });
  return '\n\n---\n**' + t(lang, 'op_resultsTitle') + '**\n' + lines.join('\n');
}

function truncateOutput(output: string, maxLines: number = 100, maxChars: number = 5000): string {
  if (!output) return t(getLang(), 'cmd_noOutput');

  const lines = output.split(/\r?\n/);
  // 如果字數跟行數都沒超標，直接回傳原內容
  if (lines.length <= maxLines && output.length <= maxChars) {
    return output;
  }

  const headCount = Math.floor(maxLines / 2);
  const tailCount = maxLines - headCount;

  if (lines.length > maxLines) {
    const head = lines.slice(0, headCount).join('\n');
    const tail = lines.slice(-tailCount).join('\n');
    const skipped = lines.length - maxLines;
    return `${head}${t(getLang(), 'op_truncatedOutput', skipped)}${tail}`;
  } else {
    // 雖然行數沒超，但單行字數過多造成總長超標時的處理
    return output.substring(0, maxChars) + t(getLang(), 'op_truncatedChars');
  }
}

export function formatAutoReport(results: FileOpResult[]): string {
  if (!results || results.length === 0) return '';
  const lang = getLang();
  let successLines: string[] = [];
  let lines: string[] = [];
  for (const r of results) {
    if (r.success && (r.action === 'create' || r.action === 'write' || r.action === 'modify' || r.action === 'replace' || r.action === 'delete')) {
      successLines.push(t(lang, 'op_successDetail', r.action, r.filePath));
    } else if (r.action === 'read' && r.success) {
      lines.push(t(lang, 'op_readDetail', r.filePath, r.output || ''));
    } else if (r.action === 'execute') {
      // 套用日誌修剪優化
      const prunedOutput = truncateOutput(r.output || r.error || '');
      const stateStr = r.success ? t(lang, 'op_success') : t(lang, 'op_failedStatus');
      lines.push(t(lang, 'op_executeDetail', r.filePath, stateStr, prunedOutput));
    } else {
      lines.push(t(lang, 'op_failed', r.filePath, r.error || ''));
    }
  }
  let finalReport = '';
  if (successLines.length > 0) finalReport += successLines.join('\n') + '\n';
  if (lines.length > 0) finalReport += lines.join('\n');
  return finalReport.trim();
}

export async function executeCommand(command: string, token?: vscode.CancellationToken): Promise<FileOpResult> {
  return new Promise((resolve) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      resolve({ success: false, action: 'execute', filePath: command, error: t(getLang(), 'err_noWorkspace') });
      return;
    }
    const { spawn } = require('child_process');
    const cwd = workspaceFolders[0].uri.fsPath;
    const channel = getOutputChannel();
    channel.clear();
    channel.show(true);
    channel.appendLine(t(getLang(), 'msg_commandStarting', command));
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    const child = spawn(shell, [process.platform === 'win32' ? '-Command' : '-c', command], { cwd });
    let fullOutput = '';
    let lastActivity = Date.now();
    const config = vscode.workspace.getConfiguration('bwsCoder');
    const baseHeartbeat = config.get<number>('heartbeatTimeout') || 30;
    const isHeavyTask = command.toLowerCase().includes('unity') || command.toLowerCase().includes('build');
    const multiplier = isHeavyTask ? 120 : 40;
    const INACTIVITY_TIMEOUT = baseHeartbeat * multiplier * 1000;
    let cancelDisposable: vscode.Disposable | undefined;
    let resolved = false;
    const safeResolve = (res: FileOpResult) => {
      if (!resolved) {
        resolved = true;
        clearInterval(checkTimeout);
        if (cancelDisposable) cancelDisposable.dispose();
        resolve(res);
      }
    };
    const checkTimeout = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (!resolved && elapsed > INACTIVITY_TIMEOUT) {
        child.kill();
        const timeoutMsg = t(getLang(), 'err_executorStalled');
        channel.appendLine(timeoutMsg);
        safeResolve({ success: false, action: 'execute', filePath: command, output: fullOutput + timeoutMsg, error: '執行逾時' });
      } else if (!resolved && elapsed > 60000 && (elapsed % 60000 < 5000)) {
        channel.appendLine(t(getLang(), 'msg_executing', Math.floor(elapsed / 1000 / 60)));
      }
    }, 5000);
    child.stdout.on('data', (data: any) => { lastActivity = Date.now(); const str = data.toString(); fullOutput += str; channel.append(str); });
    child.stderr.on('data', (data: any) => { lastActivity = Date.now(); const str = data.toString(); fullOutput += str; channel.append(str); });
    if (token) cancelDisposable = token.onCancellationRequested(() => { child.kill(); safeResolve({ success: false, action: 'execute', filePath: command, output: fullOutput, error: t(getLang(), 'err_userAborted') }); });
    child.on('exit', (code: number | null) => {
      channel.appendLine(t(getLang(), 'msg_processExited', code || 0));
      safeResolve({ success: code === 0, action: 'execute', filePath: command, output: fullOutput });
    });
    child.on('close', (code: number | null) => { safeResolve({ success: code === 0, action: 'execute', filePath: command, output: fullOutput }); });
    child.on('error', (err: any) => { safeResolve({ success: false, action: 'execute', filePath: command, error: err.message, output: fullOutput }); });
  });
}
