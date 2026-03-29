/**
 * BWS Coder - Workflow Logic Self-Test
 * 驗證 WorkflowRunner 的邏輯：
 * 1. 偵測到 [@@DONE@@] 時應結束步驟
 * 2. 只有檔案操作 (Ops) 時應重置回合數 (turnCount = 0)
 * 3. 內容為空時不應提前結束，應繼續嘗試直到次數上限
 */

// --- Mocks & local enums (Self-contained) ---
enum TaskMonitorStatus {
    IDLE = 'Idle',
    THINKING = 'Thinking',
    EXECUTING = 'Executing',
    REPORTING = 'Reporting',
    FINISHED = 'Finished'
}

// --- Mocks ---
const mockVscode = {
    workspace: {
        getConfiguration: () => ({
            get: (key: string) => (key === 'maxTurnsPerStep' ? 3 : 30) // 縮短測試回合
        })
    }
};

const mockTaskMonitor = {
    getInstance: () => ({
        updateStatus: (pid: any, name: any, status: any, isCloud: any, reason: any, taskName: any) => {
            console.log(`[MONITOR] ${taskName}: ${status} (${reason})`);
        }
    })
};

// --- 被測試的邏輯簡化版 (摘錄自 WorkflowRunner.ts) ---
async function simulateWorkflowStep(stepRole: string, stepPrompt: string, scenarios: any[]) {
    console.log(`\n>>> 開始測試步驟: ${stepRole}`);
    let turnCount = 0;
    const MAX_TURNS = 3;
    let isStepDone = false;
    let currentTurn = 0;

    while (!isStepDone && turnCount < MAX_TURNS) {
        turnCount++;
        currentTurn++;
        const response = scenarios[currentTurn - 1] || { content: "", hasOps: false };
        
        console.log(`[Turn ${currentTurn}] AI 回應: "${response.content.replace(/\n/g, ' ')}" | 有操作: ${response.hasOps}`);

        // 此處為實際在 WorkflowRunner.ts 中的修正邏輯
        const content = response.content || '';
        const isDone = content.includes('[@@DONE@@]') || content.includes('[DONE]');

        if (isDone) {
            console.log(`[LOG] 偵測到完成標籤，結束步驟。`);
            isStepDone = true;
        } else if (response.hasOps) {
            turnCount = 0; 
            console.log(`[LOG] 偵測到操作，重置回合數 (turnCount -> 0)。`);
        } else if (!content.trim()) {
            console.log(`[LOG] 內容為空且無操作，不結束，繼續下一回合 (turnCount: ${turnCount}/${MAX_TURNS})`);
        }

        if (turnCount >= MAX_TURNS) {
            console.log(`[LOG] 達到回合上限 ${MAX_TURNS}，強制停止。`);
        }
    }

    return isStepDone;
}

// --- 執行測試案例 ---
async function runTests() {
    // 案例 1: 正常流程 (執行 -> 完成)
    const scenario1 = [
        { content: "正在建立檔案...", hasOps: true },
        { content: "任務完成！[@@DONE@@]", hasOps: false }
    ];
    const res1 = await simulateWorkflowStep("專案規劃師", "請規劃專案", scenario1);
    console.log(`測試 1 結果: ${res1 ? "✅ 通過 (正確結束)" : "❌ 失敗"}`);

    // 案例 2: 混合模式 (最後一次操作同時帶標籤) - 這是之前出錯的地方
    const scenario2 = [
        { content: "建立最後一個檔案並結束 [@@DONE@@]", hasOps: true }
    ];
    const res2 = await simulateWorkflowStep("架構師", "設計資料庫", scenario2);
    console.log(`測試 2 結果: ${res2 ? "✅ 通過 (正確優先處理標籤)" : "❌ 失敗"}`);

    // 案例 3: 空回應測試 (不應連鎖跳過)
    const scenario3 = [
        { content: "", hasOps: false },
        { content: "", hasOps: false },
        { content: "終於有回應了 [@@DONE@@]", hasOps: false }
    ];
    const res3 = await simulateWorkflowStep("前端開發", "寫 HTML", scenario3);
    console.log(`測試 3 結果: ${res3 ? "✅ 通過 (未被空回應跳過)" : "❌ 失敗"}`);
}

runTests().catch(console.error);
