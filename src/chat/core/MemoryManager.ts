import * as vscode from 'vscode';
import { ChatMessage } from '../historyManager';
import { getHasActionRegex, getPruneBlockRegex } from '../constants';


/**
 * MemoryManager - Handles context window optimization.
 * [2026-03-25] [Implementing Smart Memory Pruning] - Added smart block pruning for successful file operations and refined weighting.
 */
export class MemoryManager {
    /**
     * Assigns importance weights to messages based on their role and content types.
     * Higher weight (up to 1.0) means more likely to be kept.
     */
    // [2026-03-28] [State-Machine-Parser] - Reconstruct AI-readable context from sequential blocks[]
    public static buildApiContent(msg: ChatMessage): string {
        if (!msg.blocks || msg.blocks.length === 0) {
            // Legacy message
            return msg.content || '';
        }

        let text = '';
        for (const block of msg.blocks) {
            if (block.type === 'speak') {
                text += block.text || '';
            } else if (block.type === 'action') {
                if (block.action === 'read' || block.action === 'execute') {
                    if (block.success && block.result !== undefined) {
                        // [2026-04-02] Fix: If read is truncated/paginated, omit "succeeded" to not confuse AI
                        if (block.action === 'read' && (block.result.includes('[Hint:') || block.result.includes('[提示：'))) {
                            const isRange = (block.filePath || '').includes('#L');
                            let displayFile = block.filePath;
                            if (!isRange) {
                                // 動態計算回傳的實際內容有多少行（扣除最後的 Hint）
                                const splitIdx = block.result.lastIndexOf('\n\n[');
                                const actualLines = splitIdx !== -1 
                                    ? block.result.substring(0, splitIdx).split('\n').length 
                                    : 50;
                                displayFile = `${block.filePath}#L1-${actualLines}`;
                            }
                            text += `read ${displayFile} output:\n${block.result}\n`;
                        } else {
                            text += `${block.action} ${block.filePath} succeeded. Output:\n${block.result}\n`;
                        }
                    } else if (block.success === false) {
                        text += `${block.action} ${block.filePath} failed: ${block.result || 'Unknown error'}\n`;
                    } else {
                        // [2026-04-02] Fix: isPending block - do NOT re-emit the raw [@@ tag @@] as the AI
                        // would interpret it as a pending instruction and execute it again (causing duplicates).
                        text += `${block.action} ${block.filePath} (result pending)\n`;
                    }
                } else if (block.action === 'create' || block.action === 'modify' || block.action === 'replace') {
                    const contentArg = block.action === 'replace' 
                        ? (block.content ?? '')
                        : `<content>\n${block.content ?? ''}\n</content>`;
                    text += `<tool_call>\n  <name>${block.action}</name>\n  <arguments>\n    <path>${block.filePath}</path>\n    ${contentArg}\n  </arguments>\n</tool_call>\n`;
                } else if (block.action === 'delete') {
                    if (block.success) {
                        text += `delete ${block.filePath} succeeded.\n`;
                    } else if (block.success === false) {
                        text += `delete ${block.filePath} failed: ${block.result || 'Unknown error'}\n`;
                    } else {
                        text += `<tool_call>\n  <name>${block.action}</name>\n  <arguments>\n    <path>${block.filePath}</path>\n  </arguments>\n</tool_call>\n`;
                    }
                } else {
                    const argKey = block.action === 'execute' ? 'command' : 'path';
                    text += `<tool_call>\n  <name>${block.action}</name>\n  <arguments>\n    <${argKey}>${block.filePath}</${argKey}>\n  </arguments>\n</tool_call>\n`;
                }
            }
            // Ignore 'think' type, thought tokens shouldn't be added to past context typically, 
            // or if they are they are managed by the LLM client adapter natively for prolonged reasoning.
        }
        return text;
    }

    public static assignWeights(messages: ChatMessage[]): void {
        messages.forEach((m, index) => {
            // Already assigned or manually set? Keep it.
            if (m.weight !== undefined && m.weight > 0) return;

            // Default weight logic
            if (m.role === 'system') {
                m.weight = 1.0;
            } else if (m.role === 'user') {
                // [2026-03-25] RESCUE consistency - System rescue messages are critical (localized support)
                if (m.content.includes('[System Rescue]') || m.content.includes('[系統自我救援]') || m.content.includes('[系统自我救援]')) {
                    m.weight = 1.0;
                } else {
                    m.weight = 1.0;
                }
            } else if (m.role === 'assistant') {
                // [2026-03-28] [State-Machine-Parser] - Check blocks[] first, fallback to regex for old messages
                const hasActions = (m.blocks && m.blocks.some(b => b.type === 'action')) || getHasActionRegex().test(m.content);
                m.weight = hasActions ? 0.8 : 0.4;
            } else {
                m.weight = 0.5;
            }

            // [Heuristic] Execution results: Error is much more important than Success
            if (m.content.includes('[Execution Result]')) {
                if (m.content.includes('failed')) {
                    m.weight = 0.9;
                } else if (m.content.includes('succeeded')) {
                    m.weight = 0.4;
                }
            }

            // Turn-based decay: messages older than 20 turns decay by 20%
            const age = messages.length - 1 - index;
            if (age > 20 && m.weight < 1.0) {
                m.weight *= 0.8;
            }
        });
    }

