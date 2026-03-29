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
            // [2026-03-28] [Auto-Scroll] - Event-based State Check (User Requested)
            window.isAutoScrollOn = true;
            window.isProgScroll = false;
            
            // DOM 已經產生，抓取正在控制捲曲的容器 (#container)
            setTimeout(function() {
                var c = document.getElementById('container');
                if (!c) return;
                
                c.addEventListener('scroll', function() {
                    // 若是由程式呼叫的快速捲動，忽略以防誤判
                    if (window.isProgScroll) return;
                    
                    // [2026-03-30] Refined Scroll Logic: 使用「是否在最底部 (value == max)」來判定是否開啟 Auto-Scroll
                    var isAtBottom = (c.scrollTop + c.clientHeight >= c.scrollHeight - 5);
                    window.isAutoScrollOn = isAtBottom;
                }, { passive: true });
            }, 0);
            // 移除全域常點，改為動態獲取
        `;
    }
}
