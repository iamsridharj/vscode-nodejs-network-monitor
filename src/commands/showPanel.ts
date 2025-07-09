import * as vscode from 'vscode';
import { WebviewService } from '../webview/WebviewProvider';
import { RequestManager } from '../core/RequestManager';

export function showPanelCommand(
  context: vscode.ExtensionContext,
  webviewProvider: WebviewService,
  requestManager: RequestManager
): vscode.Disposable {
  return vscode.commands.registerCommand('networkInterceptor.showPanel', () => {
    webviewProvider.show();

    const updateListener = () => {
      webviewProvider.updateRequests(requestManager.getAllRequests());
    };

    requestManager.on('requestAdded', updateListener);
    requestManager.on('requestUpdated', updateListener);

    const clearListener = () => {
      webviewProvider.postMessage({ type: 'clear' });
    };

    requestManager.on('requestsCleared', clearListener);

    // Initial update
    webviewProvider.updateRequests(requestManager.getAllRequests());
  });
}
