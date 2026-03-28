import * as vscode from 'vscode';
import { ILLMClient } from './types';
import { MultiLLMClient } from './multi';

export class LLMFactory {
  static getClient(context: vscode.ExtensionContext): ILLMClient {
    // 現在改為由 MultiLLMClient 統一管理清單中的優先順序與回落
    return new MultiLLMClient(context);
  }
}
