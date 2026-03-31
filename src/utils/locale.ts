import * as vscode from 'vscode';

export type SupportedLang = 'zh-TW' | 'zh-CN' | 'en';

export type LocaleStrings = {
    planningAutoInitTitle: string;
    planningAutoInitBody: string;
    planningManualInitTitle: string;
    planningManualInitBody: string;
    planningNoWorkspace: string;
    handoverHint: string;
    rescueTitle: string;
    rescuePrompt: string;

    // UI & Chat Area
    ui_bwsCoder: string;
    ui_selectModel: string;
    ui_manageProviders: string;
    ui_clearChat: string;
    ui_openDashboard: string;
    ui_inputPlaceholder: string;
    ui_send: string;
    ui_chatStart: string;
    ui_thinking: string;
    ui_loading: string;
    ui_finishedThinking: string;
    ui_copied: string;
    ui_attached: string;
    ui_images: string;
    ui_systemAssistant: string;
    ui_completedTask: string;
    ui_pendingFileOp: string;
    ui_showPlan: string;
    ui_hidePlan: string;
    ui_dashboardTitle: string;
    ui_popOutDashboard: string;
    ui_close: string;
    ui_poppedOutMessage: string;
    ui_poppedOutHint: string;
    ui_returnToSidebar: string;
    ui_statusBarAi: string;
    ui_workflowTitle: string;
    ui_groupTitle: string;
    ui_singleTitle: string;
    ui_historyTooltip: string;
    ui_newChatTooltip: string;
    ui_handoverTooltip: string;
    ui_logTooltip: string;
    ui_input_instruction: string;
    ui_continueHint: string;

    // Messages
    msg_you: string;
    msg_aiEngineer: string;
    msg_taskPlan: string;
    msg_copy: string;
    msg_apply: string;
    msg_taskDoneTitle: string;
    msg_taskDoneBody: string;
    msg_reportResult: string;
    msg_processing: string;
    msg_returningResult: string;

    // Workflow
    wf_orchestration: string;
    wf_aiPlannerBtn: string;
    wf_aiPlannerHint: string;
    wf_noModels: string;
    wf_rolePlaceholder: string;
    wf_deleteStep: string;
    wf_promptPlaceholder: string;
    wf_parallel: string;
    wf_parallelHint: string;
    wf_planningMode: string;
    wf_addStep: string;
    wf_newTask: string;
    wf_requireInputFirst: string;

    // Chat Executor & Errors
    err_protocolViolation: string;
    err_commandFormat: string;
    err_emptyContent: string;
    err_replaceFormat: string;
    err_executorStalled: string;
    msg_executing: string;
    msg_processExited: string;
    msg_execError: string;
    msg_reporting: string;
    err_userAborted: string;

    // Multi LLM Fallback
    err_fallbackExhausted: string;
    msg_switchingFallback: string;
    msg_fallbackFailed: string;
    err_connectionFailed: string;
    err_allExhausted: string;

    // File Operations
    op_created: string;
    op_modified: string;
    op_deleted: string;
    op_read: string;
    op_createFailed: string;
    op_modifyFailed: string;
    op_deleteFailed: string;
    op_readFailed: string;
    op_replaceFileNotFound: string;
    op_replaceTagsMissing: string;
    op_replaceTagsOrder: string;
    op_replaceMultipleFound: string;
    op_replaceNotFound: string;
    
    op_createPending: string;
    op_modifyPending: string;
    op_replacePending: string;
    op_deletePending: string;
    op_executePending: string;
    op_readPending: string;
    op_executeStatus: string;
    op_executeResult: string;
    op_success: string;
    op_failedStatus: string;
    
    // Commands
    cmd_executeSuccess: string;
    cmd_executeFailed: string;
    cmd_output: string;
    cmd_noOutput: string;
    op_failed: string;
    op_resultsTitle: string;
    op_truncatedOutput: string;
    op_truncatedChars: string;
    op_successDetail: string;
    op_readDetail: string;
    op_executeDetail: string;
    op_exited: string;
    op_failedInfo: string;
    err_fileNotFound: string;
    err_isDirectory: string;
    err_noWorkspace: string;
    msg_commandStarting: string;
    msg_aiPlanning: string;
    msg_groupPersonaPlanning: string;
    msg_groupPersonaSuccess: string;
    msg_groupPersonaFailed: string;
    msg_exportSuccess: string;
    msg_exportFailed: string;
    msg_exportPrompt: string;
    msg_loadingLog: string;
    msg_noLog: string;
    msg_debug_stateMachine: string;
    msg_aiLogs: string;
    msg_aiPlanningPrompt: string;
    msg_aiPlanningSuccess: string;
    msg_aiPlanningFailed: string;
    msg_groupPersonaPrompt: string;
    msg_exportHeader: string;
    msg_exportHtml: string;
    msg_exportMd: string;
    msg_exportTxt: string;
    msg_exportXml: string;
    msg_exportFileOp: string;
    msg_exportExecOp: string;
    msg_exportDeleteOp: string;
    msg_exportReadOp: string;
    op_attachment: string;
    err_groupTopicRequired: string;
    err_workflowNoSteps: string;
    err_runnerError: string;
    err_invalidJsonArray: string;
    msg_groupSingleModeNotice: string;
    msg_groupExhaustedNotice: string;
    msg_groupChatStarted: string;
    msg_groupPersonaRolePrompt: string;
    msg_groupProviderRolePrompt: string;
    ui_pending: string;
    ui_waitingForExec: string;
    msg_workflowResumeNotice: string;
    err_workflowPromptInvalid: string;
    err_promptTooShort: string;
    err_promptRepeated: string;
    err_promptPlaceholderUnfilled: string;
    msg_completedTask: string;
    err_noActiveEditor: string;
    ui_uploadFile: string;
    ui_allFiles: string;
    msg_resuscitateSuccess: string;
    ui_imageViewer: string;
    err_noActiveProviders: string;

    // [2026-03-30] Full Localization - Provider Manager UI strings
    pm_title: string;
    pm_sidebarHeader: string;
    pm_formTitleAdd: string;
    pm_formTitleEdit: string;
    pm_labelName: string;
    pm_labelModel: string;
    pm_labelEndpoint: string;
    pm_labelApiKeys: string;
    pm_btnResetCD: string;
    pm_btnSubmitAdd: string;
    pm_btnSubmitSave: string;
    pm_btnAddKey: string;
    pm_btnCancel: string;
    pm_placeholderName: string;
    pm_placeholderModel: string;
    pm_placeholderEndpoint: string;
    pm_placeholderApiKey: string;
    pm_emptyHint: string;
    pm_confirmDelete: string;
    pm_btnConfirmDelete: string;
    pm_msgAdded: string;
    pm_msgUpdated: string;
    pm_msgDeleted: string;
    pm_msgResetCD: string;
    pm_errorRequired: string;

    // [2026-03-30] Full Localization - Settings Panel strings
    set_title: string;
    set_temperature: string;
    set_temperature_desc: string;
    set_maxTokens: string;
    set_maxTokens_desc: string;
    set_language: string;
    set_language_desc: string;
    set_debugMode: string;
    set_debugMode_desc: string;
    set_saveRawStream: string;
    set_saveRawStream_desc: string;
    set_saveAiRequest: string;
    set_saveAiRequest_desc: string;
    set_groupChatMaxRounds: string;
    set_groupChatMaxRounds_desc: string;
    set_maxTurnsPerStep: string;
    set_maxTurnsPerStep_desc: string;
    set_heartbeatTimeout: string;
    set_heartbeatTimeout_desc: string;
    set_autoFallback: string;
    set_autoFallback_desc: string;
    set_btnSave: string;
    set_btnReset: string;
    set_msgSaved: string;
};

