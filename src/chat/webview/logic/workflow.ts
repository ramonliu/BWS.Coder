export class Workflow {
    public static get(): string {
        return `
            window.toggleWorkflow = function() {
                var ed = document.getElementById('workflowEditor');
                if (ed) {
                    var isActive = ed.classList.contains('active');
                    if (isActive) {
                        saveWorkflow();
                    }
                    ed.classList.toggle('active');
                    renderWorkflow();
                }
            };

            function renderWorkflow() {
                var ed = document.getElementById('workflowEditor');
                if (!ed) return;
                
                var html = '<div style="font-size:12px; font-weight:bold; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between;">' +
                    '<div style="display:flex; align-items:center; gap:8px;"><span style="color:#4ec9b0">●</span>任務編排</div>' +
                    '<button class="ai-plan-btn" onclick="window.aiPlanWorkflow()" title="根據輸入框內容自動規劃工作流">✨ AI 規劃助手</button>' +
                    '</div>';
                    
                workflowSteps.forEach(function(step, i) {
                    var isActive = lastDashboardStats.some(function(s) { 
                        return s.taskName === step.role && (s.status === 'Online' || s.status === 'Executing'); 
                    });
                    var nodeClass = 'step-node-task' + (isActive ? ' breathing' : '');

                    var options = (availableModels.length === 0) ? '<option value="default">無可用模型</option>' : '';
                    availableModels.forEach(function(m) {
                        var selected = (step.providerId === m.id || step.providerId === m.name) ? 'selected' : '';
                        options += '<option value="' + (m.id || m.name) + '" ' + selected + '>' + m.name + '</option>';
                    });

                    var parallelChecked = step.parallel ? 'checked' : '';

                    html += '<div class="workflow-step">' +
                        '<div class="' + nodeClass + '">' +
                            '<div class="node-header-row">' +
                                '<input type="text" class="task-role-input" value="' + (step.role || '') + '" placeholder="任務性質/角色" oninput="window.updateStep(' + i + ', \\\'role\\\', this.value)">' +
                                '<select class="node-model-select" oninput="window.updateStep(' + i + ', \\\'providerId\\\', this.value)">' + options + '</select>' +
                                '<span class="remove-step" onclick="window.removeStep(' + i + ')" title="刪除節點" style="cursor:pointer; opacity:0.5; font-size:12px;">✕</span>' +
                            '</div>' +
                            '<textarea class="step-prompt" placeholder="對此角色的具體指令..." oninput="window.updateStep(' + i + ', \\\'prompt\\\', this.value)">' + (step.prompt || '') + '</textarea>' +
                            '<div class="node-footer">' +
                                '<label title="與下一個節點同步開始執行"><input type="checkbox" ' + parallelChecked + ' oninput="window.updateStep(' + i + ', \\\'parallel\\\', this.checked)"> 平行執行</label>' +
                                '<span style="opacity:0.3; margin-left: 8px;">|</span>' +
                                '<span style="opacity: 0.5; font-size: 10px; margin-left: 8px;" title="Planning System 已自動啟用">Planning 模式中...</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                });
                
                html += '<button class="add-step-btn" onclick="window.addStep()">+ 新增任務節點</button>';
                ed.innerHTML = html;
            }

            window.addStep = function() {
                workflowSteps.push({ id: Date.now().toString(), role: '新任務', prompt: '', providerId: 'default', enabled: true, parallel: false });
                saveWorkflow();
                renderWorkflow();
            };

            window.removeStep = function(i) {
                workflowSteps.splice(i, 1);
                saveWorkflow();
                renderWorkflow();
            };

            window.updateStep = function(i, field, value) {
                workflowSteps[i][field] = value;
                saveWorkflow();  // 即時 auto-save
            };

            function saveWorkflow() {
                vscode.postMessage({ command: 'saveWorkflow', steps: workflowSteps });
            }

            window.aiPlanWorkflow = function() {
                var inp = document.getElementById('input');
                var text = inp ? inp.value.trim() : '';
                if (!text) {
                    alert('請先在對話框輸入您的需求說明（例如：我要做一個登入功能...），再使用 AI 規劃助手。');
                    return;
                }
                vscode.postMessage({ command: 'aiPlanWorkflow', text: text });
            };
        `;
    }
}
