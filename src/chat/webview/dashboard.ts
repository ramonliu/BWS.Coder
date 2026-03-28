export class Dashboard {
    public static getHtml(): string {
        return `
            <div class="dashboard-overlay" id="dashboardOverlay">
                <div class="dashboard-header">
                    <div class="dashboard-title">⚡ 任務執行監控</div>
                    <div class="dashboard-actions">
                        <div class="dashboard-action-btn" onclick="popOutDashboard()" title="彈出獨立視窗">
                            <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M13.5 1h-11C1.67 1 1 1.67 1 2.5v11c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5v-11c0-.83-.67-1.5-1.5-1.5zm0 12.5h-11v-11h11v11zM7 11h2V5H7v6zm-4 0h2V8H3v3zm8 0h2V7h-2v4z"/></svg>
                        </div>
                        <div class="dashboard-close" onclick="toggleDashboard()" title="關閉">
                            <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M1.293 1.293a1 1 0 011.414 0L8 6.586l5.293-5.293a1 1 0 111.414 1.414L9.414 8l5.293 5.293a1 1 0 01-1.414 1.414L8 9.414l-5.293 5.293a1 1 0 01-1.414-1.414L6.586 8 1.293 2.707a1 1 0 010-1.414z"/></svg>
                        </div>
                    </div>
                </div>
                <div class="dashboard-grid" id="dashboardGrid">
                    <!-- Task cards injected here -->
                </div>
            </div>
        `;
    }
}

