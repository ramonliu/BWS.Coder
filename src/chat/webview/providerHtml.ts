export class ProviderHtml {
    public static getHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 0; margin: 0; overflow: hidden; }
        .app-container { display: flex; height: 100vh; width: 100vw; }
        .sidebar { width: 350px; min-width: 300px; border-right: 1px solid var(--vscode-widget-border); display: flex; flex-direction: column; background: var(--vscode-sideBar-background); }
        .sidebar-header { padding: 15px; border-bottom: 1px solid var(--vscode-widget-border); font-size: 14px; font-weight: bold; }
        .provider-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
        .main-content { flex: 1; padding: 25px; overflow-y: auto; display: flex; flex-direction: column; }
        .form-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: var(--vscode-button-background); }
        .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
        label { font-size: 12px; font-weight: bold; opacity: 0.8; }
        input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 10px; border-radius: 4px; outline: none; }
        input:focus { border-color: var(--vscode-focusBorder); }
        .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; }
        .btn:hover { opacity: 0.9; }
        .btn-mini { padding: 4px 8px; font-size: 10px; }
        .btn-icon { padding: 6px; border-radius: 4px; min-width: 28px; height: 28px; }
        .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .btn-danger { background: #d32f2f; color: white; }
        svg { fill: currentColor; }
        .key-list { display: flex; flex-direction: column; gap: 8px; margin-top: 5px; }
        .key-item { display: flex; gap: 8px; align-items: center; }
        .key-item input { flex: 1; }
        .provider-card { background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; }
        .provider-card:hover { border-color: var(--vscode-focusBorder); }
        .provider-card.active { border-color: var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
        .card-top { display: flex; justify-content: space-between; align-items: center; pointer-events: none; }
        .card-top > * { pointer-events: auto; }
        .card-name { font-weight: bold; font-size: 13px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .card-details { font-size: 11px; opacity: 0.6; pointer-events: none; }
        .card-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 5px; border-top: 1px solid var(--vscode-widget-border); padding-top: 8px; }
        .switch { position: relative; display: inline-block; width: 30px; height: 16px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #555; transition: .4s; border-radius: 16px; }
        .slider:before { position: absolute; content: ""; height: 12px; width: 12px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--vscode-button-background); }
        input:checked + .slider:before { transform: translateX(14px); }
        .empty-hint { text-align: center; padding: 40px; opacity: 0.5; font-style: italic; font-size: 12px; }
        .btn-delete-key { opacity: 0.5; cursor: pointer; padding: 5px; }
        .btn-delete-key:hover { opacity: 1; color: #d32f2f; }
        .key-input.exhausted { color: #d32f2f; font-weight: bold; border-color: rgba(211, 47, 47, 0.4); background-color: rgba(211, 47, 47, 0.05); }
    </style>
</head>
<body>
    <div class="app-container">
        <div class="sidebar">
            <div class="sidebar-header">已設定的提供者</div>
            <div id="providerList" class="provider-list"></div>
        </div>
        <div class="main-content">
            <div id="formTitle" class="form-title">新增 LLM</div>
            <div class="form-group"><label>服務名稱</label><input type="text" id="name" placeholder="例如: 我的自定義模型"></div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px">
                <div class="form-group"><label>模型名稱 (Model)</label><input type="text" id="model" placeholder="例如: gpt-4"></div>
                <div class="form-group"><label>連接端點 (EndPoint)</label><input type="text" id="endpoint" placeholder="例如: http://localhost:11434"></div>
            </div>
            <div class="form-group">
                <label style="display:flex; align-items:center; gap:8px;">
                    API Keys
                    <span class="btn btn-mini btn-secondary" onclick="resetAllKeys()" style="cursor:pointer; font-weight:normal; opacity:0.8; height:18px; padding:2px 6px; font-size:11px;">🔄 全部重置 CD</span>
                </label>
                <div id="keyList" class="key-list"></div>
            </div>
            <div style="margin-top:auto; padding-top:20px; display:flex; gap:12px; align-items:center; border-top: 1px solid var(--vscode-widget-border);">
                <button class="btn btn-primary" onclick="submitForm()" id="submitBtn">新增 LLM</button>
                <button class="btn btn-secondary" onclick="addKeyField()">+ 新增金鑰</button>
                <button class="btn btn-secondary" style="display:none" id="cancelBtn" onclick="resetForm()">取消編輯</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentProviders = [];
        let currentExhaustedKeys = {};
        let editingId = null;
        let apiKeysCount = 0;

        const ICON_DEL = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M11 1H5V2H1V3H2V14C2 14.55 2.45 15 3 15H13C13.55 15 14 14.55 14 14V3H15V2H11V1ZM13 14H3V3H13V14ZM5 5H6V12H5V5ZM10 5H11V12H10V5ZM7.5 5H8.5V12H7.5V5Z" /></svg>';

        window.addEventListener('message', event => {
            if (event.data.command === 'renderProviders') {
                currentProviders = event.data.providers;
                currentExhaustedKeys = event.data.exhaustedKeys || {};
                renderProviders(currentProviders);
                // [2026-03-30] Fix CD Reset UI Feedback - Sync exhausted class for existing inputs
                document.querySelectorAll('#keyList .key-input').forEach(input => {
                    const isExhausted = !!currentExhaustedKeys[input.value.trim()];
                    if (isExhausted) {
                        input.classList.add('exhausted');
                    } else {
                        input.classList.remove('exhausted');
                    }
                });
            }
        });

        function addKeyField(val = '', isExhausted = false) {
            const list = document.getElementById('keyList');
            const id = 'key_' + (++apiKeysCount);
            const div = document.createElement('div');
            div.className = 'key-item';
            div.id = 'container_' + id;
            const extraClass = isExhausted ? ' exhausted' : '';
            div.innerHTML = '<input type="text" id="' + id + '" value="' + val.replace(/"/g, '&quot;') + '" class="key-input' + extraClass + '" placeholder="輸入 API Key">' +
                            '<span class="btn-delete-key" onclick="removeKeyField(&apos;' + id + '&apos;)">✕</span>';
            list.appendChild(div);
            div.querySelector('input').focus();
        }

        // [2026-03-30] Fix CD Reset UI Feedback - Add optimistic UI update
        function resetAllKeys() {
            const keys = [];
            document.querySelectorAll(\'#keyList input\').forEach(input => {
                if (input.value.trim()) {
                    keys.push(input.value.trim());
                    input.classList.remove(\'exhausted\');
                }
            });
            if (keys.length > 0) {
                vscode.postMessage({ command: \'resetAllApiKeyCD\', keys: keys });
            }
        }

        function removeKeyField(id) {
            const el = document.getElementById('container_' + id);
            if (el) el.remove();
        }

        function renderProviders(providers) {
            const list = document.getElementById('providerList');
            if (!list) return;
            if (!providers || providers.length === 0) {
                list.innerHTML = '<div class="empty-hint">尚未新增任何提供者</div>';
                return;
            }
            list.innerHTML = '';
            providers.forEach(p => {
                const card = document.createElement('div');
                card.className = 'provider-card' + (editingId === p.id ? ' active' : '');
                const isChecked = p.enabled ? 'checked' : '';
                card.innerHTML = '<div class="card-top">' +
                                 '<div class="card-name">' + (p.name || '未命名') + '</div>' +
                                 '<label class="switch"><input type="checkbox" ' + isChecked + '><span class="slider"></span></label>' +
                                 '</div>' +
                                 '<div class="card-details">Model: ' + (p.model || '-') + '</div>' +
                                 '<div class="card-details" style="margin-top: 2px;">API Keys: ' + (p.apiKeys ? p.apiKeys.length : 0) + '</div>' +
                                 '<div class="card-actions"><button class="btn btn-danger btn-icon">' + ICON_DEL + '</button></div>';

                card.onclick = (e) => {
                    if (e.target.closest('.switch') || e.target.closest('button')) return;
                    editProvider(p.id);
                };
                card.querySelector('input[type="checkbox"]').onchange = (e) => {
                    const newVal = e.target.checked;
                    p.enabled = newVal;
                    vscode.postMessage({ command: 'toggleProvider', id: p.id, enabled: newVal });
                };
                card.querySelector('.btn-danger').onclick = (e) => {
                    e.stopPropagation();
                    vscode.postMessage({ command: 'confirmDelete', id: p.id });
                };
                list.appendChild(card);
            });
        }

        function submitForm() {
            const name = document.getElementById('name').value.trim();
            const model = document.getElementById('model').value.trim();
            const endpoint = document.getElementById('endpoint').value.trim();
            const apiKeys = [];
            document.querySelectorAll('#keyList input').forEach(input => {
                if (input.value.trim()) apiKeys.push(input.value.trim());
            });
            if (!name || !model) { alert('請填寫名稱與模型'); return; }

            const providerData = {
                id: editingId,
                name, model, endpoint, apiKeys,
                enabled: editingId ? (currentProviders.find(p => p.id === editingId)?.enabled ?? true) : true
            };
            vscode.postMessage({ command: editingId ? 'updateProvider' : 'addProvider', provider: providerData });
            resetForm();
        }

        function editProvider(id) {
            const p = currentProviders.find(x => x.id === id);
            if (!p) return;
            editingId = id;
            document.getElementById('formTitle').textContent = '修改設定: ' + p.name;
            document.getElementById('submitBtn').textContent = '儲存修改';
            document.getElementById('cancelBtn').style.display = 'inline-block';
            document.getElementById('name').value = p.name;
            document.getElementById('model').value = p.model;
            document.getElementById('endpoint').value = p.endpoint;
            document.getElementById('keyList').innerHTML = '';
            if (p.apiKeys && p.apiKeys.length > 0) {
                p.apiKeys.forEach(k => {
                    const isExhausted = !!currentExhaustedKeys[k];
                    addKeyField(k, isExhausted);
                });
            } else {
                addKeyField();
            }
            renderProviders(currentProviders);
        }

        function resetForm() {
            editingId = null;
            document.getElementById('formTitle').textContent = '新增 LLM';
            document.getElementById('submitBtn').textContent = '新增 LLM';
            document.getElementById('cancelBtn').style.display = 'none';
            document.getElementById('name').value = '';
            document.getElementById('model').value = '';
            document.getElementById('endpoint').value = '';
            document.getElementById('keyList').innerHTML = '';
            addKeyField();
            renderProviders(currentProviders);
        }
        addKeyField();
        vscode.postMessage({ command: 'getProviders' });
    </script>
</body>
</html>`;
    }
}
