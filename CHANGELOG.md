# BWS.Coder - AI程式工程師 變更日誌

所有顯著的更動都將記錄在此檔案中。

## [0.1.19] - 協議升級與記憶穩定化 (Protocol Upgrade & Memory Stabilization) - 2026-04-09

### 🚀 重大更新 (Major Updates)
- **邁向 XML 工具調用協議 (XML Tool Call Protocol)**：全面廢棄舊式的 `[@@ action @@]` 標籤通訊，改用結構化、強健的 XML 工具調用模式。這大幅提升了指令解析的精確度，並消除了模型產出不完整標籤導致的解析錯誤。
- **記憶管理器重構 (MemoryManager Refactoring)**：
  - **結構化塊狀渲染 (Structured Block Rendering)**：歷史紀錄中的工具調用現在會根據來源資料重新生成有效的 XML，而非使用不穩定的正規表達式替換。
  - **彈性資料量保鮮 (Volume-Based Freshness)**：將過去的「輪數保護」改為「資料量保護」。系統會確保最近的 **32,000 字** 對話絕對不被修剪，為 AI 提供極其穩定的短期記憶。
  - **智慧頭尾剪裁 (Head/Tail Truncation)**：對於過長的檔案讀取結果，系統會自動保留檔案的開頭與結尾（各 1,000 字），這讓 AI 能在節省 Token 的同時，依然理解檔案的整體結構，徹底解決了反覆讀取檔案的死循環（Infinite Loop）。

### 🛠️ 穩定性修正 (Stability Fixes)
- **情境隔離優化**：修復了新 Session 會意外讀取到舊有 `findings.md` 而產生「預知記憶」的問題。現在系統鼓勵 AI 透過手動 `ls` 與 `read` 來主動探索環境。
- **Unicode 修復計畫啟動**：針對 `Form1.cs` 中的萬國碼轉碼邏輯進行了初步審查與修復設計，解決了 `\uXXXX` 轉碼不完全的問題。

## 全球語系與使用者體驗優化 (Universal Localization & UX Improvements) - 2026-03-31

### ✨ 新增功能 (New Features)
- **全面語系支援 (Universal Localization)**：擴充功能現在完整支援「繁體中文 (zh-TW)」、「簡體中文 (zh-CN)」與「英文 (en)」。包含所有的 AI 執行狀態、系統訊息、錯誤提示以及 UI 介面。
- **全新斜槓指令 (New Slash Commands)**：
  - `/setting`：快速開啟「LLM 參數設定」面板。
  - `/manage`：快速開啟「AI 提供者與模型管理」面板。
- **即時語系切換 (Real-time Locale Sync)**：在設定面板更改語系後，聊天面板 (Chat Webview)、狀態列 (Status Bar) 以及管理面板將立即同步更新，無需重新載入視窗。

### 💄 介面優化 (UI/UX Improvements)
- **狀態列與工具列強化**：
  - 工具列所有按鈕（Workflow, Group, Single, History, Log 等）現在具備完整的語系化提示 (Tooltips)。
  - 右下角「AI 助理」狀態按鈕及其工具提示支援即時語系更新。
- **輸入框指令本地化**：輸入框預設文字（Placeholder）現在會根據語系顯示對應的「按 Shift+Enter 換行, Enter 發送」說明。

### 🧹 系統重構 (System Refactoring)
- **架構升級**：移除所有舊式的 `package.nls.json` 檔案，將所有語系邏輯集中於 `src/utils/locale.ts` 管理，大幅提升維護性與動態切換效能。
- **程式碼清理**：掃描並清除了所有 `.ts` 原始碼中的硬編碼中文，改由 `t()` 函數統一分發。

## 標籤解析與穩定性修正 (Tag Parsing & Stability Fixes) - 2026-03-30

### 🐞 Bug 修復 (Bug Fixes)
- **結構化標籤剔除優化**：修復了 AI 產出的 `[@@ create...@@]` 與 `[@@ eof @@]` 標籤有時會殘留在檔案內容中的問題。透過強化 Regex 容錯率，現在即使標籤不完整（如漏掉結尾括號）也能正確識別並剔除。
- **全域 Regex 正則統一化**：將所有檔案操作相關的正則表達式集中於 `constants.ts` 管理，解決了 `StreamingParser` 與 `fileOperations` 之間解析邏輯不一致的問題。
- **Replace 內部標籤強健化**：重構並統一了 `replace` 操作內部的 `[@@<@@]`, `[@@=@@]`, `[@@>@@]` 標籤處理邏輯。現在支援「標籤後不強制換行」以及「結尾括號選配」，大幅提升了局部替換功能的成功率。

