import { Globals } from './logic/globals';
import { Messaging } from './logic/messaging';
import { Workflow } from './logic/workflow';
import { Dashboard } from './logic/dashboard';
import { Utility } from './logic/utility';
import { EventHandlers } from './logic/eventHandlers';

export class Scripts {
    public static get(lang?: string): string {
        return `
            (function() {
                ${Globals.get()}
                ${Messaging.get(lang)}
                ${Workflow.get(lang)}
                ${Dashboard.get(lang)}
                ${Utility.get(lang)}
                ${EventHandlers.get(lang)}
            })();
        `;
    }
}
