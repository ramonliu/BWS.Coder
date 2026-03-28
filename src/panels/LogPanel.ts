// [2026-03-27] [LogPanel] - Create LogPanel Webview to visualize raw stream debug logs

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseRawLog } from '../utils/logParser';

export class LogPanel {
    public static currentPanel: LogPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _logDir: string;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, logDir: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._logDir = logDir;

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'requestFiles':
                        this._sendFilesList();
                        return;
                    case 'loadFile':
                        this._loadFile(message.fileName);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, logDir: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (LogPanel.currentPanel) {
            LogPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'bwsCoderLog',
            'BWS.Coder Logs',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        LogPanel.currentPanel = new LogPanel(panel, extensionUri, logDir);
    }

    private _sendFilesList() {
        try {
            if (!fs.existsSync(this._logDir)) {
                this._panel.webview.postMessage({ command: 'filesLoaded', files: [] });
                return;
            }
            const files = fs.readdirSync(this._logDir)
                .filter(f => f.startsWith('raw_stream') && f.endsWith('.log'))
                .map(name => {
                    const stat = fs.statSync(path.join(this._logDir, name));
                    return { name, mtime: stat.mtime.getTime() };
                })
                .sort((a, b) => b.mtime - a.mtime)
                .map(f => f.name);

            this._panel.webview.postMessage({ command: 'filesLoaded', files });
        } catch (e) {
            this._panel.webview.postMessage({ command: 'error', text: '無法讀取目錄' });
        }
    }

    private _loadFile(fileName: string) {
        try {
            const filePath = path.join(this._logDir, fileName);
            if (!fs.existsSync(filePath)) {
                this._panel.webview.postMessage({ command: 'error', text: '檔案不存在' });
                return;
            }
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = parseRawLog(content);

            this._panel.webview.postMessage({ 
                command: 'fileParsed', 
                fileName,
                parsed 
            });
        } catch (e) {
            this._panel.webview.postMessage({ command: 'error', text: '解析檔案失敗' });
        }
    }

    public dispose() {
        LogPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    // [2026-03-27] [LogPanel] - Render standard UI style for split view
    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log Viewer</title>
    <style>
        body {
            margin: 0; padding: 0;
            display: flex; height: 100vh;
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
        }
        .sidebar {
            width: 250px;
            border-right: 1px solid var(--vscode-panel-border);
            overflow-y: auto;
            background: var(--vscode-sideBar-background);
        }
        .file-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 13px;
            word-break: break-all;
        }
        .file-item:hover, .file-item.selected {
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        .main {
            flex: 1;
            display: flex; flex-direction: column;
            overflow: hidden;
            background: var(--vscode-editor-background);
            padding: 20px;
        }
        .content-area {
            flex: 1; overflow-y: auto;
            margin-top: 10px;
        }
        .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 8px;
            color: var(--vscode-textLink-foreground);
        }
        .box {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            min-height: 50px;
        }
        .stats {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="sidebar" id="fileList"></div>
    <div class="main" id="mainArea">
        <h2>請選擇左側的 Log 檔案</h2>
        <div id="contentDisplay" style="display:none;" class="content-area">
            <div class="stats" id="statsArea"></div>
            <div class="section-title">💭 思考過程 (Thinking)</div>
            <div class="box" id="thinkingBox"></div>
            <div class="section-title">📄 實際內容 (Content)</div>
            <div class="box" id="contentBox"></div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        
        window.addEventListener('load', () => {
            vscode.postMessage({ command: 'requestFiles' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'filesLoaded':
                    const list = document.getElementById('fileList');
                    list.innerHTML = '';
                    if (message.files.length === 0) {
                        list.innerHTML = '<div style="padding:10px;color:grey;font-size:12px;">無 Log 檔案</div>';
                    }
                    message.files.forEach(f => {
                        const div = document.createElement('div');
                        div.className = 'file-item';
                        div.textContent = f;
                        div.dataset.fileName = f;
                        div.onclick = () => {
                            document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
                            div.classList.add('selected');
                            vscode.postMessage({ command: 'loadFile', fileName: f });
                        };
                        list.appendChild(div);
                    });
                    break;
                case 'fileParsed':
                    document.querySelector('h2').style.display = 'none';
                    document.getElementById('contentDisplay').style.display = 'block';
                    
                    document.getElementById('statsArea').innerHTML = \`
                        <strong>\${message.fileName}</strong><br>
                        內容長度：\${message.parsed.stats.contentLength} | 
                        思考長度：\${message.parsed.stats.thinkingLength}
                    \`;
                    
                    document.getElementById('thinkingBox').textContent = message.parsed.thinking || '(無 Thinking 輸出)';
                    document.getElementById('contentBox').textContent = message.parsed.content || '(無 Content 輸出)';
                    break;
                case 'error':
                    alert(message.text);
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
