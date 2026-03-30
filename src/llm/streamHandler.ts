import { TextDecoder } from 'util';
import { Readable } from 'stream';
import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * 統一的串流內容提取器介面
 */
export type ContentExtractor = (json: any) => { content?: string, thinking?: string };

/**
 * 串流處理配置
 */
export interface StreamOptions {
    onProgress?: (chunk: { content?: string, thinking?: string }) => void | Promise<void>;
    onFirstChunk?: () => void | Promise<void>;
    cancellationToken?: vscode.CancellationToken;
    extractor: ContentExtractor;
    providerName: string;
    dumpPath?: string; // 診斷用：儲存原始串流內容
    isCloud?: boolean;
    providerId?: string;
    taskName?: string;
}

/**
 * 核心串流處理器：利用括號匹配計數器解決連體 JSON 與數據遺失問題
 */
/**
 * 核心串流處理器：利用括號匹配計數器解決連體 JSON 與數據遺失問題
 * 改為 AsyncGenerator 以便外部即時處理與渲染
 */
export async function* processStream(
    stream: Readable,
    options: StreamOptions
): AsyncGenerator<{ content?: string, thinking?: string }> {
    const { onProgress, onFirstChunk, cancellationToken, extractor, providerName, dumpPath } = options;
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lineBuffer = ''; // 用於實現「逐行」輸出的緩衝區
    let isFirst = true;
    let totalBytes = 0;
    let chunkCount = 0;

    // 逾時控制參數
    const startTime = Date.now();
    let lastChunkTime = Date.now();
    const config = vscode.workspace.getConfiguration('bwsCoder');
    const baseHeartbeat = config.get<number>('heartbeatTimeout') || 30;
    const SILENCE_TIMEOUT = (options.isCloud === false ? baseHeartbeat * 10 : baseHeartbeat) * 1000; 

    let isStreamDestroyed = false;

    if (dumpPath) {
        try { if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath); } catch { }
    }

    // 定期檢查
    const monitorInterval = setInterval(() => {
        if (isStreamDestroyed || cancellationToken?.isCancellationRequested) return;

        const now = Date.now();
        // 沉默逾時 (Heartbeat) - 首位資料給予 3 倍寬限 (Prompt Processing 較慢)
        const waitTime = isFirst ? SILENCE_TIMEOUT * 3 : SILENCE_TIMEOUT;
        if (now - lastChunkTime > waitTime) {
            isStreamDestroyed = true;
            const seconds = waitTime / 1000;
            const reason = options.isCloud === false ? `Local LLM 停擺 (${seconds}秒未回應)` : `LLM 沒回應 (${seconds}秒沉默逾時)`;
            if (stream.destroy) stream.destroy(new Error(`STALLED: ${reason}`));
        }
    }, 1000);

    try {
        for await (const chunk of stream) {
            if (cancellationToken?.isCancellationRequested) {
                if (stream.destroy) stream.destroy();
                break;
            }

            const dataChunk = chunk as Buffer;
            totalBytes += dataChunk.length;
            chunkCount++;
            lastChunkTime = Date.now();

            if (dumpPath) fs.appendFileSync(dumpPath, dataChunk);

            if (isFirst) {
                isFirst = false;
                if (onFirstChunk) await onFirstChunk();
            }

            buffer += decoder.decode(dataChunk, { stream: true });

            while (true) {
                const start = buffer.indexOf('{');
                if (start === -1) {
                    if (buffer.length > 1000) buffer = buffer.substring(buffer.length - 500);
                    break;
                }

                if (start > 0) {
                    buffer = buffer.substring(start);
                    continue;
                }

                let braceCount = 0;
                let inString = false;
                let escaped = false;
                let end = -1;

                for (let i = 0; i < buffer.length; i++) {
                    const char = buffer[i];
                    if (escaped) { escaped = false; continue; }
                    if (char === '\\') { escaped = true; continue; }
                    if (char === '"') { inString = !inString; continue; }
                    if (!inString) {
                        if (char === '{') braceCount++;
                        else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) { end = i; break; }
                        }
                    }
                }

                if (end !== -1) {
                    const jsonStr = buffer.substring(0, end + 1);
                    try {
                        const json = JSON.parse(jsonStr);
                        
                        // [2026-03-30] Fix - OpenRouter 可能回傳 200 OK 但內容為 {"error": {"message": "..."}}
                        if (json.error) {
                            const errorMsg = typeof json.error === 'string' ? json.error : (json.error.message || JSON.stringify(json.error));
                            throw new Error(`API 錯誤: ${errorMsg}`);
                        }

                        const extracted = extractor(json);
                        
                        if (extracted.content || extracted.thinking) {
                            if (onProgress) await onProgress(extracted);
                            
                            // 實現「逐行」Yield
                            if (extracted.content) {
                                lineBuffer += extracted.content;
                                if (lineBuffer.includes('\n')) {
                                    const lines = lineBuffer.split('\n');
                                    lineBuffer = lines.pop() || ''; // 最後一行可能未完，留著
                                    for (const line of lines) {
                                        yield { content: line + '\n' };
                                    }
                                }
                            }
                            if (extracted.thinking) {
                                yield { thinking: extracted.thinking };
                            }
                        }
                    } catch (e: any) {
                        // 如果是我們自己拋出的 API 錯誤，往上拋出中斷串流
                        if (e.message && e.message.startsWith('API 錯誤')) {
                            throw e;
                        }
                        console.error(`[${providerName}] JSON 解析失敗: ${e.message}.`);
                    }
                    buffer = buffer.substring(end + 1);
                } else {
                    if (buffer.length > 1024 * 1024) {
                        const lastBrace = buffer.lastIndexOf('{');
                        buffer = lastBrace === -1 ? '' : buffer.substring(lastBrace);
                    }
                    break;
                }
            }
        }

        // 結束後 Yield 剩餘的內容
        if (lineBuffer) {
            yield { content: lineBuffer };
        }

    } catch (error: any) {
        // [2026-03-25] [Fixing RESCUE Timing] - Ensure STALLED error is re-thrown after yielding lineBuffer
        if (lineBuffer) yield { content: lineBuffer };
        
        if (error.message.includes('STALLED:')) {
            throw error; 
        }
        if (!error.message.includes('Premature close')) {
            throw error;
        }
    } finally {
        if (monitorInterval) clearInterval(monitorInterval);
        
        // 紀錄活動 (若有數據)
        // 注意：為了避免循環依賴，這裡動態載入 TaskMonitor
        if (totalBytes > 0) {
            import('../chat/taskMonitor').then(m => {
                m.TaskMonitor.getInstance().recordActivity(
                    options.providerId || 'openai', 
                    Math.ceil(totalBytes / 4), 
                    Date.now() - startTime, 
                    undefined,
                    options.taskName
                );
            });
        }
    }
}