const locales: Record<SupportedLang, LocaleStrings> = {
    'zh-TW': {
        planningAutoInitTitle: '[規劃系統] 專案核心規劃檔案已建立',
        planningAutoInitBody: '\`task_plan.md\`, \`findings.md\`, and \`progress.md\` initialized. [AI Instruction: These files are your "External Memory". You MUST read them before every turn and update them proactively as you make progress.]\n\n輸入 \`/handover\` 可產生交接摘要。',
        planningManualInitTitle: '[規劃系統] 🚀 專案規劃模板已建立',
        planningManualInitBody: '已建立 \`task_plan.md\`、\`findings.md\`、\`progress.md\`。[AI Instruction: These serve as your project state. Maintain them strictly to ensure continuity across sessions.]',
        planningNoWorkspace: '[規劃系統] ❌ 初始化失敗：請先在 VS Code 開啟一個資料夾 (Workspace)。',
        handoverHint: '> 💡 提示：輸入 \`/handover\` 可請 AI 自動撰寫 \`HANDOVER.md\` 交接文件。',
        rescueTitle: '[系統自我救援]',
        rescuePrompt: '串流發生中斷，請從剛才停下的地方繼續。\n\n已處理的操作數：{0}\n最後收到的內容：{1}',

        ui_bwsCoder: 'BWS.Coder',
        ui_selectModel: '選擇模型',
        ui_manageProviders: '管理提供者...',
        ui_clearChat: '清除對話',
        ui_openDashboard: '開啟儀表板',
        ui_inputPlaceholder: '按 Shift+Enter 換行, Enter 發送...',
        ui_send: '發送 (Enter)',
        ui_chatStart: '目前為對話起點...',
        ui_thinking: '思考中...',
        ui_loading: '預入中...',
        ui_finishedThinking: '思考完畢',
        ui_copied: '已複製!',
        ui_attached: '附帶',
        ui_images: '張圖片',
        ui_systemAssistant: '系統助理',
        ui_completedTask: '({0})已完成任務',
        ui_pendingFileOp: '待執行',
        ui_showPlan: '展開詳細規劃',
        ui_hidePlan: '收起詳細規劃',
        ui_dashboardTitle: '⚡ 任務執行監控',
        ui_popOutDashboard: '彈出獨立視窗',
        ui_close: '關閉',
        ui_poppedOutMessage: '對話已在獨立視窗開啟',
        ui_poppedOutHint: '(關閉獨立視窗即可恢復此處)',
        ui_returnToSidebar: '收回至側邊欄',
        ui_statusBarAi: 'AI助理',
        ui_workflowTitle: '任務編排 (Workflow)',
        ui_groupTitle: '廣播模式 (Group)',
        ui_singleTitle: '單一模式 (Single)',
        ui_historyTooltip: '歷史紀錄',
        ui_newChatTooltip: '開始新會話',
        ui_handoverTooltip: '儲存交接文件 (Handover)',
        ui_logTooltip: '查看 AI 原始日誌',
        ui_input_instruction: '按 Shift+Enter 換行, Enter 發送',
        ui_continueHint: '繼續 (Continue)',

        msg_you: '你',
        msg_aiEngineer: 'AI 程式工程師',
        msg_taskPlan: '任務執行計畫',
        msg_copy: '複製',
        msg_apply: '應用',
        msg_taskDoneTitle: '🎉 任務已完成',
        msg_taskDoneBody: '所有作業已全數執行完畢。',
        msg_reportResult: '↳ 回報 AI 執行結果',
        msg_processing: '處理中...',
        msg_returningResult: '結果傳回中...',

        wf_orchestration: '任務編排',
        wf_aiPlannerBtn: '✨ AI 規劃助手',
        wf_aiPlannerHint: '根據輸入框內容自動規劃工作流',
        wf_noModels: '無可用模型',
        wf_rolePlaceholder: '任務性質/角色',
        wf_deleteStep: '刪除節點',
        wf_promptPlaceholder: '對此角色的具體指令...',
        wf_parallel: '平行執行',
        wf_parallelHint: '與下一個節點同步開始執行',
        wf_planningMode: 'Planning 模式中...',
        wf_addStep: '+ 新增任務節點',
        wf_newTask: '新任務',
        wf_requireInputFirst: '請先在對話框輸入您的需求說明（例如：我要做一個登入功能...），再使用 AI 規劃助手。',

        err_protocolViolation: '❌ **協定違規 (Protocol Violation)**：偵測到您試圖透過 `execute` 指令來寫入檔案（包含重定向或 Set-Content）。\n本專案嚴禁使用終端機指令建檔，請改用標準的 `create` 或 `modify` 標籤。\n\n**正確範例**：\n[@@ create:{0} @@]\n(檔案內容)\n[@@ eof @@]',
        err_commandFormat: '❌ **指令格式錯誤 (Command Pattern Warning)**：偵測到您使用了 `Start-Process -Wait`。\n\n**問題原因**：這會導致系統無效等待。\n**正確做法**：請直接用 `&` 呼叫執行檔，例如 `& "{0}" -batchmode -quit`',
        err_emptyContent: '❌ **格式錯誤**：`{0}` 操作的內容區塊不能為空。刪除檔案請改用 `delete`。\n\n**正確範例**：\n[@@ {0}:{1} @@]\n(具體代碼)\n[@@ eof @@]',
        err_replaceFormat: '❌ **格式錯誤**：`replace` 區塊必須包含完整的 `[@@<@@]` (舊代碼) 與 `[@@=@@]` (分隔符) 標籤。\n\n**正確範例**：\n[@@ replace:{0} @@]\n[@@<@@]\n(待替換的原始段落)\n[@@=@@]\n(替換後的目標段落)\n[@@>@@]\n[@@ eof @@]',
        err_executorStalled: '\n[系統提示] 指令逾時。',
        msg_executing: '運算中... (已執行 {0} 分鐘)',
        msg_processExited: '進程已退出 ({0})',
        msg_execError: '執行錯誤',
        msg_reporting: '正在回報 {0} 個執行結果...',
        err_userAborted: '使用者自行中斷執行',

        err_fallbackExhausted: '優先服務 **{0}** 的 API Keys 已用完。\n因為您未開啟「自動切換備援 (Auto Fallback)」，已停止執行。\n提示：請至 Provider Manager 補充 Keys，或勾選以允許自動切換。',
        msg_switchingFallback: '正在切換至備援服務',
        msg_fallbackFailed: '備援失敗，繼續切換至',
        err_connectionFailed: '連線失敗',
        err_allExhausted: '所有 AI 服務的 API Keys 皆已耗盡或無法連線，請至 Provider Manager 更新 Keys',

        op_created: '✅ 已建立',
        op_modified: '✏️ 已修改',
        op_deleted: '🗑️ 已刪除',
        op_read: '📄 已讀取',
        op_createFailed: '❌ 建立失敗',
        op_modifyFailed: '❌ 修改失敗',
        op_deleteFailed: '❌ 刪除失敗',
        op_readFailed: '❌ 讀取失敗',
        op_replaceFileNotFound: '檔案不存在，無法進行局部替換 (replace)',
        op_replaceTagsMissing: 'replace 區塊格式錯誤，必須包含獨立的一行 [@@<@@]、[@@=@@] 與 [@@>@@] 標籤',
        op_replaceTagsOrder: 'replace 標籤順序錯誤，必須依序為 [@@<@@]、[@@=@@]、[@@>@@]標籤',
        op_replaceMultipleFound: '找到多個相同的舊代碼區塊，請提供行號或更多上下文以精確定位',
        op_replaceNotFound: '找不到完全匹配的舊代碼區塊。',

        op_createPending: '待建立...',
        op_modifyPending: '待修改...',
        op_replacePending: '待局部修改...',
        op_deletePending: '待刪除...',
        op_executePending: '待執行...',
        op_readPending: '讀取中...',
        op_executeStatus: '狀態',
        op_executeResult: '執行結果',
        op_success: '成功',
        op_failedStatus: '失敗',

        cmd_executeSuccess: '指令 `{0}` 執行成功',
        cmd_executeFailed: '指令 `{0}` 執行失敗',
        cmd_output: '輸出內容：\n{0}\n',
        cmd_noOutput: '(無輸出)',
        op_failed: '❌ 操作 {0} 失敗：{1}',
        op_resultsTitle: '\n\n---\n**📁 檔案操作結果：**\n',
        op_truncatedOutput: '\n\n[... (此處為節省 Token 空間，已省略中間約 {0} 行日誌。完整內容請見 VS Code 輸出通道) ...]\n\n',
        op_truncatedChars: '\n\n[... (日誌字數過長，已截斷尾部 ...)]',
        op_successDetail: '✅ {0} 成功: {1}',
        op_readDetail: '📄 已讀取檔案 \`{0}\`，內容如下：\n\`\`\`\n{1}\n\`\`\`\n',
        op_executeDetail: '指令 \`{0}\` 執行{1}\n輸出內容：\n{2}\n',
        op_exited: '進程已退出 ({0})',
        op_failedInfo: '操作 {0} 失敗：{1}',
        err_fileNotFound: '檔案或目錄不存在',
        err_isDirectory: '無法讀取目錄，請提供檔案路徑',
        err_noWorkspace: '未開啟工作區，無法執行操作',
        msg_commandStarting: '[BWS.Coder] 啟動指令: {0}',
        msg_aiPlanning: '⏳ **AI 工作流規劃中...** 正在分析您的需求並生成步驟，請稍候。',
        msg_groupPersonaPlanning: '⏳ **AI 討論角色安排中...** 正在根據題目生成不同觀點的參與者，請稍候。',
        msg_groupPersonaSuccess: '✅ **AI 已生成 {0} 個討論角色**',
        msg_groupPersonaFailed: '⚠️ **角色安排失敗**，將退回預設群聊模式。（錯誤：{0}）',
        msg_exportSuccess: '✅ **對話紀錄已成功匯出！**\n檔案已儲存至：\`{0}\`',
        msg_exportFailed: '匯出失敗: {0}',
        msg_exportPrompt: '匯出對話紀錄',
        msg_loadingLog: '正在載入 AI 日誌...',
        msg_noLog: '目前尚無日誌記錄',
        msg_debug_stateMachine: '[除錯] 狀態機進度: {0}',
        msg_aiLogs: 'BWS.Coder AI 原始日誌',
        msg_aiPlanningPrompt: '針對以下需求進行工作流規劃：',
        msg_aiPlanningSuccess: '✅ **工作流規劃完成**，已自動載入 {0} 個步驟至 Task Manager。',
        msg_aiPlanningFailed: '⚠️ **工作流規劃失敗**: {0}',
        msg_groupPersonaPrompt: '請為以下主題生成討論角色：',
        msg_exportHeader: '# BWS.Coder 對話紀錄\n\n匯出時間：{0}\n\n---\n\n',
        msg_exportHtml: 'HTML (網頁版視覺)',
        msg_exportMd: 'Markdown (適合筆記)',
        msg_exportTxt: 'Plain Text (純文字)',
        msg_exportXml: 'XML (程式讀取)',
        msg_exportFileOp: '\n**建立/修改檔案：`$2`**\n```\n',
        msg_exportExecOp: '\n**執行指令：** `$1`\n',
        msg_exportDeleteOp: '\n**刪除檔案：** `$1`\n',
        msg_exportReadOp: '\n**讀取檔案：** `$1`\n',
        op_attachment: '[附件檔案: {0}]',
        err_groupTopicRequired: '請在 /group 或 /debate 後面加上討論主題。例如：/group AI是否會取代人類工作',
        err_workflowNoSteps: '[Workflow] 尚未設定任何步驟，或所有步驟已停用。請在 Workflow 面板中新增步驟並儲存。',
        err_runnerError: '❌ **執行錯誤**: {0}\n\n請檢查 API Key 額度是否充足，或嘗試重新整理提供者。',
        err_invalidJsonArray: 'AI 回傳的格式不正確（預期為 JSON 陣列）',
        msg_groupSingleModeNotice: '[系統提示] 您未設定主題且可用的 AI 提供者不足兩個，將以單一模型模式進行一次性對話。',
        msg_groupExhaustedNotice: ' (已排除配額超出的：{0})',
        msg_groupChatStarted: '[系統開始群聊 / 辯論]，參與者：{0}\n將自動交替發言，直到達到設限回合或完成任務。',
        msg_groupPersonaRolePrompt: '\n\n[群聊指令] 你現在的角色是「{0}」。\n{1}\n\n請以這個身份，針對上文內容發表你的看法，或反駁其他人的觀點。\n⚠️ **注意：這是一場純文字對話辯論。請「直接輸出」你的發言內容，【絕對不要】使用 \`[@@ create:檔案路徑 @@]\` 等任何標籤來建立檔案，也不需要生成總結報告。**',
        msg_groupProviderRolePrompt: '\n\n[群聊指令] 你現在是以 {0} 的身份參與討論。請針對上文內容發表你的看法，或繼續執行未完成的任務。\n⚠️ **注意：若無剛性需求，請直接進行文字對話，不要建立檔案。**',
        ui_pending: '等待中',
        ui_waitingForExec: '等待執行',
        msg_workflowResumeNotice: '[系統通知] 偵測到前 {0} 個步驟已完成，將從步驟「{1}」開始繼續任務。',
        err_workflowPromptInvalid: '⚠️ [WorkflowRunner] 步驟「{0}」的 Prompt 品質不合格，已跳過。\n\n**問題**: {1}\n\n請重新使用 /plan 產生工作流程，或手動修正 Prompt。',
        err_promptTooShort: 'Prompt 內容過短或空白',
        err_promptRepeated: 'Prompt 包含重複詞語「{0}」(出現 3 次以上)，疑似 AI 生成亂碼',
        err_promptPlaceholderUnfilled: 'Prompt 包含未填入的佔位符「{0}」',
        msg_completedTask: '完成任務',
        err_noActiveEditor: '請先開啟一個編輯器文件',
        ui_uploadFile: '上傳檔案',
        ui_allFiles: '所有檔案',
        msg_resuscitateSuccess: '已完成「電擊救活」！',
        ui_imageViewer: '圖片檢視器',
        err_noActiveProviders: '請先在 Provider Manager 中啟用至少一個 AI 提供者',

        // [2026-03-30] Full Localization - Provider Manager (zh-TW)
        pm_title: 'BWS.Coder - LLM 提供者管理',
        pm_sidebarHeader: '已設定的提供者',
        pm_formTitleAdd: '新增 LLM',
        pm_formTitleEdit: '修改設定: {0}',
        pm_labelName: '服務名稱',
        pm_labelModel: '模型名稱 (Model)',
        pm_labelEndpoint: '連接端點 (EndPoint)',
        pm_labelApiKeys: 'API Keys',
        pm_btnResetCD: '🔄 全部重置 CD',
        pm_btnSubmitAdd: '新增 LLM',
        pm_btnSubmitSave: '儲存修改',
        pm_btnAddKey: '+ 新增金鑰',
        pm_btnCancel: '取消編輯',
        pm_placeholderName: '例如: 我的自定義模型',
        pm_placeholderModel: '例如: gpt-4',
        pm_placeholderEndpoint: '例如: http://localhost:11434',
        pm_placeholderApiKey: '輸入 API Key',
        pm_emptyHint: '尚未新增任何提供者',
        pm_confirmDelete: '確定要刪除「{0}」嗎？',
        pm_btnConfirmDelete: '確定刪除',
        pm_msgAdded: '✅ 已新增提供者: {0}',
        pm_msgUpdated: '✅ 已更新提供者: {0}',
        pm_msgDeleted: '🗑️ 已刪除提供者: {0}',
        pm_msgResetCD: '🔄 已重置該提供者所有金鑰的冷卻狀態。',
        pm_errorRequired: '請填寫名稱與模型',

        // [2026-03-30] Full Localization - Settings (zh-TW)
        set_title: 'BWS.Coder 全域設定',
        set_temperature: '生成溫度 (Temperature)',
        set_temperature_desc: '0-1，越低越精確',
        set_maxTokens: '最大 Token 數量',
        set_maxTokens_desc: '單次輸出的最大數量',
        set_language: '介面與回應語言 (Language)',
        set_language_desc: '影響 Chat 介面與回應預設語言',
        set_debugMode: '開啟除錯模式',
        set_debugMode_desc: '顯示狀態機進度與詳細日誌',
        set_saveRawStream: '儲存原始串流資料 (Raw Stream)',
        set_saveRawStream_desc: '將 AI 原始數據存至 Log 目錄',
        set_saveAiRequest: '儲存發送給 AI 的完整請求 (Request Payload)',
        set_saveAiRequest_desc: '將請求內容存至 Log 目錄',
        set_groupChatMaxRounds: '群組聊天最大對話輪數',
        set_groupChatMaxRounds_desc: '0 表示不限制',
        set_maxTurnsPerStep: '工作流單一步驟最大輪數',
        set_maxTurnsPerStep_desc: '防止無限迴圈，建議保留安全值',
        set_heartbeatTimeout: 'AI 回應偵測逾時 (秒)',
        set_heartbeatTimeout_desc: 'Local 模型會自動乘以 10 倍',
        set_autoFallback: '自動切換備援 LLM',
        set_autoFallback_desc: '主要 LLM 失敗時自動切換',
        set_btnSave: '儲存設定',
        set_btnReset: '重置為預設',
        set_msgSaved: '✅ 設定已儲存'
    },
    'zh-CN': {
        planningAutoInitTitle: '[规划系统] 🗂️ 已自动初始化项目核心规划文件',
        planningAutoInitBody: '\`task_plan.md\`、\`findings.md\`、\`progress.md\` 已创建于根目录。这些文件是您的“外部记忆”，在每次对话开始前均会自动加载。您必须：\n1. 随时读取这些文件以掌握全局进度。\n2. 在进行重大决策或阶段完成后，主动更新这些文件。\n输入 \`/handover\` 可生成交接摘要。',
        planningManualInitTitle: '[规划系统] 🚀 项目规划模板已创建',
        planningManualInitBody: '已在根目录创建 \`task_plan.md\`、\`findings.md\`、\`progress.md\`。\n这些是您的外部记忆库。请主动维护这些文件，确保项目进度、技术发现与执行日志始终保持最新，以维持跨对话的记忆连续性。',
        planningNoWorkspace: '[规划系统] ❌ 初始化失败：请先在 VS Code 中打开一个文件夹 (Workspace)。',
        handoverHint: '> 💡 提示：输入 \`/handover\` 可让 AI 自动生成 \`HANDOVER.md\` 交接文档。',
        rescueTitle: '[系统自我救援]',
        rescuePrompt: '流媒体发生中断，请从刚才停下的地方继续。\n\n已处理的操作数：{0}\n最后收到的内容：{1}',

        ui_bwsCoder: 'BWS.Coder',
        ui_selectModel: '选择模型',
        ui_manageProviders: '管理提供者...',
        ui_clearChat: '清除对话',
        ui_openDashboard: '打开仪表板',
        ui_inputPlaceholder: '按 Shift+Enter 换行, Enter 发送...',
        ui_send: '发送 (Enter)',
        ui_chatStart: '目前为对话起点...',
        ui_thinking: '思考中...',
        ui_loading: '加载中...',
        ui_finishedThinking: '思考完毕',
        ui_copied: '已复制!',
        ui_attached: '附带',
        ui_images: '张图片',
        ui_systemAssistant: '系统助理',
        ui_completedTask: '({0})已完成任务',
        ui_pendingFileOp: '待执行',
        ui_showPlan: '展开详细规划',
        ui_hidePlan: '收起详细规划',
        ui_dashboardTitle: '⚡ 任务执行监控',
        ui_popOutDashboard: '弹出独立窗口',
        ui_close: '关闭',
        ui_poppedOutMessage: '对话已在独立窗口打开',
        ui_poppedOutHint: '(关闭独立窗口即可恢复此处)',
        ui_returnToSidebar: '收回至侧边栏',
        ui_statusBarAi: 'AI助理',
        ui_workflowTitle: '任务编排 (Workflow)',
        ui_groupTitle: '广播模式 (Group)',
        ui_singleTitle: '单一模式 (Single)',
        ui_historyTooltip: '历史记录',
        ui_newChatTooltip: '开始新会话',
        ui_handoverTooltip: '储存交接文档 (Handover)',
        ui_logTooltip: '查看 AI 原始日志',
        ui_input_instruction: '按 Shift+Enter 换行, Enter 发送',
        ui_continueHint: '继续 (Continue)',

        msg_you: '你',
        msg_aiEngineer: 'AI 程序员',
        msg_taskPlan: '任务执行计划',
        msg_copy: '复制',
        msg_apply: '应用',
        msg_taskDoneTitle: '🎉 任务已完成',
        msg_taskDoneBody: '所有作业全数执行完毕。',
        msg_reportResult: '↳ 汇报 AI 执行结果',
        msg_processing: '处理中...',
        msg_returningResult: '结果传回中...',

        wf_orchestration: '任务编排',
        wf_aiPlannerBtn: '✨ AI 规划助手',
        wf_aiPlannerHint: '根据输入框内容自动规划工作流',
        wf_noModels: '无可用模型',
        wf_rolePlaceholder: '任务角色',
        wf_deleteStep: '删除节点',
        wf_promptPlaceholder: '对此角色的具体指令...',
        wf_parallel: '平行执行',
        wf_parallelHint: '与下一个节点同步开始执行',
        wf_planningMode: 'Planning 模式中...',
        wf_addStep: '+ 新增任务节点',
        wf_newTask: '新任务',
        wf_requireInputFirst: '请先在对话框输入您的需求说明，再使用 AI 规划助手。',

        err_protocolViolation: '❌ **协议违规 (Protocol Violation)**：严禁使用终端指令建档，请改用标准的 `create` 或 `modify` 标签。\n\n**正确示例**：\n[@@ create:{0} @@]\n(内容)\n[@@ eof @@]',
        err_commandFormat: '❌ **指令格式错误 (Command Pattern Warning)**：检测到使用 `Start-Process -Wait`。\n**正确做法**：请直接用 `&` 呼叫执行程序，例如 `& "{0}" -batchmode -quit`',
        err_emptyContent: '❌ **格式错误**：`{0}` 操作的内容区块不能为空。删除文件请改用 `delete`。\n\n**正确示例**：\n[@@ {0}:{1} @@]\n(代码)\n[@@ eof @@]',
        err_replaceFormat: '❌ **格式错误**：`replace` 区块必须包含完整的 `[@@<@@]` (旧代码) 与 `[@@=@@]` (分隔符) 标签。\n\n**正确示例**：\n[@@ replace:{0} @@]\n[@@<@@]\n(旧)\n[@@=@@]\n(新)\n[@@>@@]\n[@@ eof @@]',
        err_executorStalled: '\n[系统提示] 指令超时。',
        msg_executing: '运算中... (已执行 {0} 分钟)',
        msg_processExited: '进程已退出 ({0})',
        msg_execError: '执行错误',
        msg_reporting: '正在汇报 {0} 个执行结果...',
        err_userAborted: '用户自行中断执行',

        err_fallbackExhausted: '优先服务 **{0}** 的 API Keys 已用完。\n由于未开启「自动备援 (Auto Fallback)」，已停止执行。\n提示：补充 Keys，或打勾允许自动切换。',
        msg_switchingFallback: '正在切换至备援服务',
        msg_fallbackFailed: '备援失败，继续切换至',
        err_connectionFailed: '连线失败',
        err_allExhausted: '所有 AI 服务的 API Keys 皆已耗尽或无法连线，请至 Provider Manager 更新 Keys',

        op_created: '✅ 已创建',
        op_modified: '✏️ 已修改',
        op_deleted: '🗑️ 已删除',
        op_read: '📄 已读取',
        op_createFailed: '❌ 创建失败',
        op_modifyFailed: '❌ 修改失败',
        op_deleteFailed: '❌ 删除失败',
        op_readFailed: '❌ 读取失败',
        op_replaceFileNotFound: '文件不存在，无法进行局部替换 (replace)',
        op_replaceTagsMissing: 'replace 区块格式错误，必须包含完整标签',
        op_replaceTagsOrder: 'replace 标签顺序错误',
        op_replaceMultipleFound: '找到多个相同的旧代码区块，需精准定位',
        op_replaceNotFound: '找不到完全匹配的旧代码区块。',

        op_createPending: '待创建...',
        op_modifyPending: '待修改...',
        op_replacePending: '待局部修改...',
        op_deletePending: '待删除...',
        op_executePending: '待执行...',
        op_readPending: '读取中...',
        op_executeStatus: '状态',
        op_executeResult: '执行结果',
        op_success: '成功',
        op_failedStatus: '失败',

        cmd_executeSuccess: '指令 `{0}` 执行成功',
        cmd_executeFailed: '指令 `{0}` 执行失败',
        cmd_output: '输出内容：\n{0}\n',
        cmd_noOutput: '(无输出)',
        op_failed: '❌ 操作 {0} 失败：{1}',
        op_resultsTitle: '\n\n---\n**📁 文件操作结果：**\n',
        op_truncatedOutput: '\n\n[... (此处为节省 Token 空间，已省略中间约 {0} 行日志。完整内容请见 VS Code 输出通道) ...]\n\n',
        op_truncatedChars: '\n\n[... (日志字数过长，已截断尾部 ...)]',
        op_successDetail: '✅ {0} 成功: {1}',
        op_readDetail: '📄 已读取文件 \`{0}\`，内容如下：\n\`\`\`\n{1}\n\`\`\`\n',
        op_executeDetail: '指令 \`{0}\` 执行{1}\n输出内容：\n{2}\n',
        op_exited: '进程已退出 ({0})',
        op_failedInfo: '操作 {0} 失败：{1}',
        err_fileNotFound: '文件或目录不存在',
        err_isDirectory: '无法读取目录，请提供文件路径',
        err_noWorkspace: '未打开工作区，无法执行操作',
        msg_commandStarting: '[BWS.Coder] 启动指令: {0}',
        msg_aiPlanning: '⏳ **AI 工作流规划中...** 正在分析您的需求并生成步骤，请稍候。',
        msg_groupPersonaPlanning: '⏳ **AI 讨论角色安排中...** 正在根据题目生成不同观点的参与者，请稍候。',
        msg_groupPersonaSuccess: '✅ **AI 已生成 {0} 个讨论角色**',
        msg_groupPersonaFailed: '⚠️ **角色安排失败**，将退回默认群聊模式。（错误：{0}）',
        msg_exportSuccess: '✅ **对话记录已成功导出！**\n文件已储存至：\`{0}\`',
        msg_exportFailed: '导出失败: {0}',
        msg_exportPrompt: '导出对话记录',
        msg_loadingLog: '正在载入 AI 日志...',
        msg_noLog: '目前尚无日志记录',
        msg_debug_stateMachine: '[除错] 状态机进度: {0}',
        msg_aiLogs: 'BWS.Coder AI 原始日志',
        msg_aiPlanningPrompt: '针对以下需求进行工作流规划：',
        msg_aiPlanningSuccess: '✅ **工作流规划完成**，已自动载入 {0} 个步骤至 Task Manager。',
        msg_aiPlanningFailed: '⚠️ **工作流规划失败**: {0}',
        msg_groupPersonaPrompt: '请为以下主题生成讨论角色：',
        msg_exportHeader: '# BWS.Coder 对话记录\n\n导出时间：{0}\n\n---\n\n',
        msg_exportHtml: 'HTML (网页版视觉)',
        msg_exportMd: 'Markdown (适合笔记)',
        msg_exportTxt: 'Plain Text (纯文字)',
        msg_exportXml: 'XML (程序读取)',
        msg_exportFileOp: '\n**创建/修改文件：`$2`**\n```\n',
        msg_exportExecOp: '\n**执行指令：** `$1`\n',
        msg_exportDeleteOp: '\n**删除文件：** `$1`\n',
        msg_exportReadOp: '\n**读取文件：** `$1`\n',
        op_attachment: '[附件文件: {0}]',
        err_groupTopicRequired: '请在 /group 或 /debate 后面加上讨论主题。例如：/group AI是否会取代人类工作',
        err_workflowNoSteps: '[Workflow] 尚未设置任何步骤，或所有步骤已禁用。请在 Workflow 面板中新增步骤并保存。',
        err_runnerError: '❌ **执行错误**: {0}\n\n请检查 API Key 额度是否充足，或尝试刷新提供者。',
        err_invalidJsonArray: 'AI 返回的格式不正确（预期为 JSON 数组）',
        msg_groupSingleModeNotice: '[系统提示] 您未设置主题且可用的 AI 提供者不足两个，将以单一模型模式进行一次性对话。',
        msg_groupExhaustedNotice: ' (已排除配额超出的：{0})',
        msg_groupChatStarted: '[系统开始群聊 / 辩论]，参与者：{0}\n将自动交替发言，直到达到设限回合或完成任务。',
        msg_groupPersonaRolePrompt: '\n\n[群聊指令] 你现在的角色是“{0}”。\n{1}\n\n请以这个身份，针对上文内容发表你的看法，或反驳其他人的观点。\n⚠️ **注意：这是一场纯文字对话辩论。请“直接输出”你的发言内容，【绝对不要】使用 \`[@@ create:文件路径 @@]\` 等任何标签来创建文件，也不需要生成总结报告。**',
        msg_groupProviderRolePrompt: '\n\n[群聊指令] 你现在是以 {0} 的身份参与讨论。请针对上文内容发表你的看法，或继续执行未完成的任务。\n⚠️ **注意：若无刚性需求，请直接进行文字对话，不要创建文件。**',
        ui_pending: '等待中',
        ui_waitingForExec: '等待执行',
        msg_workflowResumeNotice: '[系统通知] 检测到前 {0} 个步骤已完成，将从步骤“{1}”开始继续任务。',
        err_workflowPromptInvalid: '⚠️ [WorkflowRunner] 步骤“{0}”的 Prompt 质量不合格，已跳过。\n\n**问题**: {1}\n\n请重新使用 /plan 生成工作流程，或手动修正 Prompt。',
        err_promptTooShort: 'Prompt 内容过短或空白',
        err_promptRepeated: 'Prompt 包含重复词语“{0}”(出现 3 次以上)，疑似 AI 生成乱码',
        err_promptPlaceholderUnfilled: 'Prompt 包含未填入的占位符“{0}”',
        msg_completedTask: '完成任务',
        err_noActiveEditor: '请先开启一个编辑器文件',
        ui_uploadFile: '上传文件',
        ui_allFiles: '所有文件',
        msg_resuscitateSuccess: '已完成“电击救活”！',
        ui_imageViewer: '图片检视器',
        err_noActiveProviders: '请先在 Provider Manager 中启用至少一个 AI 提供者',

        // [2026-03-30] Full Localization - Provider Manager (zh-CN)
        pm_title: 'BWS.Coder - LLM 提供者管理',
        pm_sidebarHeader: '已设置的提供者',
        pm_formTitleAdd: '新增 LLM',
        pm_formTitleEdit: '修改设置: {0}',
        pm_labelName: '服务名称',
        pm_labelModel: '模型名称 (Model)',
        pm_labelEndpoint: '连接端点 (EndPoint)',
        pm_labelApiKeys: 'API Keys',
        pm_btnResetCD: '🔄 全部重置 CD',
        pm_btnSubmitAdd: '新增 LLM',
        pm_btnSubmitSave: '保存修改',
        pm_btnAddKey: '+ 新增密钥',
        pm_btnCancel: '取消编辑',
        pm_placeholderName: '例如: 我的自定义模型',
        pm_placeholderModel: '例如: gpt-4',
        pm_placeholderEndpoint: '例如: http://localhost:11434',
        pm_placeholderApiKey: '输入 API Key',
        pm_emptyHint: '尚未新增任何提供者',
        pm_confirmDelete: '确定要删除“{0}”吗？',
        pm_btnConfirmDelete: '确定删除',
        pm_msgAdded: '✅ 已新增提供者: {0}',
        pm_msgUpdated: '✅ 已更新提供者: {0}',
        pm_msgDeleted: '🗑️ 已删除提供者: {0}',
        pm_msgResetCD: '🔄 已重置该提供者所有密钥的冷却状态。',
        pm_errorRequired: '请填写名称与模型',

        // [2026-03-30] Full Localization - Settings (zh-CN)
        set_title: 'BWS.Coder 全局设置',
        set_temperature: '生成温度 (Temperature)',
        set_temperature_desc: '0-1，越低越精确',
        set_maxTokens: '最大 Token 数量',
        set_maxTokens_desc: '单次输出的最大数量',
        set_language: '界面与响应语言 (Language)',
        set_language_desc: '影响 Chat 界面与响应默认语言',
        set_debugMode: '开启除错模式',
        set_debugMode_desc: '显示状态机进度与详细日志',
        set_saveRawStream: '储存原始串流资料 (Raw Stream)',
        set_saveRawStream_desc: '将 AI 原始数据存至 Log 目录',
        set_saveAiRequest: '储存发送给 AI 的完整请求 (Request Payload)',
        set_saveAiRequest_desc: '将请求内容存至 Log 目录',
        set_groupChatMaxRounds: '群组聊天最大对话轮数',
        set_groupChatMaxRounds_desc: '0 表示不限制',
        set_maxTurnsPerStep: '工作流单一步骤最大轮数',
        set_maxTurnsPerStep_desc: '防止无限循环，建议保留安全值',
        set_heartbeatTimeout: 'AI 回应侦测逾时 (秒)',
        set_heartbeatTimeout_desc: 'Local 模型会自动乘以 10 倍',
        set_autoFallback: '自动切换备援 LLM',
        set_autoFallback_desc: '主要 LLM 失败时自动切换',
        set_btnSave: '储存设置',
        set_btnReset: '重置为默认',
        set_msgSaved: '✅ 设置已储存'
    },
    'en': {
        planningAutoInitTitle: '[Planning System] 🗂️ Project planning files initialized',
        planningAutoInitBody: '\`task_plan.md\`, \`findings.md\`, and \`progress.md\` created in root. These are your "External Memory", auto-loaded before every turn. You MUST:\n1. Read them to maintain project context.\n2. Update them proactively as you make progress or findings.\nType \`/handover\` for a summary.',
        planningManualInitTitle: '[Planning System] 🚀 Planning templates created',
        planningManualInitBody: '\`task_plan.md\`, \`findings.md\`, and \`progress.md\` created in root.\nThese serve as your external state. You are responsible for keeping them updated to ensure continuity across sessions.',
        planningNoWorkspace: '[Planning System] ❌ Initialization failed: Please open a folder (Workspace) in VS Code first.',
        handoverHint: '> 💡 Tip: Type \`/handover\` to ask the AI to automatically generate a \`HANDOVER.md\` handover document.',
        rescueTitle: '[System Rescue]',
        rescuePrompt: 'The previous stream stalled. Please continue from where you left off.\n\nProcessed Operations: {0}\nLast content received: {1}',

        ui_bwsCoder: 'BWS.Coder',
        ui_selectModel: 'Select Model',
        ui_manageProviders: 'Manage Providers...',
        ui_clearChat: 'Clear Chat',
        ui_openDashboard: 'Open Dashboard',
        ui_inputPlaceholder: 'Press Shift+Enter for new line, Enter to send...',
        ui_send: 'Send (Enter)',
        ui_chatStart: 'Start of conversation...',
        ui_thinking: 'Thinking...',
        ui_loading: 'Loading...',
        ui_finishedThinking: 'Finished thinking',
        ui_copied: 'Copied!',
        ui_attached: 'Attached',
        ui_images: 'images',
        ui_systemAssistant: 'System Assistant',
        ui_completedTask: '({0}) Completed Task',
        ui_pendingFileOp: 'Pending',
        ui_showPlan: 'Expand detailed plan',
        ui_hidePlan: 'Collapse plan',
        ui_dashboardTitle: '⚡ Task Execution Monitor',
        ui_popOutDashboard: 'Pop out standalone window',
        ui_close: 'Close',
        ui_poppedOutMessage: 'Conversation opened in standalone window',
        ui_poppedOutHint: '(Close standalone window to restore here)',
        ui_returnToSidebar: 'Return to sidebar',
        ui_statusBarAi: 'AI Assistant',
        ui_workflowTitle: 'Workflow Mode',
        ui_groupTitle: 'Group Mode',
        ui_singleTitle: 'Single Mode',
        ui_historyTooltip: 'History',
        ui_newChatTooltip: 'New Session',
        ui_handoverTooltip: 'Save Handover',
        ui_logTooltip: 'View AI Logs',
        ui_input_instruction: 'Shift+Enter for newline, Enter to send',
        ui_continueHint: 'Continue',

        msg_you: 'You',
        msg_aiEngineer: 'AI Engineer',
        msg_taskPlan: 'Task Execution Plan',
        msg_copy: 'Copy',
        msg_apply: 'Apply',
        msg_taskDoneTitle: '🎉 Task Completed',
        msg_taskDoneBody: 'All operations have been fully executed.',
        msg_reportResult: '↳ AI Execution Result',
        msg_processing: 'Processing...',
        msg_returningResult: 'Returning result...',

        wf_orchestration: 'Workflow Orchestration',
        wf_aiPlannerBtn: '✨ AI Planner',
        wf_aiPlannerHint: 'Auto-plan workflow based on input box',
        wf_noModels: 'No models available',
        wf_rolePlaceholder: 'Role / Task Name',
        wf_deleteStep: 'Delete Step',
        wf_promptPlaceholder: 'Specific instructions for this role...',
        wf_parallel: 'Parallel Execution',
        wf_parallelHint: 'Start simultaneously with the next step',
        wf_planningMode: 'Planning Mode Active...',
        wf_addStep: '+ Add Task Step',
        wf_newTask: 'New Task',
        wf_requireInputFirst: 'Please describe your requirement in the input box first, then use the AI Planner.',

        err_protocolViolation: '❌ **Protocol Violation**: Terminal build/echo commands are forbidden. Use standard `create` or `modify` tags.\n\n**Correct Example**:\n[@@ create:{0} @@]\n(content)\n[@@ eof @@]',
        err_commandFormat: '❌ **Command Pattern Warning**: Detected `Start-Process -Wait`. This causes deadlocks.\n**Correct approach**: Call executable directly with `&`, e.g. `& "{0}" -batchmode -quit`',
        err_emptyContent: '❌ **Format Error**: The content block for `{0}` cannot be empty.\n\n**Correct Example**:\n[@@ {0}:{1} @@]\n(code)\n[@@ eof @@]',
        err_replaceFormat: '❌ **Format Error**: The `replace` block must contain complete `[@@<@@]` and `[@@=@@]` tags.\n\n**Correct Example**:\n[@@ replace:{0} @@]\n[@@<@@]\n(Old block)\n[@@=@@]\n(New block)\n[@@>@@]\n[@@ eof @@]',
        err_executorStalled: '\n[System] Command timeout.',
        msg_executing: 'Executing... ({0} mins elapsed)',
        msg_processExited: 'Process exited ({0})',
        msg_execError: 'Execution Error',
        msg_reporting: 'Reporting {0} execution results...',
        err_userAborted: 'Aborted by user',

        err_fallbackExhausted: 'API Keys for **{0}** are exhausted.\nSince Auto Fallback is disabled, execution stopped.\nTip: Please top up keys or enable Auto Fallback.',
        msg_switchingFallback: 'Switching to fallback service',
        msg_fallbackFailed: 'Fallback failed, continuing switch to',
        err_connectionFailed: 'Connection failed',
        err_allExhausted: 'API Keys for all AI services are exhausted or unreachable. Please update keys in Provider Manager',

        op_created: '✅ Created',
        op_modified: '✏️ Modified',
        op_deleted: '🗑️ Deleted',
        op_read: '📄 Read',
        op_createFailed: '❌ Create failed',
        op_modifyFailed: '❌ Modify failed',
        op_deleteFailed: '❌ Delete failed',
        op_readFailed: '❌ Read failed',
        op_replaceFileNotFound: 'File not found, partial replace aborted',
        op_replaceTagsMissing: 'Replace block format error, missing tags',
        op_replaceTagsOrder: 'Replace tag order incorrect',
        op_replaceMultipleFound: 'Found multiple identical blocks, cannot replace',
        op_replaceNotFound: 'Exact match for old code block not found.',

        op_createPending: 'Pending Create...',
        op_modifyPending: 'Pending Modify...',
        op_replacePending: 'Pending Replace...',
        op_deletePending: 'Pending Delete...',
        op_executePending: 'Pending Execute...',
        op_readPending: 'Reading...',
        op_executeStatus: 'Status',
        op_executeResult: 'Result',
        op_success: 'Success',
        op_failedStatus: 'Failed',

        cmd_executeSuccess: 'Command `{0}` executed successfully',
        cmd_executeFailed: 'Command `{0}` failed',
        cmd_output: 'Output:\n{0}\n',
        cmd_noOutput: '(No output)',
        op_failed: '❌ Operation {0} failed: {1}',
        op_resultsTitle: '\n\n---\n**📁 File Operation Results:**\n',
        op_truncatedOutput: '\n\n[... (Skipped approximately {0} lines of logs to save token space. Full output available in VS Code Output Channel) ...]\n\n',
        op_truncatedChars: '\n\n[... (Log is too long, trailing part truncated ...)]',
        op_successDetail: '✅ {0} success: {1}',
        op_readDetail: '📄 Read file \`{0}\`, content below:\n\`\`\`\n{1}\n\`\`\`\n',
        op_executeDetail: 'Command \`{0}\` execution {1}\nOutput:\n{2}\n',
        op_exited: 'Process exited ({0})',
        op_failedInfo: 'Operation {0} failed: {1}',
        err_fileNotFound: 'File or directory not found',
        err_isDirectory: 'Cannot read directory, please provide file path',
        err_noWorkspace: 'No workspace opened, cannot execute operation',
        msg_commandStarting: '[BWS.Coder] Starting command: {0}',
        msg_aiPlanning: '⏳ **AI Workflow planning in progress...** Analyzing your request and generating steps, please wait.',
        msg_groupPersonaPlanning: '⏳ **AI Discussion roles mapping...** Generating participants with different views, please wait.',
        msg_groupPersonaSuccess: '✅ **AI generated {0} discussion roles**',
        msg_groupPersonaFailed: '⚠️ **Role mapping failed**, falling back to default group chat. (Error: {1})',
        msg_exportSuccess: '✅ **Chat history exported successfully!**\nFile saved to: \`{0}\`',
        msg_exportFailed: 'Export failed: {0}',
        msg_exportPrompt: 'Export Chat History',
        msg_loadingLog: 'Loading AI logs...',
        msg_noLog: 'No log records available',
        msg_debug_stateMachine: '[Debug] State machine progress: {0}',
        msg_aiLogs: 'BWS.Coder AI Raw Logs',
        msg_aiPlanningPrompt: 'Plan workflow for the following requirement:',
        msg_aiPlanningSuccess: '✅ **Workflow planning completed**, automatically loaded {0} steps to Task Manager.',
        msg_aiPlanningFailed: '⚠️ **Workflow planning failed**: {0}',
        msg_groupPersonaPrompt: 'Generate discussion personas for the following topic:',
        msg_exportHeader: '# BWS.Coder Chat History\n\nExported at: {0}\n\n---\n\n',
        msg_exportHtml: 'HTML (Visual Web Version)',
        msg_exportMd: 'Markdown (Notebook format)',
        msg_exportTxt: 'Plain Text',
        msg_exportXml: 'XML (Machine readable)',
        msg_exportFileOp: '\n**Create/Modify file: `$2`**\n```\n',
        msg_exportExecOp: '\n**Execute command:** `$1`\n',
        msg_exportDeleteOp: '\n**Delete file:** `$1`\n',
        msg_exportReadOp: '\n**Read file:** `$1`\n',
        op_attachment: '[Attachment: {0}]',
        err_groupTopicRequired: 'Please add a topic after /group or /debate. Example: /group Will AI replace human jobs?',
        err_workflowNoSteps: '[Workflow] No steps configured yet, or all steps are disabled. Please add steps in the Workflow panel and save.',
        err_runnerError: '❌ **Execution Error**: {0}\n\nPlease check if your API Key has sufficient quota, or try refreshing the providers.',
        err_invalidJsonArray: 'Invalid format returned by AI (expected JSON array)',
        msg_groupSingleModeNotice: '[System] Topic not set and fewer than two available AI providers. Starting one-time conversation with a single model.',
        msg_groupExhaustedNotice: ' (Excluded exhausted providers: {0})',
        msg_groupChatStarted: '[System starting Group Chat / Debate], participants: {0}\nTurns will rotate automatically until the turn limit or task completion.',
        msg_groupPersonaRolePrompt: '\n\n[Group Chat Command] You are now roleplaying as "{0}".\n{1}\n\nPlease speak from this perspective, commenting on previous views or counter-arguing others.\n⚠️ **Note: This is a text-only debate. DO NOT use \`[@@ create:path @@]\` tags to create files, and do not generate summary reports.**',
        msg_groupProviderRolePrompt: '\n\n[Group Chat Command] You are now participating as {0}. Please comment on the previous context or proceed with pending tasks.\n⚠️ **Note: Unless strictly required, stick to text-only conversation and avoid creating files.**',
        ui_pending: 'Idle',
        ui_waitingForExec: 'Waiting',
        msg_workflowResumeNotice: '[System] Detected that the first {0} steps are completed. Resuming from step "{1}".',
        err_workflowPromptInvalid: '⚠️ [WorkflowRunner] Step "{0}" prompt quality is insufficient, skipped.\n\n**Issue**: {1}\n\nPlease regenerate with /plan or fix manually.',
        err_promptTooShort: 'Prompt is too short or empty',
        err_promptRepeated: 'Prompt contains repeated word "{0}" (3+ times), looks like AI-generated gibberish',
        err_promptPlaceholderUnfilled: 'Prompt contains unfilled placeholder "{0}"',
        msg_completedTask: 'Task Completed',
        err_noActiveEditor: 'Please open an editor window first',
        ui_uploadFile: 'Upload File',
        ui_allFiles: 'All Files',
        msg_resuscitateSuccess: 'CD Reset (Resuscitation) Completed!',
        ui_imageViewer: 'Image Viewer',
        err_noActiveProviders: 'Please enable at least one AI provider in the Provider Manager',

        // [2026-03-30] Full Localization - Provider Manager (en)
        pm_title: 'BWS.Coder - LLM Provider Management',
        pm_sidebarHeader: 'Configured Providers',
        pm_formTitleAdd: 'Add LLM',
        pm_formTitleEdit: 'Edit Config: {0}',
        pm_labelName: 'Service Name',
        pm_labelModel: 'Model Name',
        pm_labelEndpoint: 'Connection Endpoint',
        pm_labelApiKeys: 'API Keys',
        pm_btnResetCD: '🔄 Reset All CD',
        pm_btnSubmitAdd: 'Add LLM',
        pm_btnSubmitSave: 'Save Changes',
        pm_btnAddKey: '+ Add Key',
        pm_btnCancel: 'Cancel Edit',
        pm_placeholderName: 'e.g., My Custom Model',
        pm_placeholderModel: 'e.g., gpt-4',
        pm_placeholderEndpoint: 'e.g., http://localhost:11434',
        pm_placeholderApiKey: 'Enter API Key',
        pm_emptyHint: 'No providers added yet',
        pm_confirmDelete: 'Are you sure you want to delete "{0}"?',
        pm_btnConfirmDelete: 'Confirm Delete',
        pm_msgAdded: '✅ Added provider: {0}',
        pm_msgUpdated: '✅ Updated provider: {0}',
        pm_msgDeleted: '🗑️ Deleted provider: {0}',
        pm_msgResetCD: '🔄 Reset all CD states for this provider.',
        pm_errorRequired: 'Please fill name and model',

        // [2026-03-30] Full Localization - Settings (en)
        set_title: 'BWS.Coder Global Settings',
        set_temperature: 'Generation Temperature',
        set_temperature_desc: '0-1, lower is more precise',
        set_maxTokens: 'Max Output Tokens',
        set_maxTokens_desc: 'Max tokens per single output',
        set_language: 'Display & Response Language',
        set_language_desc: 'Affects Chat UI and default response language',
        set_debugMode: 'Enable Debug Mode',
        set_debugMode_desc: 'Show state machine progress and detailed logs',
        set_saveRawStream: 'Save Raw Stream Data',
        set_saveRawStream_desc: 'Saves raw AI data to Log directory',
        set_saveAiRequest: 'Save AI Request Payload',
        set_saveAiRequest_desc: 'Saves full request object to Log directory',
        set_groupChatMaxRounds: 'Max Rounds in Group Chat',
        set_groupChatMaxRounds_desc: '0 means no limit',
        set_maxTurnsPerStep: 'Max Turns Per Workflow Step',
        set_maxTurnsPerStep_desc: 'Prevents infinite loops, keep a safety value',
        set_heartbeatTimeout: 'AI Response Timeout (sec)',
        set_heartbeatTimeout_desc: 'Automatically multiplied by 10 for Local LLMs',
        set_autoFallback: 'Auto Fallback to Backup LLM',
        set_autoFallback_desc: 'Switch when primary LLM fails',
        set_btnSave: 'Save Settings',
        set_btnReset: 'Reset to Defaults',
        set_msgSaved: '✅ Settings saved successfully'
    }
};

export function getLang(): string {
    try {
        return vscode.workspace.getConfiguration('bwsCoder').get<string>('language') || 'en';
    } catch (e) {
        return 'en';
    }
}

export function t(lang: string | undefined, key: keyof LocaleStrings, ...args: (string | number)[]): string {
    const resolvedLang: SupportedLang = (lang === 'zh-TW' || lang === 'zh-CN' || lang === 'en') ? lang : 'en';
    let text = locales[resolvedLang][key] || key;
    if (args.length > 0) {
        args.forEach((arg, i) => {
            text = text.split(`{${i}}`).join(String(arg));
        });
    }
    return text;
}
