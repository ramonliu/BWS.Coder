export class Styles {
    public static get(lang?: string): string {
        return `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            :root {
                --bws-glass-bg: rgba(20, 20, 25, 0.35);
                --bws-glass-border: rgba(255, 255, 255, 0.1);
                --bws-glow-color: rgba(0, 242, 254, 0.65); /* Vibrant Cyan Glow */
                --bws-ai-bubble-bg: rgba(255, 255, 255, 0.04);
                --bws-user-bubble-bg: hsla(210, 100%, 55%, 0.12); /* Brighter but more transparent */
                --bws-user-bubble-border: hsla(210, 100%, 70%, 0.35);
                --bws-glass-blur: 16px;
                --bws-deep-blur: 28px;
            }
            body { 
                font-family: var(--vscode-font-family); 
                background: var(--vscode-editor-background); 
                color: var(--vscode-editor-foreground); 
                height: 100vh; 
                display: flex; 
                flex-direction: column; 
                overflow: hidden; 
                line-height: 1.6; 
                position: relative;
                z-index: 0;
            }
            
            /* Background Glowing Orbs for Glassmorphism Context */
            body::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: 
                    radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.15), transparent 50%),
                    radial-gradient(circle at 85% 30%, rgba(168, 85, 247, 0.15), transparent 50%),
                    radial-gradient(circle at 50% 80%, rgba(78, 201, 176, 0.1), transparent 50%);
                z-index: -1;
                pointer-events: none;
            }
            
            /* Custom Scrollbar */
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

            /* Toolbar */
            .toolbar { 
                display: flex; 
                align-items: center; 
                gap: 8px; 
                padding: 8px 16px; 
                background: rgba(0, 0, 0, 0.3); 
                backdrop-filter: blur(var(--deep-blur));
                border-bottom: 1px solid var(--bws-glass-border); 
                z-index: 100;
            }
            .toolbar-btn { width: 30px; height: 30px; background: rgba(255,255,255,0.05); color: var(--vscode-foreground); border: 1px solid transparent; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
            .toolbar-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.1); transform: translateY(-1px); }
            .toolbar-btn svg { width: 16px; height: 16px; fill: currentColor; }
            
            /* Mode Selector */
            .mode-selector { 
                display: flex; 
                background: rgba(0, 0, 0, 0.4); 
                border-radius: 8px; 
                padding: 3px; 
                margin-left: 10px;
                border: 1px solid var(--bws-glass-border);
            }
            .mode-selector input[type="radio"] { display: none; }
            .mode-selector label { 
                padding: 4px 12px; 
                font-size: 11px; 
                border-radius: 5px; 
                cursor: pointer; 
                color: var(--vscode-descriptionForeground);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                user-select: none;
            }
            .mode-selector input[type="radio"]:checked + label { 
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white; 
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }
            
            /* Layout */
            .main-layout { flex: 1; display: flex; overflow: hidden; }
            .sidebar { width: 240px; border-left: 1px solid var(--bws-glass-border); display: none; background: rgba(0,0,0,0.2); backdrop-filter: blur(var(--bws-glass-blur)); overflow-y: auto; }
            .sidebar.active { display: block; }
            
            /* Chat Area */
            .chat-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
            .chat-container { flex: 1; overflow-y: auto; padding: 24px; scroll-behavior: smooth; width: 100%; max-width: 1000px; margin: 0 auto; }
            
            /* Unified Block Architecture - Premium Glass Bubbles */
            .message { 
                margin-bottom: 32px; 
                width: 100%; 
                position: relative; 
                animation: messageEntry 0.4s cubic-bezier(0, 0.5, 0.5, 1);
            }
            @keyframes messageEntry {
                from { opacity: 0; transform: translateY(16px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .block-container { 
                border-radius: 16px; 
                overflow: hidden; 
                background: var(--bws-ai-bubble-bg); 
                border: 1px solid var(--bws-glass-border);
                width: fit-content;
                min-width: 80px;
                max-width: 92%;
                transition: all 0.3s ease;
                backdrop-filter: blur(var(--bws-glass-blur));
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            }
            
            .message.user .block-container { 
                background: var(--bws-user-bubble-bg); 
                border: 1px solid var(--bws-user-bubble-border);
                color: #ffffff; 
                border-bottom-right-radius: 4px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            }
            /* // [2026-03-25] [UI Aesthetics Fix] - Brighter User Icon and Title with glow */
            .message.user .block-icon svg { 
                fill: #64b5f6; 
                filter: drop-shadow(0 0 5px rgba(100, 181, 246, 0.8)); 
            }
            .message.user .block-title { 
                color: #e3f2fd;
                text-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
            }
            /* // [2026-03-25] UI Alignment - Right-align user icon and title */
            .message.user .block-header {
                flex-direction: row-reverse;
                justify-content: flex-start;
                gap: 8px;
            }
            .message.user .block-toggle-icon {
                margin-left: 0;
                margin-right: auto;
            }

            .message.assistant .block-container { 
                border-bottom-left-radius: 4px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            }
            
            /* Provider-Specific Tints (Applied via inline style, enhanced here) */
            .block-container[style*="--ai-accent-color"] {
                box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 0 15px var(--ai-accent-color, transparent);
            }

            /* Glow/Pulse for Streaming */
            @keyframes bws-glow {
                0% { box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 5px var(--bws-glow-color); border-color: rgba(78, 201, 176, 0.3); }
                50% { box-shadow: 0 8px 48px rgba(0,0,0,0.3), 0 0 20px var(--bws-glow-color); border-color: rgba(78, 201, 176, 0.7); }
                100% { box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 5px var(--bws-glow-color); border-color: rgba(78, 201, 176, 0.3); }
            }
            .breathing {
                animation: bws-glow 2.5s infinite ease-in-out !important;
                border-color: var(--bws-glow-color) !important;
            }
            
            .block-header { 
                padding: 10px 16px; 
                font-size: 13px; 
                display: flex; 
                align-items: center; 
                gap: 10px; 
                border-bottom: 1px solid rgba(255,255,255,0.03);
            }
            .block-header[onclick]:hover { background: rgba(255,255,255,0.06); border-radius: 16px 16px 0 0; }
            .block-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
            .block-title { font-weight: 600; font-size: 12px; letter-spacing: 0.2px; }
            
            /* // 2026-03-23 UI Fix - code blocks should be collapsed by default */
            .block-content { padding: 14px 18px; font-size: 13.5px; line-height: 1.6; }
            .block-container.collapsible:not(.expanded) .block-content { display: none; }
            
            /* // 2026-03-23 Fix User Message Truncation - Prevent display: none from hiding text completely */
            .block-user.collapsible:not(.expanded) .block-content { 
                display: -webkit-box !important; 
                -webkit-line-clamp: 2; 
                -webkit-box-orient: vertical; 
                overflow: hidden; 
                padding-bottom: 14px;
            }
            
            .block-container.collapsible .block-header { cursor: pointer; }
            .block-toggle-icon { margin-left: auto; font-size: 10px; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); opacity: 0.6; }
            .block-container.collapsible.expanded .block-toggle-icon { transform: rotate(180deg); opacity: 1; }

            
            /* Specialized Blocks */
            .block-think { 
                background: rgba(0,0,0,0.3) !important; 
                border-color: rgba(156, 220, 254, 0.15); 
                margin: 12px 0; 
                box-shadow: inset 0 0 10px rgba(0,0,0,0.2);
            }
            .block-think .block-header { color: #9cdcfe; background: transparent; }
            .block-think .block-content { 
                font-style: italic; 
                color: rgba(255,255,255,0.6); 
                font-size: 12.5px; 
                border-top: 1px dashed rgba(255,255,255,0.08); 
                padding: 12px 18px;
            }
            
            .block-code { background: #1e1e1e !important; border-color: rgba(255,255,255,0.1); border-radius: 12px; margin: 16px 0; box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
            .block-code .block-header { background: rgba(255,255,255,0.04); color: #888; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            
            .block-fileop { background: rgba(0, 0, 0, 0.2); margin: 6px 0; border-radius: 10px; border-left: 3px solid transparent; transition: border-color 0.3s, background-color 0.3s; }
            .block-fileop .block-header { padding: 6px 14px; font-size: 11.5px; opacity: 0.85; }
            .block-fileop .block-title { color: #e2e8f0; font-weight: bold; } /* Default text color */
            
            /* // 2026-03-24 UI Fix - FileOp execution result colors */
            .block-fileop.success { border-left-color: #4ec9b0; background: rgba(78, 201, 176, 0.08); }
            .block-fileop.success .block-title { color: #4ec9b0; }
            .block-fileop.success .block-header { opacity: 1; }
            .block-fileop.success .block-icon svg { fill: #4ec9b0; }

            .block-fileop.error { border-left-color: #f48771; background: rgba(244, 135, 113, 0.08); }
            .block-fileop.error .block-title { color: #f48771; }
            .block-fileop.error .block-header { opacity: 1; }
            .block-fileop.error .block-icon svg { fill: #f48771; }

            /* // 2026-03-24 UI Fix - Nested Execution Result Box */
            .execution-result-box { margin-top: 12px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); }
            .execution-result-box .result-header { padding: 6px 12px; font-size: 11px; font-weight: bold; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); }
            .execution-result-box .result-body { padding: 8px 12px; overflow-x: auto; }
            .execution-result-box .result-body pre { padding: 0; background: transparent; }
            .execution-result-box.success { border-color: rgba(78, 201, 176, 0.3); }
            .execution-result-box.success .result-header { color: #4ec9b0; background: rgba(78, 201, 176, 0.1); }
            .execution-result-box.error { border-color: rgba(244, 135, 113, 0.3); }
            .execution-result-box.error .result-header { color: #f48771; background: rgba(244, 135, 113, 0.1); }



            /* Animations */
            .spin svg { animation: spin 2s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            
            .streaming { font-size: 11px; color: #9cdcfe; display: flex; align-items: center; gap: 6px; margin: 4px 12px; }
            .streaming .dots::after { content: ''; animation: ellipsis 1.5s steps(4, end) infinite; }
            @keyframes ellipsis { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } 100% { content: ''; } }

            .initial-loader { 
                display: flex; 
                align-items: center; 
                gap: 8px; 
                padding: 12px 16px; 
                color: #00f2fe; /* Vibrant Cyan */
                font-size: 13px; 
                font-style: italic;
                font-weight: 500;
                opacity: 1;
                text-shadow: 0 0 10px rgba(0, 242, 254, 0.4);
                animation: fadeIn 0.5s ease;
            }
            .initial-loader .spin { 
                color: #00f2fe !important; 
                filter: drop-shadow(0 0 6px rgba(0, 242, 254, 0.9));
            }

            /* Code Blocks Internal */
            pre { padding: 12px; margin: 0; overflow-x: auto; font-family: var(--vscode-editor-font-family); font-size: 12px; }
            .code-actions { display: flex; gap: 6px; padding: 8px 12px; background: rgba(0,0,0,0.1); border-top: 1px solid rgba(255,255,255,0.05); }
            .code-btn { padding: 4px 10px; font-size: 11px; background: var(--vscode-button-secondaryBackground); border: none; color: var(--vscode-button-secondaryForeground); border-radius: 4px; cursor: pointer; }
            .code-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

            /* Attachments */
            .chat-image-container { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
            .chat-image { max-width: 100%; max-height: 300px; border-radius: 8px; cursor: zoom-in; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
            .chat-image:hover { transform: scale(1.01); }

            /* Markdown Support */
            .block-content h1, .block-content h2, .block-content h3 { margin: 16px 0 8px 0; }
            .block-content blockquote { border-left: 3px solid var(--vscode-button-background); padding-left: 12px; color: var(--vscode-descriptionForeground); margin: 12px 0; }
            .block-content ul, .block-content ol { padding-left: 20px; margin: 8px 0; }

            /* History Items */
            .history-item { padding: 8px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between; position: relative; }
            .history-item.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
            .history-item .title { flex: 1; overflow: hidden; text-overflow: ellipsis; }
            .history-item .delete-btn { width: 20px; height: 20px; opacity: 0; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: opacity 0.2s, background 0.2s; color: var(--vscode-descriptionForeground); }
            .history-item:hover .delete-btn { opacity: 0.8; }
            .history-item .delete-btn:hover { background: rgba(255,255,255,0.1); color: #d32f2f; opacity: 1; }
            .history-item .delete-btn svg { width: 14px; height: 14px; fill: currentColor; }

            /* Attachments Preview */
            .attachment-preview { position: relative; width: 50px; height: 50px; border-radius: 4px; overflow: hidden; border: 1px solid var(--vscode-widget-border); background: var(--vscode-editor-background); }
            .attachment-preview img { width: 100%; height: 100%; object-fit: cover; }
            .attachment-preview .remove-btn { position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.5); color: white; width: 16px; height: 16px; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-bottom-left-radius: 4px; }
            .attachment-preview .remove-btn:hover { background: #d32f2f; }
            .file-attachment { background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.1); }
            
            /* Diff Highlighting */
            .diff-remove { background-color: rgba(255, 0, 0, 0.15); color: #f48771; display: block; border-left: 3px solid #f48771; padding-left: 6px; }
            .diff-add { background-color: rgba(0, 255, 0, 0.1); color: #89d185; display: block; border-left: 3px solid #89d185; padding-left: 6px; }
            .line-info { color: var(--vscode-descriptionForeground); font-size: 10px; opacity: 0.7; margin-right: 4px; }
            
            /* AI Message Styling (Unified Block) */
            .block-assistant { 
                background: rgba(255,255,255,0.03); 
                border-color: rgba(255,255,255,0.08); 
                width: 100%; 
                border-bottom-left-radius: 2px;
            }
            .block-assistant .block-header { 
                border-bottom: 1px solid rgba(255,255,255,0.03);
            }
            .block-assistant .block-icon svg { fill: #4ec9b0; }
            .block-assistant .block-content { padding: 8px 0; } /* 內容區塊貼合 */
            
            /* Nested blocks inside Assistant */
            .block-assistant .block-container { 
                margin: 2px 12px; /* 2026-03-24 UI Fix - Further reduce vertical gap to keep related actions tighter */
                width: calc(100% - 24px); 
                background: rgba(0,0,0,0.1); 
            }
            .block-assistant .block-think { background: rgba(0,0,0,0.2); margin-bottom: 2px; }

            /* Auto Report Block Styling (System Reports) */
            .auto-report-container { display: flex; flex-direction: column; align-items: flex-start; width: 100%; margin: 8px 0; }
            .block-auto-report { 
                margin: 4px 0; 
                border: 1px solid rgba(255, 255, 255, 0.08); 
                width: 100%; 
                background: rgba(0, 0, 0, 0.4) !important; 
                color: #cccccc !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .block-auto-report .block-header { color: #cccccc !important; font-style: normal; opacity: 1; }
            .block-auto-report .block-content { font-size: 11px; opacity: 1; color: #cccccc !important; border-top: 1px solid rgba(255, 255, 255, 0.05); }
            .block-auto-report .block-icon svg { fill: #cccccc !important; opacity: 0.8; }
            
            /* Task Panel Styling */
            .block-task {
                background: rgba(0, 0, 0, 0.25) !important;
                border-left: 4px solid var(--bws-glow-color);
                margin: 12px 0;
            }
            .task-list { list-style: none; padding: 0; margin: 8px 0; }
            .task-item { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 6px; padding: 4px 8px; border-radius: 4px; transition: background 0.2s; }
            .task-item.done { opacity: 0.6; text-decoration: line-through; }
            .task-item.current { background: rgba(78, 201, 176, 0.15); font-weight: bold; border: 1px dashed var(--bws-glow-color); }
            .task-check { color: var(--bws-glow-color); font-weight: bold; width: 16px; }
            
            .progress-container { height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; margin: 10px 0; }
            .progress-bar { height: 100%; background: linear-gradient(90deg, #4ec9b0, #4285f4); width: 0%; transition: width 0.5s ease; }

            /* Message Layout: AI Left, User Right (Refined) */
            .message.user { align-items: flex-end; padding-left: 20%; }
            .message.assistant { align-items: flex-start; padding-right: 20%; }

            /* Bubble Tail/Shape tweaks */
            .message.user .block-container { 
                border-bottom-right-radius: 4px !important; 
                /* Override left alignment constraint for user */
                margin-left: auto;
            }
            .message.assistant .block-container { border-bottom-left-radius: 4px !important; }

            /* Input Area Area - Floating Glass */
            .input-wrapper { 
                display: flex; 
                justify-content: center; 
                padding: 16px 24px 24px 24px; 
                background: transparent; 
            }
            .input-content-area { 
                width: 100%; 
                max-width: 900px; 
                background: rgba(30,30,35,0.7);
                backdrop-filter: blur(var(--bws-deep-blur));
                border: 1px solid var(--bws-glass-border);
                border-radius: 16px;
                padding: 8px;
                box-shadow: 0 16px 48px rgba(0,0,0,0.4);
                transition: border-color 0.3s, box-shadow 0.3s;
            }
            .input-content-area:focus-within {
                border-color: rgba(99, 102, 241, 0.5);
                box-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 0 10px rgba(99, 102, 241, 0.2);
            }
            .input-row { display: flex; align-items: flex-end; gap: 10px; }
            textarea { 
                flex: 1;
                min-height: 44px; 
                max-height: 300px; 
                padding: 10px 14px; 
                background: transparent; 
                color: #ffffff; 
                border: none; 
                resize: none; 
                outline: none; 
                font-size: 14px;
                line-height: 1.5;
            }
            .input-row .toolbar-btn { margin-bottom: 6px; background: transparent; }
            .input-row .toolbar-btn:hover { background: rgba(255,255,255,0.1); }
            
            .add-step-btn { 
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
                border: 1px dashed rgba(99, 102, 241, 0.4);
                color: #a5b4fc;
            }
            .add-step-btn:hover {
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
                border-color: #a5b4fc;
            }

            
            /* Workflow Editor Styling - Premium Node Look */
            .workflow-editor { 
                background: rgba(15, 15, 15, 0.7); 
                border-bottom: 1px solid var(--bws-glass-border); 
                padding: 16px; 
                display: none; 
                max-height: 480px; 
                overflow-y: auto; 
                backdrop-filter: blur(20px);
                box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
                width: 100%;
                max-width: 1200px;
                margin: 0 auto;
            }
            .workflow-editor.active { display: block; }
            
            .workflow-step { 
                margin-bottom: 20px; 
                position: relative;
                animation: slideIn 0.3s ease-out;
            }
            /* Dashboard Popup Modal */
            .dashboard-overlay { 
                position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); 
                z-index: 5000; display: none; align-items: center; justify-content: center;
                padding: 40px;
                animation: fadeIn 0.2s ease;
            }
            .dashboard-overlay.active { display: flex; }
            .dashboard-content {
                background: var(--vscode-sideBar-background);
                border: 1px solid var(--bws-glass-border);
                border-radius: 12px;
                width: 100%;
                max-width: 900px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6);
                overflow: hidden;
                animation: slideUp 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
            }
            .dashboard-header { 
                display: flex; align-items: center; justify-content: space-between; 
                padding: 16px 20px; border-bottom: 1px solid var(--bws-glass-border);
                background: rgba(255,255,255,0.02);
            }
            .dashboard-title { font-size: 16px; font-weight: bold; color: #4ec9b0; }
            .dashboard-actions { display: flex; align-items: center; gap: 8px; }
            .dashboard-action-btn, .dashboard-close { cursor: pointer; opacity: 0.7; font-size: 20px; transition: opacity 0.2s, background 0.2s; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
            .dashboard-action-btn:hover, .dashboard-close:hover { opacity: 1; background: rgba(255,255,255,0.1); }
            /* // 2026-03-24 UI Redesign - Task-centric Dashboard */
            .dashboard-grid { 
                padding: 16px;
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                gap: 12px;
                overflow-y: auto;
                align-items: flex-start;
                align-content: flex-start;
            }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

            /* Task Card - glassmorphism matching chat bubble */
            /* Task Card - glassmorphism matching chat bubble */
            .task-card { 
                background: hsla(220, 15%, 22%, 0.35);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 14px;
                padding: 14px 16px;
                width: 220px;
                min-height: 120px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                gap: 8px;
                transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s, opacity 0.3s;
                position: relative;
                overflow: hidden;
            }
            .task-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.2); }
            .task-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%); pointer-events: none; border-radius: inherit; }
            
            .task-card.busy { border-color: rgba(78, 201, 176, 0.5); box-shadow: 0 8px 24px rgba(78, 201, 176, 0.2); animation: pulseGreen 2.5s ease-in-out infinite; }
            .task-card.error { border-color: rgba(244,135,113,0.5); box-shadow: 0 8px 24px rgba(244,135,113,0.2); }
            .task-card.finished { border-color: rgba(78, 201, 176, 0.3); opacity: 0.9; }
            .task-card.idle { opacity: 0.5; filter: grayscale(0.5); }

            .task-card-header { display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; margin-bottom: 2px; }
            .task-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
            .dot-busy { background: #4ec9b0; box-shadow: 0 0 8px #4ec9b0; animation: pingDot 1.5s ease-in-out infinite; }
            .dot-error { background: #f48771; box-shadow: 0 0 8px #f48771; }
            .dot-finished { background: #4ec9b0; opacity: 0.8; }
            .dot-idle { background: rgba(255,255,255,0.2); }
            
            .task-status-label { font-size: 11px; font-weight: bold; color: #c8c8c8; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }

            .task-name { 
                font-size: 15px; 
                font-weight: 700; 
                color: #ffffff; 
                line-height: 1.3; 
                word-break: break-word; 
                flex: 1; 
                padding: 4px 0;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .task-meta { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px; margin-top: auto; }
            .task-meta-row { display: flex; justify-content: space-between; align-items: center; }
            
            .task-llm-tag { font-size: 10px; opacity: 0.4; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
            .task-meta-item { font-size: 10px; opacity: 0.6; font-family: monospace; font-weight: 500; }
            
            .task-reason { font-size: 10px; color: #f48771; border-top: 1px solid rgba(244,135,113,0.2); padding-top: 6px; margin-top: 4px; }

            .resuscitate-btn { 
                margin-top: 6px; width: 100%; padding: 5px 8px; background: rgba(161, 66, 244, 0.6); color: white; 
                border: 1px solid rgba(161, 66, 244, 0.3); border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: bold;
                display: flex; align-items: center; justify-content: center; gap: 4px;
                backdrop-filter: blur(4px); transition: filter 0.2s;
            }
            .resuscitate-btn:hover { filter: brightness(1.3); }

            @keyframes pulseGreen { 0%, 100% { box-shadow: 0 8px 24px rgba(78,201,176,0.15); } 50% { box-shadow: 0 8px 32px rgba(78,201,176,0.35); } }
            @keyframes pingDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.4); } }
            @keyframes pulseRed { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }


            .step-node-task {
                background: rgba(30, 30, 35, 0.8);
                border: 1.5px solid rgba(0, 120, 212, 0.5); /* 藍色邊框 */
                border-radius: 10px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                box-shadow: 0 0 15px rgba(0, 120, 212, 0.2); /* 藍光 */
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .step-node-task:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 20px rgba(0, 120, 212, 0.4);
            }
            
            .node-header-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 4px;
            }
            .node-header-row .task-role-input {
                flex: 1;
                font-size: 14px;
                font-weight: bold;
                color: #42a5f5; /* 藍色系文字 */
                background: transparent;
                border: none;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                outline: none;
                padding: 2px 0;
            }
            .node-header-row .task-role-input:focus { border-color: #42a5f5; }

            .node-model-select {
                width: 140px;
                background: rgba(0, 0, 0, 0.4);
                color: #ffffff;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 4px;
                font-size: 13px;
                padding: 4px;
                cursor: pointer;
            }
            .node-model-select:hover { border-color: #42a5f5; }
            .node-model-select option { background: #252526; color: #fff; }

            .step-node-task input { 
                background: transparent; 
                color: #fff; 
                border: none; 
                border-bottom: 1px solid rgba(255,255,255,0.1); 
                font-weight: bold; 
                font-size: 14px; 
                padding: 2px 0;
            }
            .step-node-task input:focus { border-color: #4ec9b0; outline: none; }
            
            .step-node-task textarea { 
                background: rgba(0,0,0,0.2); 
                color: var(--vscode-descriptionForeground); 
                border: 1px solid rgba(255,255,255,0.05); 
                border-radius: 4px; 
                font-size: 13px; 
                min-height: 50px;
                padding: 6px;
            }
            
            .step-node-task .node-footer {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-top: 6px;
                font-size: 12px;
                opacity: 0.8;
            }
            .node-footer label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
            .node-footer select { 
                background: rgba(0, 0, 0, 0.4); 
                color: #ffffff; 
                border: 1px solid rgba(255, 255, 255, 0.15); 
                border-radius: 3px; 
                font-size: 12px; 
                outline: none; 
                cursor: pointer;
                padding: 1px 4px;
            }
            .node-footer select option {
                background: #252526; 
                color: #ffffff;
            }
            
            .step-node-model select { 
                width: 100%; 
                background: rgba(0,0,0,0.4); 
                color: #ffffff; 
                border: 1px solid rgba(255,255,255,0.2); 
                border-radius: 4px;
                font-size: 11px; 
                cursor: pointer;
                padding: 2px 4px;
                outline: none;
            }
            .step-node-model select option {
                background: #252526; 
                color: #ffffff;
            }
            .step-node-model select:hover {
                border-color: var(--vscode-focusBorder);
                background: rgba(0,0,0,0.6);
            }
            
            .step-actions {
                width: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.4;
            }
            .step-actions:hover { opacity: 1; }
            
            .add-step-btn { 
                width: 100%; 
                margin-top: 10px;
                padding: 8px; 
                background: var(--vscode-button-secondaryBackground); 
                border: 1px dashed rgba(255,255,255,0.2); 
                border-radius: 8px; 
                color: #fff; 
                font-size: 12px; 
                cursor: pointer; 
                transition: all 0.2s;
            }
            .add-step-btn:hover { background: var(--vscode-button-secondaryHoverBackground); transform: scale(1.01); }

            /* Popped Out State Overlay */
            .popped-out-overlay { 
                display: none; 
                position: fixed; 
                top: 0; left: 0; right: 0; bottom: 0; 
                background: var(--vscode-sideBar-background); 
                z-index: 10000; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                text-align: center; 
                padding: 20px;
                backdrop-filter: blur(8px);
            }
            body.is-popped-out .popped-out-overlay { display: flex; }
            .popped-card { background: var(--bws-ai-bubble-bg); padding: 24px; border-radius: 12px; border: 1px solid var(--bws-glass-border); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
            .popped-icon { font-size: 40px; margin-bottom: 12px; }
            .popped-btn { margin-top: 16px; padding: 6px 14px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; }
            .popped-btn:hover { opacity: 0.9; }

            .ai-plan-btn {
                background: linear-gradient(135deg, #6366f1, #a855f7);
                color: white;
                border: none;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
            }
            .ai-plan-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 0 15px rgba(168, 85, 247, 0.5);
                filter: brightness(1.1);
            }
        `;
    }
}
