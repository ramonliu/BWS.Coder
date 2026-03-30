import { Styles } from './webview/styles';
import { Toolbar } from './webview/toolbar';
import { ChatArea } from './webview/chatArea';
import { InputArea } from './webview/inputArea';
import { Scripts } from './webview/scripts';

export class WebviewComponents {
    public static getStyles(lang?: string): string {
        return Styles.get(lang);
    }

    public static getToolbarHtml(lang?: string): string {
        return Toolbar.getHtml(lang);
    }

    public static getChatAreaHtml(lang?: string): string {
        return ChatArea.getHtml(lang);
    }

    public static getInputAreaHtml(lang?: string): string {
        return InputArea.getHtml(lang);
    }

    public static getScripts(lang?: string): string {
        return Scripts.get(lang);
    }
}
