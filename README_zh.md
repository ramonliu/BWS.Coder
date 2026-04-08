# BWS.Coder - AI 程式工程師 (Autonomous Agent)

[English](README.md) | [繁體中文](README_zh.md)

---

**BWS.Coder** 是一款專為 VS Code 打造的「自主式」AI 開發助理。它不僅是程式碼生成器，更是一個具備 **Agentic Loop**（自主循環）能力的開發夥伴，能夠自主編譯、分析報錯、執行測試並完成修復。

---

## 💬 指令與語法 (Commands & Syntax)

### 🏃 使用者斜槓指令 (User Slash Commands)
您可以直接在對話框輸入以下指令來控制 AI 行為：

| 指令 | 說明 |
| :--- | :--- |
| `/clear` | 清除當前對話歷史與 AI 的短期記憶，重置上下文。 |
| `/plan` | 啟動 **AI 任務規劃流程**，AI 會先輸出計畫再執行。 |
| `/group` / `/debate` | 啟動 **群組辯論模式**，邀請多個 AI 人格共同參與。 |
| `/stop` | 立即停止 AI 生成內容或中止正在背景執行的命令。 |
| `/export` | 匯出目前對話紀錄為 HTML、Markdown、純文字或 XML。 |
| `/handover` | 產生專案交接資訊，供下個 AI Session 快速接續進度。 |
| `/setting` | 立即開啟 **「LLM 參數設定」** 面板。 |
| `/manage` | 立即開啟 **「AI 提供者與模型管理」** 面板。 |

### 🤖 XML 工具調用協議 (XML Tool Call Protocol)
BWS.Coder 現在使用強健的 XML **工具調用協議** 進行精確且可靠的檔案操作。這種結構化設計能有效防止解析錯誤，並確保在不同 LLM 模型間的一致執行行為。

| 工具名稱 | XML 範例區塊 | 功能說明 |
| :--- | :--- | :--- |
| `read` | `<tool_call><name>read</name><arguments><path>路徑</path></arguments></tool_call>` | 讀取檔案內容（支援指定行號範圍）。 |
| `create` | `<tool_call><name>create</name><arguments><path>路徑</path><content>...</content></arguments></tool_call>` | 建立新檔案並寫入內容。 |
| `modify` | `<tool_call><name>modify</name><arguments><path>路徑</path><content>...</content></arguments></tool_call>` | 完全重寫現有檔案。 |
| `replace` | `<tool_call><name>replace</name><arguments><path>路徑</path><search>...</search><replace>...</replace></arguments></tool_call>` | 執行精確的區域搜尋與替換。 |
| `execute` | `<tool_call><name>execute</name><arguments><command>指令</command></arguments></tool_call>` | 在終端機執行 Shell 命令。 |
| `delete` | `<tool_call><name>delete</name><arguments><path>路徑</path></arguments></tool_call>` | 刪除指定檔案。 |

---

## 🌟 核心特色 (Core Features)

### 🚀 多元化 Agent 模式
- **Workflow 模式**：引進結構化的開發流程（設計 -> 實作 -> 驗證）。AI 會根據任務自動拆解步驟，並逐步完成，是大型任務的首選。
- **群組辯論 (Group/Debate)**：支援多人格（Persona）協作。透過不同的思維模型（如架構師、後端、前端）進行辯論與互審，產出更嚴謹的解決方案。
- **單人模式 (Single)**：即時解決小型問題，反應迅速。

### 🧠 智能記憶管理 (Context Optimization)
- **彈性資料量保鮮技術 (Volume-Based Freshness)**：尖端的記憶感知機制。系統會自動鎖定最靠近目前的 **32,000 字（約 8k tokens）** 對話內容絕對不進行任何修剪，確保 AI 對當前討論擁有完美的短期記憶。
- **結構化塊狀修剪 (Structured Block Pruning)**：當檔案進入歷史紀錄且過長時，系統會智慧保留檔案的**頭尾各 1,000 字**，並透過「結構化渲染」重新產生有效的 XML 工具調用結果。這徹底解決了 AI 因為「失憶」而陷入重複讀取檔案的死循環。

