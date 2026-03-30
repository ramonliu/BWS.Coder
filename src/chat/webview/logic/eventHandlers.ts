export class EventHandlers {
    public static get(lang?: string): string {
        return `
            window.addEventListener('message', function(e) {
                var m = e.data;
                if(m.command === 'updateMessages') {
                    messages = m.messages; isGenerating = m.isGenerating; currentSessionId = m.sessionId; 
                    workflowSteps = m.workflowSteps || []; availableModels = m.availableModels || [];
                    if (m.chatMode) {
                        chatMode = m.chatMode;
                        var radios = document.getElementsByName('chat-mode');
                        for(var i=0; i<radios.length; i++) {
                            if(radios[i].value === chatMode) radios[i].checked = true;
                        }
                    }
                    if (m.isPoppedOut !== undefined) {
                        if (m.isPoppedOut) document.body.classList.add('is-popped-out');
                        else document.body.classList.remove('is-popped-out');
                    }
                    render();
                } else if(m.command === 'sessionsLoaded') {
                    var s = document.getElementById('sidebar');
                    if (!s) return;
                    s.innerHTML = '';
                    m.sessions.forEach(function(x) {
                        var d = document.createElement('div');
                        d.className = 'history-item' + (x.id===currentSessionId?' active':'');
                        var titleSpan = document.createElement('span');
                        titleSpan.className = 'title'; titleSpan.textContent = x.title;
                        titleSpan.onclick = function(e) { 
                            vscode.postMessage({command:'loadSession', sessionId:x.id}); 
                            // [2026-03-24] Feature - Auto-close history panel after loading a session
                            var sidebar = document.getElementById('sidebar');
                            if (sidebar) sidebar.classList.remove('active');
                        };
                        var delBtn = document.createElement('div');
                        delBtn.className = 'delete-btn'; delBtn.title = '刪除對話';
                        delBtn.innerHTML = '<svg viewBox="0 0 16 16"><path d="M11 2H9c0-.6-.4-1-1-1s-1 .4-1 1H5c-.6 0-1 .4-1 1v1h8V3c0-.6-.4-1-1-1zM4 5v9c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V5H4zm5 8H7v-6h2v6z"/></svg>';
                        delBtn.onclick = function(e) { e.stopPropagation(); vscode.postMessage({command:'deleteSession', sessionId:x.id}); };
                        d.appendChild(titleSpan); d.appendChild(delBtn); s.appendChild(d);
                    });
                } else if(m.command === 'fileLoaded') {
                    attachments.push(m.attachment); renderAtts();
                } else if(m.command === 'setPoppedOut') {
                    if(m.value) document.body.classList.add('is-popped-out');
                    else document.body.classList.remove('is-popped-out');
                } else if(m.command === 'llmStats') {
                    window.updateDashboard(m.stats);
                } else if(m.command === 'openWorkflowPanel') {
                    var ed = document.getElementById('workflowEditor');
                    if (ed && !ed.classList.contains('active')) {
                        ed.classList.add('active');
                        renderWorkflow();
                    }
                }
            });

            var inp = document.getElementById('input');
            if (document.getElementById('container')) {
            }
            if (inp) {
                inp.onkeydown = function(e) { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMessage(); } };
                inp.oninput = function() { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; };
                inp.onpaste = function(e) {
                    var cbData = e.clipboardData || (window.clipboardData);
                    if (!cbData) return;
                    var items = cbData.items;
                    var handled = false;
                    if (items) {
                        for (var i=0; i<items.length; i++) {
                            if (items[i].type.indexOf('image') !== -1) {
                                var file = items[i].getAsFile();
                                if (!file) continue;
                                var reader = new FileReader();
                                reader.onload = function(event) {
                                    // [2026-03-28] [FIX_PASTE_IMAGE] - Robust image paste with event interception for VS Code webview
                                    attachments.push({type:'image', name:'貼上圖片', content:event.target.result});
                                    renderAtts();
                                };
                                reader.readAsDataURL(file);
                                handled = true;
                            }
                        }
                    }
                    // Fallback for direct files (some Linux/Mac environments)
                    if (!handled && cbData.files && cbData.files.length > 0) {
                        for (var f=0; f<cbData.files.length; f++) {
                            if (cbData.files[f].type.indexOf('image') !== -1) {
                                var reader = new FileReader();
                                reader.onload = function(event) {
                                    attachments.push({type:'image', name:'貼上圖片', content:event.target.result});
                                    renderAtts();
                                };
                                reader.readAsDataURL(cbData.files[f]);
                                handled = true;
                            }
                        }
                    }
                    if (handled) { e.preventDefault(); e.stopPropagation(); }
                };
            }

            window.setChatMode = function(mode) {
                chatMode = mode;
                var radios = document.getElementsByName('chat-mode');
                for(var i=0; i<radios.length; i++) {
                    if(radios[i].value === mode) radios[i].checked = true;
                }
                // [2026-03-24] Feature - Auto-close history panel when switching modes
                var sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('active')) sidebar.classList.remove('active');
                
                // [2026-03-26] UX Fix - Notify extension to persist current mode across resets
                vscode.postMessage({command:'setChatMode', mode: mode});
                render();
            };
        `;
    }
}
