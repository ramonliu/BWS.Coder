export class Utility {
    public static get(lang?: string): string {
        return `
            window.copyCode = function(c) { vscode.postMessage({command:'copy', text:c}); };
            window.applyCode = function(c) { vscode.postMessage({command:'applyCode', code:c}); };

            window.toggleBlock = function(event, el) {
                if (event.target.closest('button') || event.target.closest('.code-actions')) return;
                var container = el.closest('.block-container');
                var msgDiv = container ? container.closest('[data-id]') : null;
                var id = msgDiv ? msgDiv.getAttribute('data-id') : null;
                if (container) {
                    event.stopPropagation();
                    container.classList.toggle('expanded');
                    if (id) {
                        var type = container.getAttribute('data-type') || 'generic';
                        var subId = container.getAttribute('data-subid') || '';
                        var key = id + '_' + type + '_' + subId;
                        blockStates[key] = container.classList.contains('expanded');
                    }
                }
            };

            window.toggleHistory = function() {
                var s = document.getElementById('sidebar');
                if (s) {
                    s.classList.toggle('active');
                    if(s.classList.contains('active')) vscode.postMessage({command:'getSessions'});
                }
            };

            // [2026-03-24] UX - Auto-close history sidebar when clicking outside it
            document.addEventListener('click', function(e) {
                var sidebar = document.getElementById('sidebar');
                var histBtn = document.getElementById('historyToggle');
                if (!sidebar || !sidebar.classList.contains('active')) return;
                // If click is inside sidebar or on the toggle button itself, do nothing
                if (sidebar.contains(e.target) || (histBtn && histBtn.contains(e.target))) return;
                sidebar.classList.remove('active');
            }, true); // capture phase so panels opened by other buttons also dismiss it

            window.startNewChat = function() { vscode.postMessage({command:'clear'}); };
            window.sendHandover = function() { vscode.postMessage({command:'send', text:'/handover', attachments:[]}); };
            window.uploadFile = function() { vscode.postMessage({command:'uploadFile'}); };
            window.showFullImage = function(s) { vscode.postMessage({command:'openImage', data: s}); };
            
            window.removeAttachment = function(i) {
                attachments.splice(i, 1);
                renderAtts();
            };
        `;
    }
}