### 📊 實時任務儀表板 (Live Dashboard)
- **視覺化監控**：即時展示當前任務的執行狀態、API 消耗、模型性能與系統心跳。
- **任務進度牆**：自動同步專案中的 `task_plan.md` 與 `progress.md`，讓開發進度一目了然。

### 📡 全方位模型與 API 輪詢
- **Ollama 本地驅動**：保護隱私，純本地運行。
- **Gemini 雲端加速**：完美支援 Gemini 1.5 系列。
- **自動 API 輪詢**：支援多組 API Key 自動輪換，當一組額度用盡時，無縫切換至下一組，確保開發不中斷。
- **全球語系支援 (New!)**：所有組件、UI 以及 AI 運行狀態輸出現在完整支援 **繁體中文**、**簡體中文** 與 **英文**，並具備即時語系同步更新功能。

---

## 🛠️ 強大功能 (Capabilities)

### 📸 多媒體與 UI 優化
- **截圖即貼 (Ctrl+V)**：支援從剪貼簿直接貼上圖片，讓 AI 進行視覺化分析（如 UI 調整）。
- **圖片精簡彈窗 (Compact Mode)**：點擊圖片預覽時，自動開啟獨立、簡潔的懸浮視窗。
- **原生檔案上傳**：內建迴紋針圖示，可快速選取多個本地檔案作為附件。

### 🛡️ 強制驗證機制 (Proactive Verification)
- **寫完即測試**：在 `chat_system.md` 的引導下，AI 寫完代碼會主動執行 `npm install`、啟動 Server 或發起 `curl` 請求，並根據測試結果進行自我修補。
- **非阻塞執行**：專屬的終端機輸出頻道，不干擾您的日常操作。

---

## 🚀 快速開始

### 前置需求
- **VS Code** (v1.85+)
- (選配) **Ollama**：用於本地運行。
- (選配) **Gemini API Key**：前往 [Google AI Studio](https://aistudio.google.com/) 申請。

### 安裝方式
1. 下載 `bws-coder-x.x.x.vsix`。
2. 在 VS Code 擴充功能面板中選擇 `從 VSIX 安裝`。

---

## ⚙️ 重要設定 (Settings)

| 設定項目 | 說明 | 預設值 |
| :--- | :--- | :--- |
| `bwsCoder.temperature` | 生成溫度 (0-1)，越低越精確 | `0.3` |
| `bwsCoder.maxTokens` | 模型最大輸出 Token 數 | `4096` |
| `bwsCoder.maxTurnsPerStep` | 工作流單一步驟最大輪數 (安全性限制) | `30` |
| `bwsCoder.heartbeatTimeout`| 回應偵測逾時 (秒)，本地模型自動補償 10 倍 | `30` |
| `bwsCoder.autoFallback` | 主要模型失效時，是否自動切換至備援 | `true` |
| `bwsCoder.debugMode` | 開啟後顯示狀態機日誌與詳細排除資訊 | `false` |
| `bwsCoder.language` | 輸出語系 (zh-TW, zh-CN, en)，且 UI 會即時同步更新 | `zh-TW` |

---

## 📂 專案結構

```bash
BWS.Coder/
├── src/
│   ├── chat/             # 核心語意解析、Workflow 引擎與 UI 通訊
│   ├── llm/              # 多模型適配器 (Ollama/Gemini) 與輪詢系統
│   └── utils/            # 系統 Prompts (chat_system.md) 與共用工具
├── prompts/              # 定義 AI 靈魂的系統提示詞
├── media/                # UI 圖示與視覺資源
└── package.json          # 插件定義與 VS Code 配置
```

---

## 📝 授權與聲明

MIT License - **BaldWolf Studio** 持續開發中。
<!-- [2026-03-28] [FIX_README_UPGRADE] - Multi-language support (EN/ZH). -->
