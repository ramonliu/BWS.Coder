export class Globals {
    public static get(): string {
        return `
            var vscode = acquireVsCodeApi();
            window.vscode = vscode;
            var messages = [], attachments = [], isGenerating = false, currentSessionId = 'Single', chatMode = 'Single';
            var blockStates = {}; // 追蹤區塊狀態: messageId -> boolean
            var domCache = new Map(); // [2026-03-30] Performance: ID -> DOM
            var htmlCache = {}; // [2026-03-30] Performance: ID -> HTML
            var workflowSteps = []; // 工作流步驟
            var availableModels = []; // 可用模型清單
            var lastDashboardStats = []; // 全域 LLM 狀態
            // [2026-03-31] [Auto-Scroll] - Auto-Scroll Manager: ResizeObserver + Event-based intent detection
            window.isAutoScrollOn = true;
            window.isProgScroll = false;
            
            setTimeout(function() {
                var c = document.getElementById('container');
                if (!c) return;
                var cw = c.querySelector('.chat-container') || c.firstElementChild;
                if (!cw) return;
                
                var autoScrollTimeout = null;
                var ro = new ResizeObserver(function() {
                    if (window.isAutoScrollOn && c) {
                        window.isProgScroll = true;
                        c.scrollTo({ top: c.scrollHeight, behavior: 'auto' });
                        
                        clearTimeout(autoScrollTimeout);
                        autoScrollTimeout = setTimeout(function() {
                            window.isProgScroll = false;
                        }, 50);
                    }
                });
                ro.observe(cw);
                
                c.addEventListener('scroll', function() {
                    if (window.isProgScroll) return;
                    
                    var isAtBottom = (c.scrollTop + c.clientHeight >= c.scrollHeight - 10);
                    window.isAutoScrollOn = isAtBottom;
                }, { passive: true });
            }, 0);
            // 移除全域常點，改為動態獲取
        `;
    }
}
