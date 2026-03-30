import { t } from '../../../utils/locale';

export class Workflow {
    public static get(lang?: string): string {
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
                    '<div style="display:flex; align-items:center; gap:8px;"><span style="color:#4ec9b0">●</span>${t(lang, 'wf_orchestration')}</div>' +
                    '<button class="ai-plan-btn" onclick="window.aiPlanWorkflow()" title="${t(lang, 'wf_aiPlannerHint')}">${t(lang, 'wf_aiPlannerBtn')}</button>' +
                    '</div>';
                    
                workflowSteps.forEach(function(step, i) {
                    var isActive = lastDashboardStats.some(function(s) { 
                        return s.taskName === step.role && (s.status === 'Online' || s.status === 'Executing'); 
                    });
                    var nodeClass = 'step-node-task' + (isActive ? ' breathing' : '');

                    var options = (availableModels.length === 0) ? '<option value="default">${t(lang, 'wf_noModels')}</option>' : '';
                    availableModels.forEach(function(m) {
                        var selected = (step.providerId === m.id || step.providerId === m.name) ? 'selected' : '';
                        options += '<option value="' + (m.id || m.name) + '" ' + selected + '>' + m.name + '</option>';
                    });

                    var parallelChecked = step.parallel ? 'checked' : '';

                    html += '<div class="workflow-step">' +
                        '<div class="' + nodeClass + '">' +
                            '<div class="node-header-row">' +
                                '<input type="text" class="task-role-input" value="' + (step.role || '') + '" placeholder="${t(lang, 'wf_rolePlaceholder')}" oninput="window.updateStep(' + i + ', \\\'role\\\', this.value)">' +
                                '<select class="node-model-select" oninput="window.updateStep(' + i + ', \\\'providerId\\\', this.value)">' + options + '</select>' +
                                '<span class="remove-step" onclick="window.removeStep(' + i + ')" title="${t(lang, 'wf_deleteStep')}" style="cursor:pointer; opacity:0.5; font-size:12px;">✕</span>' +
                            '</div>' +
                            '<textarea class="step-prompt" placeholder="${t(lang, 'wf_promptPlaceholder')}" oninput="window.updateStep(' + i + ', \\\'prompt\\\', this.value)">' + (step.prompt || '') + '</textarea>' +
                            '<div class="node-footer">' +
                                '<label title="${t(lang, 'wf_parallelHint')}"><input type="checkbox" ' + parallelChecked + ' oninput="window.updateStep(' + i + ', \\\'parallel\\\', this.checked)"> ${t(lang, 'wf_parallel')}</label>' +
                                '<span style="opacity:0.3; margin-left: 8px;">|</span>' +
                                '<span style="opacity: 0.5; font-size: 10px; margin-left: 8px;" title="Planning System Active">${t(lang, 'wf_planningMode')}</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                });
                
                html += '<button class="add-step-btn" onclick="window.addStep()">${t(lang, 'wf_addStep')}</button>';
                ed.innerHTML = html;
            }

            window.addStep = function() {
                workflowSteps.push({ id: Date.now().toString(), role: '${t(lang, 'wf_newTask')}', prompt: '', providerId: 'default', enabled: true, parallel: false });
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
                    alert('${t(lang, 'wf_requireInputFirst')}');
                    return;
                }
                vscode.postMessage({ command: 'aiPlanWorkflow', text: text });
            };
        `;
    }
}
