import { Sidebar } from './sidebar';
import { Dashboard } from './dashboard';
import { Workflow } from './workflow';
import { Popup } from './popup';

export class ChatArea {
    public static getHtml(): string {
        return `
            <div class="main-layout">
                <div class="chat-area">
                    ${Dashboard.getHtml()}
                    ${Workflow.getHtml()}
                    <div id="container" class="chat-container"></div>
                </div>
                ${Sidebar.getHtml()}
            </div>
            ${Popup.getHtml()}
        `;
    }
}
