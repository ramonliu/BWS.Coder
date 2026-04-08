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
| `/setting` | Opens the **LLM Configuration** Settings panel immediately. |
| `/manage` | Opens the **AI Provider & Model Manager** panel immediately. |

### 🤖 XML Tool Call Protocol
BWS.Coder now uses a robust XML-based **Tool Call Protocol** for precise and reliable file operations. This structure prevents parsing errors and ensures high-fidelity execution across different LLMs.

| Tool Name | Example XML Block | Description |
| :--- | :--- | :--- |
| `read` | `<tool_call><name>read</name><arguments><path>file.ts</path></arguments></tool_call>` | Reads file content with optional line ranges. |
| `create` | `<tool_call><name>create</name><arguments><path>file.ts</path><content>...</content></arguments></tool_call>` | Creates a new file with the specified content. |
| `modify` | `<tool_call><name>modify</name><arguments><path>file.ts</path><content>...</content></arguments></tool_call>` | Overwrites an existing file completely. |
| `replace` | `<tool_call><name>replace</name><arguments><path>file.ts</path><search>...</search><replace>...</replace></arguments></tool_call>` | Performs precise Search & Replace. |
| `execute` | `<tool_call><name>execute</name><arguments><command>npm test</command></arguments></tool_call>` | Executes shell commands in the terminal. |
| `delete` | `<tool_call><name>delete</name><arguments><path>temp.js</path></arguments></tool_call>` | Deletes the specified file. |

---

## 🌟 Core Features

### 🚀 Diverse Agent Modes
- **Workflow Mode**: Introduces a structured development lifecycle (Design -> Implement -> Verify). The AI decomposes tasks into steps and executes them sequentially.
- **Group Debate (Group/Debate)**: Supports multi-persona collaboration. Different thought models (e.g., Architect, Backend, Frontend) debate and peer-review to produce more rigorous solutions.
- **Single Mode**: Quickly solves small tasks with rapid response times.

### 🧠 Intelligent Memory Management (Context Optimization)
- **Adaptive Volume-Based Freshness**: A sophisticated memory-aware mechanism that protects the most recent 32,000 characters from any pruning, ensuring the AI maintains a perfect short-term memory of current discussions.
- **Head/Tail Content Truncation**: When large files enter the history, the system intelligently preserves the top and bottom 1,000 characters. Most importantly, it uses **Structured Block Rendering** to generate valid XML results from history, preventing amnesia-driven infinite loops.

### 📊 Live Task Dashboard
- **Visual Monitoring**: Provides real-time display of current task status, API consumption, model performance, and system heartbeat.
- **Task Progress Wall**: Automatically syncs `task_plan.md` and `progress.md` from the project, making development progress transparent.

### 📡 Versatile Model & API Polling
- **Ollama Local Drive**: Protects privacy with pure local execution.
- **Gemini Cloud Acceleration**: Seamlessly supports the Gemini 1.5 series.
- **Auto API Polling**: Supports multiple API Keys with intelligent rotation. When one key reaches its rate limit, it switches to the next one automatically.
- **Universal Localization (New!)**: All components, UI, and AI runner status outputs are fully localized in **English**, **Traditional Chinese**, and **Simplified Chinese** with real-time UI synchronization.

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
| `bwsCoder.autoFallback` | Automatically switch to backup model if the primary fails. | `true` |
| `bwsCoder.debugMode` | Enables state machine logs and detailed troubleshooting info. | `false` |
| `bwsCoder.language` | Output language (zh-TW, zh-CN, en). Updates UI in real-time. | `en` |

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