import * as vscode from 'vscode';
import { IWebviewService, WebviewMessage, NetworkRequest } from '../types';
import { LoggerService } from './LoggerService';
import { WebviewContentProvider } from '../webview/WebviewContentProvider';

export class WebviewService implements IWebviewService {
  private static instance: WebviewService;
  private webviewPanel: vscode.WebviewPanel | undefined;
  private readonly logger = LoggerService.getInstance();
  private readonly messageCallbacks: Set<(message: WebviewMessage) => void> =
    new Set();

  private constructor() {}

  public static getInstance(): WebviewService {
    if (!WebviewService.instance) {
      WebviewService.instance = new WebviewService();
    }
    return WebviewService.instance;
  }

  public get isVisible(): boolean {
    return this.webviewPanel?.visible ?? false;
  }

  public show(): void {
    if (this.webviewPanel) {
      this.webviewPanel.reveal(vscode.ViewColumn.Two);
      return;
    }

    this.createWebviewPanel();
  }

  public hide(): void {
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
  }

  public postMessage(message: WebviewMessage): void {
    if (!this.webviewPanel) {
      this.logger.warn('Attempted to post message to non-existent webview');
      return;
    }

    this.webviewPanel.webview.postMessage(message).then(
      () => this.logger.debug('Message posted to webview', message),
      (error) => this.logger.error('Failed to post message to webview', error)
    );
  }

  public onMessage(callback: (message: WebviewMessage) => void): void {
    this.messageCallbacks.add(callback);
  }

  public updateRequests(requests: readonly NetworkRequest[]): void {
    this.postMessage({
      type: 'updateRequests',
      data: requests,
    });
  }

  private createWebviewPanel(): void {
    this.webviewPanel = vscode.window.createWebviewPanel(
      'networkInterceptor',
      'Network Requests',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    this.setupWebviewContent();
    this.setupWebviewEventHandlers();
  }

  private setupWebviewContent(): void {
    if (!this.webviewPanel) {
      return;
    }

    const contentProvider = new WebviewContentProvider(
      this.webviewPanel.webview
    );
    this.webviewPanel.webview.html = contentProvider.getContent([]);
  }

  private setupWebviewEventHandlers(): void {
    if (!this.webviewPanel) {
      return;
    }

    // Handle disposal
    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = undefined;
      this.logger.info('Webview panel disposed');
    });

    // Handle visibility changes
    this.webviewPanel.onDidChangeViewState((event) => {
      this.logger.debug(
        `Webview visibility changed: ${event.webviewPanel.visible}`
      );
    });

    // Handle messages from webview
    this.webviewPanel.webview.onDidReceiveMessage(
      (message: unknown) => {
        this.handleWebviewMessage(message);
      },
      undefined,
      []
    );
  }

  private handleWebviewMessage(message: unknown): void {
    if (!this.isValidWebviewMessage(message)) {
      this.logger.warn('Invalid message received from webview', message);
      return;
    }

    this.logger.debug('Message received from webview', message);

    // Notify all callbacks
    this.messageCallbacks.forEach((callback) => {
      try {
        callback(message);
      } catch (error) {
        this.logger.error('Error in webview message callback', error);
      }
    });
  }

  private isValidWebviewMessage(message: unknown): message is WebviewMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      typeof (message as { type: unknown }).type === 'string'
    );
  }

  public dispose(): void {
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
    this.messageCallbacks.clear();
  }
}
