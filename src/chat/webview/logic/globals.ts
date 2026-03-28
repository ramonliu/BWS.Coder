export class Globals {
    public static get(): string {
        return `
            var vscode = acquireVsCodeApi();
            window.vscode = vscode;
            var messages = [], attachments = [], isGenerating = false, currentSessionId = 'Single', chatMode = 'Single';
            var blockStates = {}; // 追蹤區塊狀態: messageId -> boolean
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
                    
                    var scrollBottom = c.scrollTop + c.clientHeight;
                    var pageHeight = c.scrollHeight;
                    
                    // Flexbox 結構中，#container 本身已不包含下方輸入框，可以直接把容許值設為 40px
                    if (pageHeight - scrollBottom <= 20) {
                        window.isAutoScrollOn = true;
                    } else {
                        window.isAutoScrollOn = false;
                    }
                }, { passive: true });
            }, 0);
            // 移除全域常點，改為動態獲取
        `;
    }
}
