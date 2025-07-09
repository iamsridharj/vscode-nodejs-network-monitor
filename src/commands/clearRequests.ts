import * as vscode from 'vscode';
import { RequestManager } from '../core/RequestManager';

export function clearRequestsCommand(
  requestManager: RequestManager
): vscode.Disposable {
  return vscode.commands.registerCommand('networkInterceptor.clear', () => {
    requestManager.clearRequests();
    vscode.window.showInformationMessage('Network requests cleared');
  });
}
