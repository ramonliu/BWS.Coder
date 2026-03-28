export type SupportedLang = 'zh-TW' | 'zh-CN' | 'en';

type LocaleStrings = {
    planningAutoInitTitle: string;
    planningAutoInitBody: string;
    planningManualInitTitle: string;
    planningManualInitBody: string;
    planningNoWorkspace: string;
    handoverHint: string;
    rescueTitle: string;
    rescuePrompt: string;
};

const locales: Record<SupportedLang, LocaleStrings> = {
    'zh-TW': {
        planningAutoInitTitle: '[規劃系統] 專案核心規劃檔案已建立',
        planningAutoInitBody: '`task_plan.md`, `findings.md`, and `progress.md` initialized. [AI Instruction: These files are your "External Memory". You MUST read them before every turn and update them proactively as you make progress.]\n\n輸入 `/handover` 可產生交接摘要。',
        planningManualInitTitle: '[規劃系統] 🚀 專案規劃模板已建立',
        planningManualInitBody: '已建立 `task_plan.md`、`findings.md`、`progress.md`。[AI Instruction: These serve as your project state. Maintain them strictly to ensure continuity across sessions.]',
        planningNoWorkspace: '[規劃系統] ❌ 初始化失敗：請先在 VS Code 開啟一個資料夾 (Workspace)。',
        handoverHint: '> 💡 提示：輸入 `/handover` 可請 AI 自動撰寫 `HANDOVER.md` 交接文件。',
        rescueTitle: '[系統自我救援]',
        rescuePrompt: '串流發生中斷，請從剛才停下的地方繼續。\n\n已處理的操作數：{0}\n最後收到的內容：{1}',
    },
    'zh-CN': {
        planningAutoInitTitle: '[规划系统] 🗂️ 已自动初始化项目核心规划文件',
        planningAutoInitBody: '`task_plan.md`、`findings.md`、`progress.md` 已创建于根目录。这些文件是您的“外部记忆”，在每次对话开始前均会自动加载。您必须：\n1. 随时读取这些文件以掌握全局进度。\n2. 在进行重大决策或阶段完成后，主动更新这些文件。\n输入 `/handover` 可生成交接摘要。',
        planningManualInitTitle: '[规划系统] 🚀 项目规划模板已创建',
        planningManualInitBody: '已在根目录创建 `task_plan.md`、`findings.md`、`progress.md`。\n这些是您的外部记忆库。请主动维护这些文件，确保项目进度、技术发现与执行日志始终保持最新，以维持跨对话的记忆连续性。',
        planningNoWorkspace: '[规划系统] ❌ 初始化失败：请先在 VS Code 中打开一个文件夹 (Workspace)。',
        handoverHint: '> 💡 提示：输入 `/handover` 可让 AI 自动生成 `HANDOVER.md` 交接文档。',
        rescueTitle: '[系统自我救援]',
        rescuePrompt: '流媒体发生中断，请从刚才停下的地方继续。\n\n已处理的操作数：{0}\n最后收到的内容：{1}',
    },
    'en': {
        planningAutoInitTitle: '[Planning System] 🗂️ Project planning files initialized',
        planningAutoInitBody: '`task_plan.md`, `findings.md`, and `progress.md` created in root. These are your "External Memory", auto-loaded before every turn. You MUST:\n1. Read them to maintain project context.\n2. Update them proactively as you make progress or findings.\nType `/handover` for a summary.',
        planningManualInitTitle: '[Planning System] 🚀 Planning templates created',
        planningManualInitBody: '`task_plan.md`, `findings.md`, and `progress.md` created in root.\nThese serve as your external state. You are responsible for keeping them updated to ensure continuity across sessions.',
        planningNoWorkspace: '[Planning System] ❌ Initialization failed: Please open a folder (Workspace) in VS Code first.',
        handoverHint: '> 💡 Tip: Type `/handover` to ask the AI to automatically generate a `HANDOVER.md` handover document.',
        rescueTitle: '[System Rescue]',
        rescuePrompt: 'The previous stream stalled. Please continue from where you left off.\n\nProcessed Operations: {0}\nLast content received: {1}',
    }
};

export function t(lang: string | undefined, key: keyof LocaleStrings): string {
    const resolvedLang: SupportedLang = (lang === 'zh-TW' || lang === 'zh-CN' || lang === 'en') ? lang : 'en';
    return locales[resolvedLang][key];
}
