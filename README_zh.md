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

### 🤖 AI 內部通訊標籤 (AI Protocol Tags)
BWS.Coder 使用一套嚴格的正則解析協議來執行您的指令。AI 會在回覆中使用以下標籤：

| 標籤語法 | 功能說明 |
| :--- | :--- |
| `[@@ create:路徑 @@]` | 在指定路徑建立新檔案（並寫入完整內容）。 |
| `[@@ modify:路徑 @@]` | 重寫並替換現有檔案的內容。 |
| `[@@ replace:路徑 @@]` | 對大型檔案進行精確的「局部搜尋與替換」。 |
| `[@@ read:路徑 @@]` | 讀取磁碟檔案內容，讓 AI 獲取上下文。 |
| `[@@ execute:指令 @@]` | 在終端機執行 Shell 命令（如 `npm install`）。 |
| `[@@ delete:路徑 @@]` | 永久刪除指定的檔案。 |
| `[@@DONE@@]` | AI 確認所有開發與測試步驟皆已滿意完成。 |

---

## 🌟 核心特色 (Core Features)

### 🚀 多元化 Agent 模式
- **Workflow 模式**：引進結構化的開發流程（設計 -> 實作 -> 驗證）。AI 會根據任務自動拆解步驟，並逐步完成，是大型任務的首選。
- **群組辯論 (Group/Debate)**：支援多人格（Persona）協作。透過不同的思維模型（如架構師、後端、前端）進行辯論與互審，產出更嚴謹的解決方案。
- **單人模式 (Single)**：即時解決小型問題，反應迅速。

### 🧠 智能記憶管理 (Zero-Artifact Memory)
- **無痕修剪技術**：自主研發的背景記憶修剪機制。在對話過長時，能精準移除舊有的巨型程式碼塊以節省 Token，且不會留下任何「引發 AI 幻覺」的記號（如佔位符），讓 AI 永遠保持清醒。
- **上下文感知**：自動過濾冗餘數據，優先保留最新的專案結構與任務進度。

### 📊 實時任務儀表板 (Live Dashboard)
- **視覺化監控**：即時展示當前任務的執行狀態、API 消耗、模型性能與系統心跳。
- **任務進度牆**：自動同步專案中的 `task_plan.md` 與 `progress.md`，讓開發進度一目了然。

### 📡 全方位模型與 API 輪詢
- **Ollama 本地驅動**：保護隱私，純本地運行。
- **Gemini 雲端加速**：完美支援 Gemini 1.5 系列。
- **自動 API 輪詢**：支援多組 API Key 自動輪換，當一組額度用盡時，無縫切換至下一組，確保開發不中斷。

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
| `bwsCoder.autoFallback` | 主要模型失效時，是否自動切換至備援 | `false` |
| `bwsCoder.debugMode` | 開啟後顯示狀態機日誌與詳細排除資訊 | `false` |
| `bwsCoder.language` | AI 全域輸出語言 | `zh-TW` |

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
