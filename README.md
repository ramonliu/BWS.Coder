# BWS.Coder - AI Engineering Agent (Autonomous Agent)

[English](README.md) | [繁體中文](README_zh.md)

---

**BWS.Coder** is an autonomous AI development assistant designed specifically for VS Code. It goes beyond simple code generation, featuring a robust **Agentic Loop** that allows it to independently compile, analyze errors, execute tests, and perform self-healing bug fixes.

---

## 💬 Commands & Syntax

### 🏃 User Slash Commands
You can enter the following commands directly into the chat box to control AI behavior:

| Command | Description |
| :--- | :--- |
| `/clear` | Clears current conversation history and AI short-term memory (resets context). |
| `/plan` | Triggers the **AI Planning Workflow**. The AI will output a plan before execution. |
| `/group` / `/debate` | Triggers **Group Debate Mode**, inviting multiple AI personas to collaborate. |
| `/stop` | Immediately stops AI generation or aborts background terminal commands. |
| `/export` | Exports the current chat history to HTML, Markdown, Plain Text, or XML. |
| `/handover` | Generates project handover info to help a new AI session pick up current progress. |

### 🤖 AI Internal Protocol Tags
BWS.Coder uses a strict regex-based parsing protocol to execute your instructions. The AI uses these tags in its responses:

| Tag Syntax | Function Description |
| :--- | :--- |
| `[@@ create:path @@]` | Creates a new file at the specified path (with full content). |
| `[@@ modify:path @@]` | Rewrites and replaces the content of an existing file. |
| `[@@ replace:path @@]` | Performs precise "Search & Replace" on large files. |
| `[@@ read:path @@]` | Reads file content from disk to provide context for the AI. |
| `[@@ execute:cmd @@]` | Executes shell commands in your terminal (e.g., `npm install`). |
| `[@@ delete:path @@]` | Permanently deletes the specified file. |
| `[@@DONE@@]` | AI confirms that all development and testing steps are successfully verified. |

---

## 🌟 Core Features

### 🚀 Diverse Agent Modes
- **Workflow Mode**: Introduces a structured development lifecycle (Design -> Implement -> Verify). The AI decomposes tasks into steps and executes them sequentially.
- **Group Debate (Group/Debate)**: Supports multi-persona collaboration. Different thought models (e.g., Architect, Backend, Frontend) debate and peer-review to produce more rigorous solutions.
- **Single Mode**: Quickly solves small tasks with rapid response times.

### 🧠 Intelligent Memory Management (Zero-Artifact Memory)
- **Zero-Artifact Pruning**: A proprietary background memory pruning mechanism. When conversations exceed context limits, it stripped large code blocks without leaving "hallucination-triggering" placeholders, keeping the AI focused.
- **Context Awareness**: Automatically filters redundant data, prioritizing the latest project structure and task progress.

### 📊 Live Task Dashboard
- **Visual Monitoring**: Provides real-time display of current task status, API consumption, model performance, and system heartbeat.
- **Task Progress Wall**: Automatically syncs `task_plan.md` and `progress.md` from the project, making development progress transparent.

### 📡 Versatile Model & API Polling
- **Ollama Local Drive**: Protects privacy with pure local execution.
- **Gemini Cloud Acceleration**: Seamlessly supports the Gemini 1.5 series.
- **Auto API Polling**: Supports multiple API Keys with intelligent rotation. When one key reaches its rate limit, it switches to the next one automatically.

---

## 🛠️ Capabilities

### 📸 Multimedia & UI Optimization
- **Paste to Attach (Ctrl+V)**: Supports pasting images directly from the clipboard for visual analysis (e.g., UI adjustments).
- **Compact Popup Mode**: Preview images in an independent, clean floating window using VS Code's auxiliary window compact mode.
- **Native File Upload**: Built-in paperclip icon for quickly selecting multiple local files as attachments.

### 🛡️ Proactive Verification (Mandatory Testing)
- **Verified Code Only**: Guided by the system prompt, the AI proactively runs `npm install`, starts servers, or fires `curl` requests after writing code, performing self-healing based on test results.
- **Non-blocking Execution**: Exclusive terminal output channel that doesn't interfere with your daily operations.

---

## 🚀 Quick Start

### Prerequisites
- **VS Code** (v1.85+)
- (Optional) **Ollama**: For local execution.
- (Optional) **Gemini API Key**: Apply at [Google AI Studio](https://aistudio.google.com/).

### Installation
1. Download the `bws-coder-x.x.x.vsix` file.
2. In VS Code's Extensions panel, select `Install from VSIX`.

---

## ⚙️ Settings

| Setting | Description | Default |
| :--- | :--- | :--- |
| `bwsCoder.temperature` | Generation temperature (0-1), lower is more precise. | `0.3` |
| `bwsCoder.maxTokens` | Maximum output tokens for the model. | `4096` |
| `bwsCoder.maxTurnsPerStep` | Safety limit for maximum turns in a single workflow step. | `30` |
| `bwsCoder.heartbeatTimeout`| Response detection timeout (seconds). | `30` |
| `bwsCoder.autoFallback` | Automatically switch to backup model if the primary fails. | `false` |
| `bwsCoder.debugMode` | Enables state machine logs and detailed troubleshooting info. | `false` |
| `bwsCoder.language` | Global output language for the AI. | `zh-TW` |

---

## 📂 Project Structure

```bash
BWS.Coder/
├── src/
│   ├── chat/             # Core semantic parsing, Workflow engine, and UI communication
│   ├── llm/              # Multi-model adapters (Ollama/Gemini) and polling system
│   └── utils/            # System Prompts (chat_system.md) and shared utilities
├── prompts/              # System prompts defining the AI core
├── media/                # UI icons and visual resources
└── package.json          # Extension definition and VS Code configuration
```

---

## 📝 License & Declaration

MIT License - Developed by **BaldWolf Studio**.
<!-- [2026-03-28] [FIX_README_UPGRADE] - Multi-language support (EN/ZH). -->