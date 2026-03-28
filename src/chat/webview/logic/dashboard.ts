export class Dashboard {
    public static get(): string {
        return `
            function toggleDashboard() {
                const overlay = document.getElementById('dashboardOverlay');
                if (overlay) {
                    overlay.classList.toggle('active');
                    if (overlay.classList.contains('active')) {
                        vscode.postMessage({ command: 'getLLMStats' });
                    }
                }
            }
            window.toggleDashboard = toggleDashboard; 

            function popOutDashboard() {
                const overlay = document.getElementById('dashboardOverlay');
                if (overlay) overlay.classList.remove('active');
                vscode.postMessage({ command: 'popOutDashboard' });
            }
            window.popOutDashboard = popOutDashboard;

            function resuscitate(providerId) {
                vscode.postMessage({ command: 'resuscitate', providerId });
            }
            window.resuscitate = resuscitate;
            
            function formatDuration(ms) {
                if (ms < 0) ms = 0;
                var s = Math.floor(ms / 1000);
                var m = Math.floor(s / 60);
                var h = Math.floor(m / 60);
                var d = Math.floor(h / 24);
                var mo = Math.floor(d / 30);
                var y = Math.floor(mo / 12);

                var parts = [];
                if (y > 0) parts.push(y + 'y');
                if (mo % 12 > 0 || y > 0) parts.push((mo % 12) + 'm');
                if (d % 30 > 0 || mo > 0) parts.push((d % 30) + 'd');
                
                var timePart = [
                    String(h % 24).padStart(2, '0'),
                    String(m % 60).padStart(2, '0'),
                    String(s % 60).padStart(2, '0')
                ].join(':');

                return (parts.length > 0 ? parts.join('/') + ' ' : '') + timePart;
            }

            // [2026-03-24] UI Redesign - Task-centric Dashboard (horizontal layout, glassmorphism cards)
            function renderDashboardGrid() {
                var grid = document.getElementById('dashboardGrid');
                if (!grid) return;
                var stats = lastDashboardStats;
                if (!stats || stats.length === 0) {
                    grid.innerHTML = '<div style="opacity:0.5; padding:20px; text-align:center; width:100%;">⚡ 目前沒有執行中的任務</div>';
                    return;
                }

                // [2026-03-25] Task-Centric Display: Show all pre-initialized tasks.
                // Sort by lastUpdate to keep active ones first, but show the full pipeline.
                var displayStats = stats.slice().sort(function(a, b) {
                    if (a.status !== 'Idle' && b.status === 'Idle') return -1;
                    if (a.status === 'Idle' && b.status !== 'Idle') return 1;
                    return b.lastUpdate - a.lastUpdate;
                });

                var now = Date.now();
                grid.innerHTML = displayStats.map(function(s) {
                    var isError = (s.status === 'Error' || s.status === 'Stalled');
                    var isBusy = (s.status === 'Online' || s.status === 'Thinking' || s.status === 'Executing' || s.status === 'Reporting' || s.status === 'Feedback');
                    var isIdle = (s.status === 'Idle');
                    var isFinished = (s.status === 'Finished');

                    var statusLabels = { 
                        'Online': '🧠 思考中', 
                        'Thinking': '🧠 思考中',
                        'Executing': '🛠️ 執行中', 
                        'Stalled': '⚠️ 停頓', 
                        'Error': '❌ 錯誤', 
                        'Idle': '⏳ 待命', 
                        'Reporting': '📝 回報中', 
                        'Feedback': '💬 專家審核',
                        'Finished': '✅ 已完成'
                    };
                    var statusLabel = statusLabels[s.status] || s.status;
                    var cardClass = 'task-card' + (isError ? ' error' : (isBusy ? ' busy' : (isIdle ? ' idle' : (isFinished ? ' finished' : ''))));

                    var liveTime = s.activeTime;
                    if (isBusy && s.status !== 'Idle' && s.status !== 'Finished') liveTime += (now - s.lastUpdate);
                    var duration = formatDuration(liveTime);

                    var taskLabel = s.taskName || '未知任務';
                    var llmLabel = s.name + (s.keyNo !== undefined ? ' [#' + (typeof s.keyNo === 'number' ? s.keyNo + 1 : s.keyNo) + ']' : '');

                    var reasonHtml = isError && s.detailedReason ? '<div class="task-reason">⚠ ' + s.detailedReason + '</div>' : '';
                    var resuscitateBtn = isError ? '<button class="resuscitate-btn" onclick="window.resuscitate(\\'' + s.providerId + '\\')" style="margin-top:auto">⚡ 重啟</button>' : '';

                    return '<div class="' + cardClass + '">' +
                        '<div class="task-card-header">' +
                            '<span class="task-status-dot ' + (isBusy ? 'dot-busy' : (isError ? 'dot-error' : (isFinished ? 'dot-finished' : 'dot-idle'))) + '"></span>' +
                            '<span class="task-status-label">' + statusLabel + '</span>' +
                        '</div>' +
                        '<div class="task-name" title="' + taskLabel + '">' + taskLabel + '</div>' +
                        '<div class="task-meta">' +
                            '<span class="task-llm-tag">' + llmLabel + '</span>' +
                            '<span class="task-meta-item">⏱ ' + (isIdle ? '--:--:--' : duration) + '</span>' +
                        '</div>' +
                        reasonHtml +
                        resuscitateBtn +
                    '</div>';
                }).join('');
            }

            window.updateDashboard = function(stats) {
                lastDashboardStats = stats;
                renderDashboardGrid();
            };

            // 每 200ms 自動刷新 Dashboard (若對話框開啟的話) 以實現工時即時跳動
            setInterval(function() {
                var overlay = document.getElementById('dashboardOverlay');
                if (overlay && overlay.classList.contains('active')) {
                    renderDashboardGrid();
                }
            }, 200);

            vscode.postMessage({ command: 'getLLMStats' });
        `;
    }
}
