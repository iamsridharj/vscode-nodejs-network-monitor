import * as vscode from 'vscode';
import {
  NetworkRequest,
  NetworkEventHandler,
  WebviewMessage,
  ExportOptions,
} from './types';
import { NetworkService } from './services/NetworkService';
import { DebugService } from './services/DebugService';
import { WebviewService } from './webview/WebviewProvider';
import { ConfigService } from './services/ConfigService';
import { LoggerService } from './services/LoggerService';

export class ExtensionController implements NetworkEventHandler {
  private readonly networkService = NetworkService.getInstance();
  private readonly debugService = DebugService.getInstance();
  private readonly webviewService = WebviewService.getInstance();
  private readonly configService = ConfigService.getInstance();
  private readonly logger = LoggerService.getInstance();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.initialize();
  }

  private initialize(): void {
    this.logger.info('Initializing Network Interceptor Extension');

    // IMPORTANT: Set the extension URI for the WebviewService
    this.webviewService.setExtensionUri(this.context.extensionUri);

    // Register event handlers
    this.networkService.addEventHandler(this);
    this.setupWebviewMessageHandling();
    this.setupDebugSessionHandling();
    this.setupConfigurationHandling();
    this.registerCommands();
    this.setupStatusBar();

    // Auto-start capture based on configuration
    const config = this.configService.getConfig();
    if (config.autoCapture) {
      this.networkService.startCapture();
    }

    this.logger.info('Extension initialized successfully');
  }

  private registerCommands(): void {
    // Show panel command
    const showPanelCmd = vscode.commands.registerCommand(
      'networkInterceptor.showPanel',
      () => this.handleShowPanel()
    );

    // Clear requests command
    const clearCmd = vscode.commands.registerCommand(
      'networkInterceptor.clear',
      () => this.handleClearRequests()
    );

    // Export requests command
    const exportCmd = vscode.commands.registerCommand(
      'networkInterceptor.export',
      () => this.handleExportRequests()
    );

    // Toggle auto capture command
    const toggleCaptureCmd = vscode.commands.registerCommand(
      'networkInterceptor.toggleAutoCapture',
      () => this.handleToggleAutoCapture()
    );

    // Toggle capture command
    const toggleCmd = vscode.commands.registerCommand(
      'networkInterceptor.toggleCapture',
      () => this.handleToggleCapture()
    );

    // Show logs command
    const showLogsCmd = vscode.commands.registerCommand(
      'networkInterceptor.showLogs',
      () => this.logger.show()
    );

    // Manual inject command
    const manualInjectCmd = vscode.commands.registerCommand(
      'networkInterceptor.manualInject',
      () => this.handleManualInject()
    );

    // Force inject command (bypasses readiness check)
    const forceInjectCmd = vscode.commands.registerCommand(
      'networkInterceptor.forceInject',
      () => this.handleForceInject()
    );

    // Show session insights command (helpful for monorepo debugging)
    const showSessionInsightsCmd = vscode.commands.registerCommand(
      'networkInterceptor.showSessionInsights',
      () => this.handleShowSessionInsights()
    );

    this.disposables.push(
      showPanelCmd,
      clearCmd,
      exportCmd,
      toggleCaptureCmd,
      toggleCmd,
      showLogsCmd,
      manualInjectCmd,
      forceInjectCmd,
      showSessionInsightsCmd
    );

    this.context.subscriptions.push(...this.disposables);
  }

  private setupStatusBar(): void {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );

    statusBarItem.command = 'networkInterceptor.showPanel';
    this.updateStatusBar(statusBarItem);

    // Update status bar when requests change
    this.networkService.addEventHandler({
      onRequest: () => this.updateStatusBar(statusBarItem),
      onResponse: () => this.updateStatusBar(statusBarItem),
      onError: () => this.updateStatusBar(statusBarItem),
    });

    statusBarItem.show();
    this.disposables.push(statusBarItem);
  }

  private updateStatusBar(statusBarItem: vscode.StatusBarItem): void {
    const requestCount = this.networkService.requests.length;
    const isCapturing = this.networkService.isCapturing;

    const icon = isCapturing ? '$(pulse)' : '$(circle-outline)';
    const status = isCapturing ? 'Capturing' : 'Paused';

    statusBarItem.text = `${icon} Network: ${requestCount} (${status})`;
    statusBarItem.tooltip = `Network Interceptor - ${requestCount} requests captured\nClick to open panel`;
  }

  private setupWebviewMessageHandling(): void {
    this.webviewService.onMessage((message: WebviewMessage) => {
      this.handleWebviewMessage(message);
    });
  }

  private setupDebugSessionHandling(): void {
    this.debugService.onSessionStart((session) => {
      this.logger.info(
        `Debug session started: ${session.name} (${session.type})`
      );
      // Note: Injection is now handled by DebugService with proper filtering
    });

    this.debugService.onSessionEnd((sessionId) => {
      this.logger.info(`Debug session ended: ${sessionId}`);
    });
  }

  private setupConfigurationHandling(): void {
    this.configService.onConfigChange((config) => {
      this.logger.info('Configuration changed', config);

      if (config.autoCapture && !this.networkService.isCapturing) {
        this.networkService.startCapture();
      } else if (!config.autoCapture && this.networkService.isCapturing) {
        this.networkService.stopCapture();
      }
    });
  }

  private async injectInterceptorSafely(sessionId: string): Promise<void> {
    try {
      await this.debugService.injectInterceptor(sessionId);
      vscode.window
        .showInformationMessage(
          'Network interceptor injected successfully',
          'Show Panel'
        )
        .then((action) => {
          if (action === 'Show Panel') {
            this.handleShowPanel();
          }
        });
    } catch (error) {
      this.logger.error('Failed to inject interceptor', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window
        .showWarningMessage(
          `Failed to inject network interceptor: ${message}`,
          'Show Logs'
        )
        .then((action) => {
          if (action === 'Show Logs') {
            this.logger.show();
          }
        });
    }
  }

  // Command handlers
  private handleShowPanel(): void {
    this.webviewService.show();
    this.webviewService.updateRequests(this.networkService.requests);
  }

  private handleClearRequests(): void {
    this.networkService.clearRequests();
    this.webviewService.updateRequests([]);
    this.webviewService.postMessage({ type: 'clear' });
    vscode.window.showInformationMessage('Network requests cleared');
  }

  private async handleExportRequests(): Promise<void> {
    if (this.networkService.requests.length === 0) {
      vscode.window.showInformationMessage('No requests to export');
      return;
    }

    try {
      const format = await vscode.window.showQuickPick(
        [
          { label: 'JSON', value: 'json' as const },
          { label: 'CSV', value: 'csv' as const },
          { label: 'HAR (HTTP Archive)', value: 'har' as const },
        ],
        { placeHolder: 'Select export format' }
      );

      if (!format) return;

      const includeHeaders = await vscode.window.showQuickPick(
        [
          { label: 'Include Headers', value: true },
          { label: 'Exclude Headers', value: false },
        ],
        { placeHolder: 'Include request/response headers?' }
      );

      if (includeHeaders === undefined) return;

      const includeBodies = await vscode.window.showQuickPick(
        [
          { label: 'Include Bodies', value: true },
          { label: 'Exclude Bodies', value: false },
        ],
        { placeHolder: 'Include request/response bodies?' }
      );

      if (includeBodies === undefined) return;

      const options: ExportOptions = {
        format: format.value,
        includeHeaders: includeHeaders.value,
        includeBodies: includeBodies.value,
      };

      const content = await this.networkService.exportRequests(options);

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`network-requests.${format.value}`),
        filters: {
          [format.label]: [format.value],
        },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

        vscode.window
          .showInformationMessage(
            `Exported ${this.networkService.requests.length} requests to ${uri.fsPath}`,
            'Open File'
          )
          .then((action) => {
            if (action === 'Open File') {
              vscode.commands.executeCommand('vscode.open', uri);
            }
          });
      }
    } catch (error) {
      this.logger.error('Export failed', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Export failed: ${message}`);
    }
  }

  private async handleToggleAutoCapture(): Promise<void> {
    const config = this.configService.getConfig();
    const newValue = !config.autoCapture;

    await this.configService.updateConfig('autoCapture', newValue);

    const status = newValue ? 'enabled' : 'disabled';
    vscode.window.showInformationMessage(`Auto capture ${status}`);
  }

  private handleToggleCapture(): void {
    if (this.networkService.isCapturing) {
      this.networkService.stopCapture();
      vscode.window.showInformationMessage('Network capture stopped');
    } else {
      this.networkService.startCapture();
      vscode.window.showInformationMessage('Network capture started');
    }
  }

  private async handleManualInject(): Promise<void> {
    const activeSessions = this.debugService.activeSessions;

    if (activeSessions.length === 0) {
      vscode.window.showWarningMessage('No active debug sessions found');
      return;
    }

    // Show picker for available sessions
    const sessionItems = activeSessions.map((session) => ({
      label: `${session.name} (${session.type})`,
      description: session.isActive ? 'Active' : 'Inactive',
      detail: `Session ID: ${session.id}`,
      sessionId: session.id,
    }));

    const selected = await vscode.window.showQuickPick(sessionItems, {
      placeHolder: 'Select a debug session to inject the network interceptor',
    });

    if (!selected) {
      return;
    }

    try {
      this.logger.info(
        `Manual injection started for session: ${selected.label}`
      );
      await this.debugService.injectInterceptor(selected.sessionId);

      vscode.window
        .showInformationMessage(
          `Network interceptor injected successfully into ${selected.label}`,
          'Show Panel'
        )
        .then((action) => {
          if (action === 'Show Panel') {
            this.handleShowPanel();
          }
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Manual injection failed for session: ${selected.label}`,
        error
      );

      vscode.window
        .showErrorMessage(
          `Failed to inject network interceptor: ${message}`,
          'Show Logs'
        )
        .then((action) => {
          if (action === 'Show Logs') {
            this.logger.show();
          }
        });
    }
  }

  private async handleForceInject(): Promise<void> {
    const activeSessions = this.debugService.activeSessions;

    if (activeSessions.length === 0) {
      vscode.window.showWarningMessage('No active debug sessions found');
      return;
    }

    // Show picker for available sessions
    const sessionItems = activeSessions.map((session) => ({
      label: `${session.name} (${session.type})`,
      description: session.isActive ? 'Active' : 'Inactive',
      detail: `Session ID: ${session.id} | Force injection (bypasses readiness check)`,
      sessionId: session.id,
    }));

    const selected = await vscode.window.showQuickPick(sessionItems, {
      placeHolder:
        'Select a debug session for FORCE injection (bypasses readiness checks)',
    });

    if (!selected) {
      return;
    }

    try {
      this.logger.info(
        `Force injection started for session: ${selected.label}`
      );
      await this.debugService.forceInjectInterceptor(selected.sessionId);

      vscode.window
        .showInformationMessage(
          `Network interceptor FORCE injected successfully into ${selected.label}`,
          'Show Panel'
        )
        .then((action) => {
          if (action === 'Show Panel') {
            this.handleShowPanel();
          }
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Force injection failed for session: ${selected.label}`,
        error
      );

      vscode.window
        .showErrorMessage(
          `Failed to force inject network interceptor: ${message}`,
          'Show Logs'
        )
        .then((action) => {
          if (action === 'Show Logs') {
            this.logger.show();
          }
        });
    }
  }

  private handleShowSessionInsights(): void {
    const debugService = DebugService.getInstance();
    const insights = debugService.getSessionInsights();

    // Show insights in a user-friendly format
    vscode.window.showInformationMessage(
      `Session Insights: ${insights.activeSessions} active sessions. Check console for details.`
    );

    // Log detailed insights to console
    debugService.logSessionInsights();

    // Show quick pick with sessions and their scores
    const items = insights.sessionsByScore.map((session) => ({
      label: session.name,
      description: `Score: ${session.score}`,
      detail: session.willInject
        ? '✅ Will auto-inject'
        : '❌ Will not auto-inject',
    }));

    if (items.length > 0) {
      vscode.window.showQuickPick(items, {
        placeHolder: 'Debug Sessions (ordered by injection score)',
        title: 'Session Insights - Monorepo Debug Help',
      });
    } else {
      vscode.window.showInformationMessage(
        'No active debug sessions found. Start your application in debug mode.'
      );
    }
  }

  private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'clear':
        this.handleClearRequests();
        break;

      case 'export':
        await this.handleExportRequests();
        break;

      case 'filter':
        // Filter is handled in the webview itself
        break;

      default:
        this.logger.warn('Unknown webview message type', message);
    }
  }

  // NetworkEventHandler implementation
  public onRequest(request: NetworkRequest): void {
    this.logger.debug(`Request captured: ${request.method} ${request.url}`);
    this.webviewService.updateRequests(this.networkService.requests);

    // Update context for views
    vscode.commands.executeCommand(
      'setContext',
      'networkInterceptor.hasRequests',
      this.networkService.requests.length > 0
    );
  }

  public onResponse(request: NetworkRequest): void {
    this.logger.debug(
      `Response captured: ${request.responseStatus} for ${request.url}`
    );
    this.webviewService.updateRequests(this.networkService.requests);
  }

  public onError(request: NetworkRequest): void {
    this.logger.debug(`Error captured for ${request.url}: ${request.error}`);
    this.webviewService.updateRequests(this.networkService.requests);
  }

  public dispose(): void {
    this.logger.info('Disposing extension controller');

    // Remove event handlers
    this.networkService.removeEventHandler(this);

    // Dispose all disposables
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;

    // Dispose services
    this.webviewService.dispose();
    this.debugService.dispose();
    this.configService.dispose();
    this.logger.dispose();
  }
}
