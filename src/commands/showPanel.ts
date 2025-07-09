import * as vscode from 'vscode';
import { NetworkWebviewProvider } from '../webview/WebviewProvider';
import { RequestManager } from '../core/RequestManager';

export function showPanelCommand(
  context: vscode.ExtensionContext,
  webviewProvider: NetworkWebviewProvider,
  requestManager: RequestManager
): vscode.Disposable {
  return vscode.commands.registerCommand('networkInterceptor.showPanel', () => {
    const panel = webviewProvider.createPanel();

    const updateListener = () => {
      webviewProvider.updatePanel(panel, requestManager.getAllRequests());
    };

    requestManager.on('requestAdded', updateListener);
    requestManager.on('requestUpdated', updateListener);

    const clearListener = () => {
      panel.webview.postMessage({ type: 'clear' });
    };

    requestManager.on('requestsCleared', clearListener);

    panel.onDidDispose(() => {
      requestManager.off('requestAdded', updateListener);
      requestManager.off('requestUpdated', updateListener);
      requestManager.off('requestsCleared', clearListener);
    });
  });
}
