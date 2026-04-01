import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getFileOpRegex, getEofRegex, getReplaceOldRegex, getReplaceDivRegex, getReplaceNewRegex } from './constants';
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
      const eofRegex = getEofRegex();
      eofRegex.lastIndex = startIndex;
      const eofMatch = eofRegex.exec(response);

      if (!eofMatch) {
        if (isStreaming) {
          continue;
        }
        realEndIndex = response.length;
        matchLength = 0;
      } else {
        realEndIndex = eofMatch.index;
        matchLength = eofMatch[0].length;
      }

      content = response.substring(startIndex, realEndIndex);
      if (content.startsWith('\n')) content = content.substring(1);
      else if (content.startsWith('\r\n')) content = content.substring(2);
      if (content.endsWith('\n')) content = content.substring(0, content.length - 1);
      if (content.endsWith('\r')) content = content.substring(0, content.length - 1);
    } else {
      content = '';
      realEndIndex = startIndex;
      matchLength = 0;
    }

    const cleanedContent = stripMarkdownCodeBlocks(content);
    ops.push({ action, filePath, content: cleanedContent });
    regex.lastIndex = realEndIndex + matchLength;
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
    let startLine = -1;
    let endLine = -1;
    const lineMatch = patchContent.match(/L(\d+)-L?(\d+):/i);
    let cleanPatch = patchContent;
    if (lineMatch) {
      startLine = parseInt(lineMatch[1]);
      endLine = parseInt(lineMatch[2]);
      cleanPatch = patchContent.replace(lineMatch[0], '').trim();
    }
    const startMatch = cleanPatch.match(getReplaceOldRegex());
    const dividerMatch = cleanPatch.match(getReplaceDivRegex());
    const endMatch = cleanPatch.match(getReplaceNewRegex());
    if (!startMatch || !dividerMatch || !endMatch) {
      return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceTagsMissing') };
    }
    const startIdx = startMatch.index!;
    const dividerIdx = dividerMatch.index!;
    const endIdx = endMatch.index!;
    if (dividerIdx < startIdx || endIdx < dividerIdx) {
      return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceTagsOrder') };
    }
    let oldCode = cleanPatch.substring(startIdx + startMatch[0].length, dividerIdx).trim();
    let newCode = cleanPatch.substring(dividerIdx + dividerMatch[0].length, endIdx).trim();
    oldCode = oldCode.replace(/^\n+|\n+$/g, '');
    newCode = newCode.replace(/^\n+|\n+$/g, '');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const fileLines = fileContent.split('\n');
    if (startLine > 0) {
      const searchStart = Math.max(0, startLine - 5);
      const searchEnd = Math.min(fileLines.length, endLine + 5);
      const subContent = fileLines.slice(searchStart, searchEnd).join('\n');
      if (subContent.includes(oldCode)) {
        const newSubContent = subContent.replace(oldCode, newCode);
        const newFullLines = [...fileLines.slice(0, searchStart), ...newSubContent.split('\n'), ...fileLines.slice(searchEnd)];
        fs.writeFileSync(filePath, newFullLines.join('\n'), 'utf-8');
        return { success: true, action: 'replace', filePath };
      }
    }
    if (fileContent.includes(oldCode)) {
      const parts = fileContent.split(oldCode);
      if (parts.length > 2) {
        return { success: false, action: 'replace', filePath, error: t(getLang(), 'op_replaceMultipleFound') };
      }
      const newFileContent = fileContent.replace(oldCode, newCode);
      fs.writeFileSync(filePath, newFileContent, 'utf-8');
      return { success: true, action: 'replace', filePath };
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

export async function readFileAction(filePath: string): Promise<FileOpResult> {
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
      return { success: false, action: 'read', filePath, error: t(getLang(), 'err_isDirectory') };
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
    if (lines.length > 50) {
      const truncatedContent = lines.slice(0, 50).join('\n');
      const hint = t(getLang(), 'op_readTruncatedHint', lines.length, filePath); // Using filePath (relative) for the suggested command
      return { success: true, action: 'read', filePath, output: truncatedContent + hint };
    }

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
