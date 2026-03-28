import { Styles } from './webview/styles';
import { Toolbar } from './webview/toolbar';
import { ChatArea } from './webview/chatArea';
import { InputArea } from './webview/inputArea';
import { Scripts } from './webview/scripts';

export class WebviewComponents {
    public static getStyles(): string {
        return Styles.get();
    }

    public static getToolbarHtml(): string {
        return Toolbar.getHtml();
    }

    public static getChatAreaHtml(): string {
        return ChatArea.getHtml();
    }

    public static getInputAreaHtml(): string {
        return InputArea.getHtml();
    }

    public static getScripts(): string {
        return Scripts.get();
    }
}
