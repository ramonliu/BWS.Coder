export class SettingsHtml {
    public static getHtml(i18n: any, config: any): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 0; margin: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 30px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 15px; }
        .title { font-size: 24px; font-weight: bold; color: var(--vscode-button-background); }
        
        .section { margin-bottom: 25px; background: var(--vscode-sideBar-background); padding: 20px; border-radius: 8px; border: 1px solid var(--vscode-widget-border); }
        .setting-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding: 15px 0; border-bottom: 1px solid rgba(128,128,128,0.1); }
        .setting-item:last-child { border-bottom: none; }
        
        .setting-info { flex: 1; }
        .setting-name { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
        .setting-desc { font-size: 12px; opacity: 0.7; line-height: 1.4; }
        
        .setting-control { width: 220px; display: flex; justify-content: flex-end; align-items: center; }
        
        input[type="text"], input[type="number"], select {
            width: 100%;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 10px;
            border-radius: 4px;
            outline: none;
        }
        input:focus, select:focus { border-color: var(--vscode-focusBorder); }
        
        .switch { position: relative; display: inline-block; width: 40px; height: 20px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #555; transition: .4s; border-radius: 20px; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--vscode-button-background); }
        input:checked + .slider:before { transform: translateX(20px); }
        
        .footer { margin-top: 30px; display: flex; gap: 15px; justify-content: flex-end; sticky: bottom; background: var(--vscode-editor-background); padding: 20px 0; }
        .btn { padding: 10px 24px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.9; }
        .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title" id="setTitle">${i18n.set_title}</div>
        </div>

        <div class="section">
            <!-- Language -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_language">${i18n.set_language}</div>
                    <div class="setting-desc" id="set_language_desc">${i18n.set_language_desc}</div>
                </div>
                <div class="setting-control">
                    <select id="language" onchange="updateLang(this.value)">
                        <option value="en" ${config.language === 'en' ? 'selected' : ''}>English</option>
                        <option value="zh-TW" ${config.language === 'zh-TW' ? 'selected' : ''}>繁體中文 (zh-TW)</option>
                        <option value="zh-CN" ${config.language === 'zh-CN' ? 'selected' : ''}>简体中文 (zh-CN)</option>
                    </select>
                </div>
            </div>

            <!-- Temperature -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_temperature">${i18n.set_temperature}</div>
                    <div class="setting-desc" id="set_temperature_desc">${i18n.set_temperature_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="temperature" value="${config.temperature}" step="0.1" min="0" max="1">
                </div>
            </div>

            <!-- MaxTokens -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_maxTokens">${i18n.set_maxTokens}</div>
                    <div class="setting-desc" id="set_maxTokens_desc">${i18n.set_maxTokens_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="maxTokens" value="${config.maxTokens}" step="256" min="1">
                </div>
            </div>

            <!-- Top P -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_topP">${i18n.set_topP}</div>
                    <div class="setting-desc" id="set_topP_desc">${i18n.set_topP_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="topP" value="${config.topP}" step="0.05" min="0" max="1">
                </div>
            </div>

            <!-- Top K -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_topK">${i18n.set_topK}</div>
                    <div class="setting-desc" id="set_topK_desc">${i18n.set_topK_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="topK" value="${config.topK}" step="1" min="1">
                </div>
            </div>
        </div>

        <div class="section">
            <!-- Debug Mode -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_debugMode">${i18n.set_debugMode}</div>
                    <div class="setting-desc" id="set_debugMode_desc">${i18n.set_debugMode_desc}</div>
                </div>
                <div class="setting-control">
                    <label class="switch"><input type="checkbox" id="debugMode" ${config.debugMode ? 'checked' : ''}><span class="slider"></span></label>
                </div>
            </div>

            <!-- Save Raw Stream -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_saveRawStream">${i18n.set_saveRawStream}</div>
                    <div class="setting-desc" id="set_saveRawStream_desc">${i18n.set_saveRawStream_desc}</div>
                </div>
                <div class="setting-control">
                    <label class="switch"><input type="checkbox" id="saveRawStream" ${config.saveRawStream ? 'checked' : ''}><span class="slider"></span></label>
                </div>
            </div>

            <!-- Save AI Request -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_saveAiRequest">${i18n.set_saveAiRequest}</div>
                    <div class="setting-desc" id="set_saveAiRequest_desc">${i18n.set_saveAiRequest_desc}</div>
                </div>
                <div class="setting-control">
                    <label class="switch"><input type="checkbox" id="saveAiRequest" ${config.saveAiRequest ? 'checked' : ''}><span class="slider"></span></label>
                </div>
            </div>
        </div>

        <div class="section">
            <!-- Group Chat Max Rounds -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_groupChatMaxRounds">${i18n.set_groupChatMaxRounds}</div>
                    <div class="setting-desc" id="set_groupChatMaxRounds_desc">${i18n.set_groupChatMaxRounds_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="groupChatMaxRounds" value="${config.groupChatMaxRounds}" min="0">
                </div>
            </div>

            <!-- Max Turns Per Step -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_maxTurnsPerStep">${i18n.set_maxTurnsPerStep}</div>
                    <div class="setting-desc" id="set_maxTurnsPerStep_desc">${i18n.set_maxTurnsPerStep_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="maxTurnsPerStep" value="${config.maxTurnsPerStep}" min="1">
                </div>
            </div>

            <!-- Heartbeat Timeout -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_heartbeatTimeout">${i18n.set_heartbeatTimeout}</div>
                    <div class="setting-desc" id="set_heartbeatTimeout_desc">${i18n.set_heartbeatTimeout_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="heartbeatTimeout" value="${config.heartbeatTimeout}" min="1">
                </div>
            </div>

            <!-- Max Memory Budget -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_maxMemoryBudget">${i18n.set_maxMemoryBudget}</div>
                    <div class="setting-desc" id="set_maxMemoryBudget_desc">${i18n.set_maxMemoryBudget_desc}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="maxMemoryBudget" value="${config.maxMemoryBudget}" min="1000">
                </div>
            </div>

            <!-- Auto Fallback -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-name" id="set_autoFallback">${i18n.set_autoFallback}</div>
                    <div class="setting-desc" id="set_autoFallback_desc">${i18n.set_autoFallback_desc}</div>
                </div>
                <div class="setting-control">
                    <label class="switch"><input type="checkbox" id="autoFallback" ${config.autoFallback ? 'checked' : ''}><span class="slider"></span></label>
                </div>
            </div>
        </div>

        <div class="footer">
            <button class="btn btn-secondary" onclick="resetDefaults()" id="btnReset">${i18n.set_btnReset}</button>
            <button class="btn btn-primary" onclick="saveSettings()" id="btnSave">${i18n.set_btnSave}</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        // [2026-03-30] Full Localization - Inject i18n bundle
        let i18n = ${JSON.stringify(i18n)};

        window.addEventListener('message', event => {
            if (event.data.command === 'updateLocale') {
                i18n = event.data.i18n;
                applyLocale();
            }
        });

        function applyLocale() {
            document.getElementById('setTitle').textContent = i18n.set_title;
            document.getElementById('set_language').textContent = i18n.set_language;
            document.getElementById('set_language_desc').textContent = i18n.set_language_desc;
            document.getElementById('set_temperature').textContent = i18n.set_temperature;
            document.getElementById('set_temperature_desc').textContent = i18n.set_temperature_desc;
            document.getElementById('set_maxTokens').textContent = i18n.set_maxTokens;
            document.getElementById('set_maxTokens_desc').textContent = i18n.set_maxTokens_desc;
            document.getElementById('set_topP').textContent = i18n.set_topP;
            document.getElementById('set_topP_desc').textContent = i18n.set_topP_desc;
            document.getElementById('set_topK').textContent = i18n.set_topK;
            document.getElementById('set_topK_desc').textContent = i18n.set_topK_desc;
            document.getElementById('set_debugMode').textContent = i18n.set_debugMode;
            document.getElementById('set_debugMode_desc').textContent = i18n.set_debugMode_desc;
            document.getElementById('set_saveRawStream').textContent = i18n.set_saveRawStream;
            document.getElementById('set_saveRawStream_desc').textContent = i18n.set_saveRawStream_desc;
            document.getElementById('set_saveAiRequest').textContent = i18n.set_saveAiRequest;
            document.getElementById('set_saveAiRequest_desc').textContent = i18n.set_saveAiRequest_desc;
            document.getElementById('set_groupChatMaxRounds').textContent = i18n.set_groupChatMaxRounds;
            document.getElementById('set_groupChatMaxRounds_desc').textContent = i18n.set_groupChatMaxRounds_desc;
            document.getElementById('set_maxTurnsPerStep').textContent = i18n.set_maxTurnsPerStep;
            document.getElementById('set_maxTurnsPerStep_desc').textContent = i18n.set_maxTurnsPerStep_desc;
            document.getElementById('set_heartbeatTimeout').textContent = i18n.set_heartbeatTimeout;
            document.getElementById('set_heartbeatTimeout_desc').textContent = i18n.set_heartbeatTimeout_desc;
            document.getElementById('set_autoFallback').textContent = i18n.set_autoFallback;
            document.getElementById('set_autoFallback_desc').textContent = i18n.set_autoFallback_desc;
            document.getElementById('set_maxMemoryBudget').textContent = i18n.set_maxMemoryBudget;
            document.getElementById('set_maxMemoryBudget_desc').textContent = i18n.set_maxMemoryBudget_desc;
            document.getElementById('btnSave').textContent = i18n.set_btnSave;
            document.getElementById('btnReset').textContent = i18n.set_btnReset;
        }

        function updateLang(val) {
            // No action needed for UI here, applyLocale will be called from extension side refresh
            // But we can trigger a save if we want immediate setting update
            saveSettings(false); 
        }

        function saveSettings(showNote = true) {
            const config = {
                language: document.getElementById('language').value,
                temperature: parseFloat(document.getElementById('temperature').value),
                maxTokens: parseInt(document.getElementById('maxTokens').value),
                topP: parseFloat(document.getElementById('topP').value),
                topK: parseInt(document.getElementById('topK').value),
                debugMode: document.getElementById('debugMode').checked,
                saveRawStream: document.getElementById('saveRawStream').checked,
                saveAiRequest: document.getElementById('saveAiRequest').checked,
                groupChatMaxRounds: parseInt(document.getElementById('groupChatMaxRounds').value),
                maxTurnsPerStep: parseInt(document.getElementById('maxTurnsPerStep').value),
                heartbeatTimeout: parseInt(document.getElementById('heartbeatTimeout').value),
                autoFallback: document.getElementById('autoFallback').checked,
                maxMemoryBudget: parseInt(document.getElementById('maxMemoryBudget').value)
            };
            vscode.postMessage({ command: 'saveSettings', config, showNote });
        }

        function resetDefaults() {
            vscode.postMessage({ command: 'resetDefaults' });
        }
    </script>
</body>
</html>`;
    }
}
