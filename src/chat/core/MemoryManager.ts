import * as vscode from 'vscode';
import { ChatMessage } from '../historyManager';
import { getHasActionRegex } from '../constants';


/**
 * MemoryManager - Handles context window optimization.
 * [2026-03-25] [Implementing Smart Memory Pruning] - Added smart block pruning for successful file operations and refined weighting.
 */
export class MemoryManager {
    /**
     * Assigns importance weights to messages based on their role and content types.
     * Higher weight (up to 1.0) means more likely to be kept.
     */
    // [2026-04-08] [State-Machine-Parser] - Reconstruct AI-readable context from sequential blocks[] with structured pruning
    public static renderBlock(block: any, isFresh: boolean): string {
        if (block.type === 'speak') return block.text || '';
        if (block.type !== 'action') return '';

        const action = block.action || 'execute';
        const id = block.id || '00000000';
        const path = block.filePath || '';
        const rawContent = block.content || '';

        // [2026-04-08] Head/Tail Truncation for non-fresh messages
        let displayContent = rawContent;
        if (!isFresh && rawContent.length > 2000) {
            // [2026-04-09] [Guard] - Avoid middle-truncation for critical state files as the middle often contains the most recent updates
            const isStateFile = path.toLowerCase().includes('findings.md') ||
                path.toLowerCase().includes('task_plan.md') ||
                path.toLowerCase().includes('progress.md');

            if (isStateFile) {
                // For state files, we prefer showing the tail (most recent) if we must truncate, 
                // but ideally we keep more of it.
                displayContent = rawContent.slice(-Math.min(rawContent.length, 5000));
                if (rawContent.length > 5000) {
                    displayContent = `... (Old history truncated) ...\n\n${displayContent}`;
                }
            } else {
                const head = rawContent.slice(0, 1000);
                const tail = rawContent.slice(-1000);
                displayContent = `${head}\n\n... (Content truncated to save tokens. Middle ${rawContent.length - 2000} chars hidden) ...\n\n${tail}`;
            }
        }

        let internalTags = '';
        if (action === 'read') {
            let start = '';
            let end = '';
            const hashIdx = path.lastIndexOf('#L');
            const cleanPath = hashIdx !== -1 ? path.substring(0, hashIdx) : path;
            if (hashIdx !== -1) {
                const range = path.substring(hashIdx + 2).split('-');
                if (range[0]) start = `\n    <start_line>${range[0]}</start_line>`;
                if (range[1]) end = `\n    <end_line>${range[1]}</end_line>`;
            }
            internalTags = `<path>${cleanPath}</path>${start}${end}`;
        } else if (action === 'execute') {
            internalTags = `<command>${path}</command>`;
        } else if (action === 'replace') {
            // [2026-04-08] Note: 'replace' content is special as it contains search/replace tags
            // For now, we apply simple truncation, but ideally we should be tag-aware.
            internalTags = `<path>${path}</path>\n    ${displayContent}`;
        } else if (action === 'create' || action === 'modify') {
            internalTags = `<path>${path}</path>\n    <content>\n${displayContent}\n    </content>`;
        } else {
            internalTags = `<path>${path}</path>`;
        }

        return `<tool_call>\n  <name>${action}</name>\n  <tool_call_id>${id}</tool_call_id>\n  <arguments>\n    ${internalTags}\n  </arguments>\n</tool_call>\n`;
    }

    public static buildApiContent(msg: ChatMessage, isFresh: boolean = true): string {
        if (!msg.blocks || msg.blocks.length === 0) {
            return msg.content || '';
        }

        return msg.blocks.map(b => MemoryManager.renderBlock(b, isFresh)).join('');
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
            } else if (m.role === 'tool') {
                m.weight = 0.8;
            } else {
                m.weight = 0.5;
            }

            // [Heuristic] Execution results: Error is much more important than Success
            if (m.content.includes('[Execution Result]')) {
                if (m.content.includes('failed')) {
                    m.weight = 0.9;
                } else if (m.content.includes('succeeded')) {
                    m.weight = 0.8;
                }
            }

            // [2026-04-09] [State-Protection] - Identify if message is related to critical state files
            const isStateRelated = m.content.toLowerCase().includes('findings.md') ||
                m.content.toLowerCase().includes('task_plan.md') ||
                m.content.toLowerCase().includes('progress.md') ||
                (m.blocks && m.blocks.some(b => b.filePath && (
                    b.filePath.toLowerCase().includes('findings.md') ||
                    b.filePath.toLowerCase().includes('task_plan.md') ||
                    b.filePath.toLowerCase().includes('progress.md')
                )));

            if (isStateRelated) {
                m.weight = 1.0; // Protect state updates from being pruned
            }

            // Turn-based decay: messages older than 20 turns decay by 20%
            const age = messages.length - 1 - index;
            if (age > 20 && m.weight < 1.0) {
                // [2026-04-09] [Guard] - Do not decay if the message contains a completion signal
                const isCompletion = m.content.includes('<DONE/>');
                if (!isCompletion) {
                    m.weight *= 0.8;
                }
            }
        });
    }

    public static prune(messages: ChatMessage[], maxCharsPerMessage: number = 20000): ChatMessage[] {
        const config = vscode.workspace.getConfiguration('bwsCoder');
        const maxTotalChars = config.get<number>('maxMemoryBudget') || 150000;

        // [2026-04-09] [Volume-Based Freshness] - Pre-calculate which messages are "fresh" based on data volume
        // We protect a portion (e.g. 30%) of the budget as "SAFE_FRESH_VOLUME" to avoid middle-truncation for recent items.
        const SAFE_FRESH_VOLUME = Math.floor(maxTotalChars * 0.3);
        let cumulativeVolume = 0;
        const freshStatus = new Array(messages.length).fill(false);
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            const estimate = m.role === 'assistant' ? MemoryManager.buildApiContent(m, true).length : (m.content?.length || 0);
            cumulativeVolume += estimate;
            if (cumulativeVolume <= SAFE_FRESH_VOLUME) {
                freshStatus[i] = true;
            } else {
                break; // Stop marking as fresh once we exceed the buffer
            }
        }

        let processed = messages
            .filter(m => (m.content && m.content.trim().length > 0) || (m.attachments && m.attachments.length > 0))
            .map((m, index) => {
                // [2026-04-08] Use volume-based freshness status
                const isFresh = freshStatus[index];

                // [2026-03-28] [FileOps-Refactor] - Use buildApiContent to reconstruct full context text for LLM
                let content = m.role === 'assistant' ? MemoryManager.buildApiContent(m, isFresh) : m.content;




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
                    if (originalIndex >= processed.length - 1) return false; // Never touch the absolute latest interaction turn
                    if (m.isPruned && m.pruneReason === 'global_budget_limit') return false;

                    // [2026-04-09] [Guard] - Protect fresh and short messages
                    if (freshStatus[originalIndex]) return false; // Protect recent volume
                    if ((m.content?.length || 0) < 1000) return false; // Don't archive short messages (too little savings, high context cost)

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
