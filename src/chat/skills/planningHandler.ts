import * as fs from 'fs';
import * as path from 'path';
import { ChatMessage } from '../historyManager';
import { t } from '../../utils/locale';

const TASK_PLAN_TEMPLATE = `# Task Plan
<!-- 
  WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk."
  WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh.
  WHEN: Update after each phase completes. Re-read this plan before major decisions.
-->

## Goal
[Enter Goal Here]

## Current Phase
Phase 1

## Phases
### Phase 1: Planning & Discovery
- [ ] Understand requirements
- [ ] Document initial findings in findings.md
- **Status:** in_progress

### Phase 2: Implementation
- [ ] Execute plan incrementally
- [ ] Update files and test
- **Status:** pending

## Decisions Made
<!-- Document major architectural or technical choices here with rationale -->
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
<!-- Log EVERY error. Logging errors prevents repeating the same mistakes. -->
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Log ALL errors - they help avoid repetition
- Never repeat a failed action - mutate your approach instead
`;

const FINDINGS_TEMPLATE = `# Findings & Decisions
<!-- 
  WHAT: Your knowledge base. Stores everything you discover, decide, or observe.
  WHY: Context windows are volatile. This file is your permanent "external memory".
-->

## Requirements
<!-- Break down specific user requirements -->
- 

## Research & Visual Findings
<!-- 
  CRITICAL 2-ACTION RULE: After EVERY 2 view/browser/search operations, update this section!
  This prevents multimodal or browser-based visual information from instantly vanishing.
-->
- 

## Issues Encountered
<!-- Complex blockers and how they were conceptually resolved -->
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
<!-- Useful URLs, strict file paths, API references -->
-
`;

const PROGRESS_TEMPLATE = `# Progress Log
<!-- 
  WHAT: Your session log - a chronological record of what you did, when, and what happened.
  WHY: Helps you resume after breaks. Answers "What have I done?"
-->

## Session: [DATE]

### Phase 1: [Title]
- **Status:** in_progress
- **Started:** [timestamp]
- Actions taken:
  - 
- Files created/modified:
  - 

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
|      |       |          |        |        |

## 5-Question Reboot Check
<!-- Periodically verify your context is solid -->
| Question | Answer |
|----------|--------|
| Where am I? | Phase X |
| Where am I going? | Remaining phases |
| What's the goal? | [goal statement] |
| What have I learned? | See findings.md |
| What have I done? | See above |
`;

export class PlanningHandler {
  public static handlePlanCommand(workspacePath: string, generateId: () => string, lang?: string): ChatMessage[] {
    if (!workspacePath) {
      return [{ id: generateId(), role: 'system', content: t(lang, 'planningNoWorkspace'), timestamp: new Date() }];
    }

    const planPath = path.join(workspacePath, 'task_plan.md');
    const findingsPath = path.join(workspacePath, 'findings.md');
    const progressPath = path.join(workspacePath, 'progress.md');

    if (!fs.existsSync(planPath)) fs.writeFileSync(planPath, TASK_PLAN_TEMPLATE);
    if (!fs.existsSync(findingsPath)) fs.writeFileSync(findingsPath, FINDINGS_TEMPLATE);
    if (!fs.existsSync(progressPath)) fs.writeFileSync(progressPath, PROGRESS_TEMPLATE);

    return [{
      id: generateId(),
      role: 'system',
      content: `${t(lang, 'planningManualInitTitle')}\n\n${t(lang, 'planningManualInitBody')}`,
      timestamp: new Date()
    }];
  }

  public static getHandoverPrompt(workspacePath: string): string {
    let actualTextToRun = `[Progress Handover Command] Please summarize the current development progress and workspace state. Read the \`task_plan.md\` and \`progress.md\` in the workspace thoroughly, and write an independent, detailed \`HANDOVER.md\` file. This will serve as a handover summary for the next AI Agent taking over. (Overwrite the file if it already exists.)

Strictly follow the structure below to organize this handover document, ensuring seamless knowledge transfer:

## 1. Current Task Objectives
Explain the problem being solved, expected outputs, and completion criteria.
## 2. Current Progress
Detail the analysis, modifications, troubleshooting, or exact outputs completed so far.
## 3. Key Context
Include essential background information, known constraints, and critical decisions made.
## 4. Key Findings
List the most important conclusions, pitfalls, patterns, or anomalies discovered.
## 5. Unfinished Items
List the remaining tasks that still need processing, ordered by priority.
## 6. Suggested Handover Path
Tell the next Agent which files to investigate first and specify the recommended first step.
## 7. Risks and Important Notes
Explain what areas are prone to misjudgment and which directions have already been tried and failed.`;
    return actualTextToRun;
  }

  public static getDynamicContext(workspacePath: string): string {
    if (!workspacePath) return '';
    const planPath = path.join(workspacePath, 'task_plan.md');
    const findingsPath = path.join(workspacePath, 'findings.md');
    let contextMsg = '';

    if (fs.existsSync(planPath)) {
      contextMsg += `\n\n=== [Current Project Plan (task_plan.md)] ===\n${fs.readFileSync(planPath, 'utf8')}\n====================\n`;
    }
    if (fs.existsSync(findingsPath)) {
      contextMsg += `\n\n=== [Technical Decisions & Findings (findings.md)] ===\n${fs.readFileSync(findingsPath, 'utf8')}\n====================\n`;
    }
    if (contextMsg) {
      contextMsg = `\n\n[System Notification: The following are your PROJECT PLANNING FILES (External Memory). They represent the source of truth for your current state and progress. You MUST:\n1. Read these blocks to understand the "working memory" of the project.\n2. PROACTIVELY use the \`replace\` or \`modify\` actions to update \`task_plan.md\` or \`progress.md\` as soon as you complete a task or change phases.\n3. Update \`findings.md\` immediately (2-Action Rule) after discovering new technical patterns, API details, or resolving complex bugs.\n4. Ensure consistency between your actions and these records to maintain seamless multi-turn execution.]` + contextMsg;
    }
    return contextMsg;
  }
}
