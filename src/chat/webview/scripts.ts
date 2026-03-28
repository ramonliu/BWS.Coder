import { Globals } from './logic/globals';
import { Messaging } from './logic/messaging';
import { Workflow } from './logic/workflow';
import { Dashboard } from './logic/dashboard';
import { Utility } from './logic/utility';
import { EventHandlers } from './logic/eventHandlers';

export class Scripts {
    public static get(): string {
        return `
            (function() {
                ${Globals.get()}
                ${Messaging.get()}
                ${Workflow.get()}
                ${Dashboard.get()}
                ${Utility.get()}
                ${EventHandlers.get()}
            })();
        `;
    }
}