## [0.1.18] - 穩定性與效能優化 (Stability & Performance) - 2026-03-28

### 🚀 重大更新 (Major Updates)
- **無痕記憶修剪 (Zero-Artifact Pruning)**：全新開發的 Context Pruning 策略。當對話超過上下文限制時，系統會直接移除歷史中已完成的代碼塊，且不留下任何標記（Zero Placeholder）。這徹底解決了 AI 誤將系統備忘錄當成自己對話輸出的「複讀機幻覺」。
- **強制驗證思維 (Verification First)**：全面更新系統提示詞。現在 AI 在宣告任務完成前，會主動執行終端指令（例如啟動伺服器或發起 `curl` 測試）來證明代碼確實運作正常，不再寫完檔案就停手。

### ✨ 新增功能 (New Features)
- **專業級圖片與多媒體處理**：
  - **截圖即貼 (Ctrl+V)**：優化了 Webview 攔截機制，支援從剪貼簿直接貼上圖片。
  - **精簡彈窗模式 (Compact Popup)**：圖片預覽彈窗啟用 Compact Mode，提供專注的浮動檢視體驗。
  - **原生上傳功能**：補齊 UI 命令，支援呼叫 VS Code 原生對話框上傳多個檔案附件。
- **任務儀表板 (Dashboard) 自動清理**：啟動 `/plan` 或 `/group` 時會自動清空過期的任務卡片，維持儀錶板的即時性。

### 📝 文檔與文法強化 (Documentation & Standards)
- **README 全面升級**：補齊所有斜槓指令說明，並提升文檔質感。
- **Git 規範化**：優化 `.gitignore` 排除 AI 暫存資料夾。

<!-- [2026-03-28] [FIX_README_UPGRADE] - Updated CHANGELOG to [0.1.18]. -->

## [0.1.17] - 本次更新

### 🎉 重大更新 (Major Updates)
- **全面邁向 Agentic 架構**：我們移除了舊式的「右鍵選單指令 (Commands)」，將所有的互動統一至 **AI 聊天面板 (Chat Panel)**。讓 AI 完全自主發起重構、除錯與測試等修復邏輯，實現代碼全自動修改。
- **Agent Knowledge Skills 系統**：新增透過對話呼叫技能字典的機制。現在只要在對話中輸入 `[使用/參照]技能 @skill-name`，系統便會自動掃描本地 `.bws.coder/skills` 或全域的 `.md` 檔案，並且將知識內容無縫注入系統上下文 (Context) 中。

### ✨ 新增功能 (New Features)
- **動態檔案操作標籤**：大幅優化對話介面中對檔案操作（如 `create`, `modify`, `execute` 等）的顯示邏輯。這類操作將不再印出大段程式碼占據對話版面，改為精簡的小標籤；而在串流輸出時，更會顯示帶有 `...` 呼吸動畫的「📝 修改中」狀態。
- **自訂指令逾時參數**：在 VS Code Settings 中新增 `bwsCoder.executionTimeout` 參數 (預設 60 秒)，讓使用者可根據需求調整 AI 執行後台終端機指令的等待無回應時間。

### 💄 介面優化 (UI/UX Improvements)
- **品牌識別統一**：將擴充名稱、視窗標題以及 README 文件全面統一更名為 **「BWS.Coder - AI程式工程師」**。
- **系統自動回報視覺區隔**：對於系統送出的自動回報訊息（例如：編譯指令執行結果），我們設計了專屬的深色底板 (`.auto-report`) 樣式，使其看起來更像終端日誌，不再與一般的對話泡泡混肴。
- **介面細節翻新**：
  - 縮短了檔案操作指示標籤的上下行距。
  - 將附件上傳按鈕的圖示修改為常見的 **迴紋針📎**。
  - 將中止動作按鈕 (`Stop`) 改為純紅色方塊圖標的按鈕 (■)。

## [0.1.0] - 初始發布版本
- 實作基礎 Ollama 本地模型連線支援。
- 實作 Google Gemini API 支援，並具備多組 API Key 自動智能輪詢（Rate Limit 迴避）機制。
- 開發完整的分頁聊天視窗，支援代碼語法高亮、一鍵複製與一鍵應用。
- 建立 File Operations 基礎組件，賦予 AI 操作本機專案檔案（讀、寫、刪、執行）的能力。