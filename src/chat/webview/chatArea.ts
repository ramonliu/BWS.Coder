import { Sidebar } from './sidebar';
import { Dashboard } from './dashboard';
import { Workflow } from './workflow';
import { Popup } from './popup';

export class ChatArea {
    public static getHtml(lang?: string): string {
        return `
            <div class="main-layout">
                <div class="chat-area">
                    ${Dashboard.getHtml(lang)}
                    ${Workflow.getHtml(lang)}
                    <div id="container" class="chat-container"></div>
                </div>
                ${Sidebar.getHtml(lang)}
            </div>
            ${Popup.getHtml(lang)}
        `;
    }
}
