import * as vscode from 'vscode';
import { NetworkInterceptor } from './NetworkInterceptor';
import { RequestManager } from './RequestManager';
import { NetworkEvent } from '../types';

export class DebugSessionHandler {
  private readonly supportedSessionTypes = ['node', 'node2', 'pwa-node'];

  constructor(private readonly requestManager: RequestManager) {}

  public register(context: vscode.ExtensionContext): void {
    const sessionStartDisposable = vscode.debug.onDidStartDebugSession(
      (session) => this.handleSessionStart(session)
    );

    const trackerDisposable = vscode.debug.registerDebugAdapterTrackerFactory(
      '*',
      {
        createDebugAdapterTracker: (session) => this.createTracker(session),
      }
    );

    context.subscriptions.push(sessionStartDisposable, trackerDisposable);
  }

  private async handleSessionStart(
    session: vscode.DebugSession
  ): Promise<void> {
    if (!this.isSupportedSession(session)) {
      return;
    }

    try {
      await NetworkInterceptor.injectIntoSession(session);
      vscode.window.showInformationMessage(
        `Network interceptor injected into ${session.name}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to inject network interceptor: ${error}`
      );
    }
  }

  private createTracker(
    session: vscode.DebugSession
  ): vscode.DebugAdapterTracker {
    return {
      onDidSendMessage: (message: any) => {
        if (message.type === 'event' && message.event === 'output') {
          this.handleDebugOutput(message.body.output);
        }
      },
    };
  }

  private handleDebugOutput(output: string): void {
    if (!NetworkInterceptor.isInterceptorOutput(output)) {
      return;
    }

    const eventData = NetworkInterceptor.parseInterceptorOutput(output);

    if (eventData && this.isValidNetworkEvent(eventData)) {
      this.requestManager.handleNetworkEvent(eventData as NetworkEvent);
    } else {
      console.warn('Invalid network event data received:', eventData);
    }
  }

  private isValidNetworkEvent(data: any): data is NetworkEvent {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.type === 'string' &&
      ['request', 'response', 'error'].includes(data.type) &&
      typeof data.id === 'string' &&
      typeof data.timestamp === 'number' &&
      data.data !== undefined
    );
  }

  private isSupportedSession(session: vscode.DebugSession): boolean {
    return this.supportedSessionTypes.includes(session.type);
  }
}