    /**
     * Pruning Logic - Identifies successful file operations to compress the history.
     */
    private static getSuccessfulPaths(messages: ChatMessage[]): Set<string> {
        const paths = new Set<string>();
        for (const m of messages) {
            if (m.role === 'user' && m.content.includes('[Execution Result]')) {
                const match = m.content.match(/```json\n([\s\S]*?)\n```/);
                if (match) {
                    try {
                        const results = JSON.parse(match[1]);
                        if (Array.isArray(results)) {
                            for (const r of results) {
                                if (['create', 'modify', 'replace'].includes(r.name) && r.result === 'succeeded') {
                                    if (r.path) {
                                        paths.add(r.path.trim());
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            }
        }
        return paths;
    }

    /**
     * Prunes or summarizes messages to fit within a context budget.
     * Returns a new array of messages for the LLM payload.
     */
    public static prune(messages: ChatMessage[], maxCharsPerMessage: number = 2000): ChatMessage[] {
        const config = vscode.workspace.getConfiguration('bwsCoder');
        const maxTotalChars = config.get<number>('maxMemoryBudget') || 10240;

        const successes = this.getSuccessfulPaths(messages);

        let processed = messages
            .filter(m => (m.content && m.content.trim().length > 0) || (m.attachments && m.attachments.length > 0))
            .map(m => {
                // [2026-03-28] [FileOps-Refactor] - Use buildApiContent to reconstruct full context text for LLM
                let content = m.role === 'assistant' ? MemoryManager.buildApiContent(m) : m.content;

                // [2026-03-28] [Fix-Pruning-Hallucination] - Fix AI mimicking the prune note by preserving the syntax in history. 
                if (m.role === 'assistant' && content.includes('<tool_call>')) {
                    content = content.replace(getPruneBlockRegex(), (match, action, path, code) => {
                        const cleanPath = path.trim();
                        // [2026-03-28] [FIX_PRUNING_HALLUCINATION] - Zero-artifact pruning (completely strip successful blocks from history)
                        if (successes.has(cleanPath)) {
                            return `${action} ${cleanPath} succeeded`;
                        }
                        return match;
                    });
                }

                // Never prune high-weight messages (User instructions / System prompt)
                if (m.weight && m.weight >= 1.0) return { ...m, content };

                // If content is very long and weight is low, summarize it
                if (content.length > maxCharsPerMessage) {
                    const weight = m.weight || 0.5;

                    // Summarization depth depends on weight
                    if (weight < 0.5) {
                        // Deep compression
                        const summary = `[Compressed: ${m.role} message (${content.length} chars, weight ${weight.toFixed(1)}) - Content hidden to save context]`;
                        return { ...m, content: summary, isPruned: true, pruneReason: 'low_weight_compression' };
                    } else if (weight < 0.9) {
                        // Partial compression: Keep start and end
                        const keep = Math.floor(maxCharsPerMessage / 2);
                        const head = content.slice(0, keep);
                        const tail = content.slice(-keep);
                        const summary = `${head}\n\n... (Pruned ${content.length - maxCharsPerMessage} chars for efficiency) ...\n\n${tail}`;
                        return { ...m, content: summary, isPruned: true, pruneReason: 'length_limit' };
                    }
                }

                return { ...m, content };
            });

        // [2026-04-01] Global Budget Limit - Compress lowest-weight messages if total exceeds maxTotalChars
        let totalLength = processed.reduce((sum, m) => sum + (m.content?.length || 0), 0);

        if (totalLength > maxTotalChars) {
            const compressible = processed
                .map((m, originalIndex) => ({ m, originalIndex }))
                .filter(({ m, originalIndex }) => {
                    if (m.role === 'system') return false; // Never touch system prompts
                    if (m.weight && m.weight >= 1.0) return false; // Skip protected high-weight user commands
                    if (originalIndex >= processed.length - 2) return false; // Never touch the absolute latest interaction turn
                    if (m.isPruned && m.pruneReason === 'global_budget_limit') return false;
                    return (m.content?.length || 0) > 50;
                });

            // Sort by importance primarily (lowest weight first), then age (older first)
            compressible.sort((a, b) => {
                const wA = a.m.weight || 0.5;
                const wB = b.m.weight || 0.5;
                if (wA !== wB) return wA - wB;
                return a.originalIndex - b.originalIndex;
            });

            for (const item of compressible) {
                if (totalLength <= maxTotalChars) break;

                const { m } = item;
                const originalLen = m.content?.length || 0;
                const breadcrumb = `[歷史摘要: ${(m.role).toUpperCase()} 訊息已為了節省空間而歸檔 (原長度: ${originalLen} 字)]`;
                m.content = breadcrumb;
                m.isPruned = true;
                m.pruneReason = 'global_budget_limit';

                totalLength -= (originalLen - breadcrumb.length);
            }
        }

        return processed;
    }
}
