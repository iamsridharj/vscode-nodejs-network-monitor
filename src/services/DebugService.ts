import * as vscode from 'vscode';
import {
  IDebugService,
  SessionInfo,
  NetworkEvent,
  DebugSessionError,
  InterceptorInjectionError,
} from '../types';
import { LoggerService } from './LoggerService';
import { NetworkService } from './NetworkService';
import { ConfigService } from './ConfigService';
import { InterceptorCode } from '../utils/InterceptorCode';

export class DebugService implements IDebugService {
  private static instance: DebugService;
  private readonly logger = LoggerService.getInstance();
  private readonly networkService = NetworkService.getInstance();
  private readonly configService = ConfigService.getInstance();
  private readonly _activeSessions: Map<string, SessionInfo> = new Map();
  private readonly _sessionReferences: Map<string, vscode.DebugSession> =
    new Map(); // NEW: Store direct session references
  private readonly sessionStartCallbacks: Set<(session: SessionInfo) => void> =
    new Set();
  private readonly sessionEndCallbacks: Set<(sessionId: string) => void> =
    new Set();
  private readonly supportedSessionTypes = new Set([
    'node',
    'node2',
    'pwa-node',
  ]);

  private constructor() {
    this.setupDebugEventListeners();
  }

  public static getInstance(): DebugService {
    if (!DebugService.instance) {
      DebugService.instance = new DebugService();
    }
    return DebugService.instance;
  }

  public get activeSessions(): readonly SessionInfo[] {
    return Array.from(this._activeSessions.values());
  }

  public isSessionSupported(sessionType: string): boolean {
    return this.supportedSessionTypes.has(sessionType);
  }

  public onSessionStart(callback: (session: SessionInfo) => void): void {
    this.sessionStartCallbacks.add(callback);
  }

  public onSessionEnd(callback: (sessionId: string) => void): void {
    this.sessionEndCallbacks.add(callback);
  }

  public async injectInterceptor(sessionId: string): Promise<void> {
    const sessionInfo = this._activeSessions.get(sessionId);
    if (!sessionInfo || !sessionInfo.isActive) {
      throw new DebugSessionError(`Session ${sessionId} not found or inactive`);
    }

    // Get the actual session reference instead of relying on activeDebugSession
    const session = this._sessionReferences.get(sessionId);
    if (!session) {
      throw new DebugSessionError(
        `Session reference not found for ${sessionId}`
      );
    }

    try {
      this.logger.info(
        `🎯 Injecting interceptor into session: ${sessionInfo.name} (${sessionId})`
      );

      // Use the direct session reference - no need to wait for it to be "active"
      const interceptorCode = InterceptorCode.getInterceptorCode();
      this.logger.debug(
        `📝 Interceptor code length: ${interceptorCode.length} characters`
      );

      // Try injection with different methods (similar to forceInjectInterceptor)
      const methods = [
        {
          name: 'evaluate with repl context',
          request: { expression: interceptorCode, context: 'repl' },
        },
        {
          name: 'evaluate with watch context',
          request: { expression: interceptorCode, context: 'watch' },
        },
        {
          name: 'evaluate without context',
          request: { expression: interceptorCode },
        },
        {
          name: 'evaluate with frameId 0',
          request: { expression: interceptorCode, frameId: 0 },
        },
      ];

      for (const method of methods) {
        try {
          this.logger.debug(`🧪 Trying injection method: ${method.name}`);
          const result = await session.customRequest(
            'evaluate',
            method.request
          );
          this.logger.info(
            `✅ Injection successful using method: ${method.name}`,
            result
          );

          // Verify injection worked
          try {
            const verifyResult = await session.customRequest('evaluate', {
              expression: 'global.__NETWORK_INTERCEPTOR_INSTALLED__',
              context: 'repl',
            });

            // DAP returns results as strings, so check for string "true" or boolean true
            if (
              verifyResult &&
              (verifyResult.result === true || verifyResult.result === 'true')
            ) {
              this.logger.info(
                `✅ Injection verified: interceptor is installed in ${sessionInfo.name}`
              );
            } else {
              this.logger.warn(
                `⚠️ Injection verification failed for ${sessionInfo.name}:`,
                verifyResult
              );
            }
          } catch (verifyError) {
            this.logger.debug(
              `❓ Could not verify injection in ${sessionInfo.name}:`,
              verifyError instanceof Error ? verifyError.message : verifyError
            );
          }

          this.logger.info(
            `Interceptor successfully injected into session: ${sessionInfo.name} (${sessionId})`
          );
          return; // Success!
        } catch (methodError) {
          this.logger.debug(
            `❌ Method '${method.name}' failed for ${sessionInfo.name}:`,
            methodError instanceof Error ? methodError.message : methodError
          );
        }
      }

      throw new DebugSessionError('All injection methods failed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to inject interceptor into session ${sessionInfo.name} (${sessionId}): ${message}`,
        error
      );
      throw new InterceptorInjectionError(
        `Injection failed: ${message}`,
        error as Error
      );
    }
  }

  public async forceInjectInterceptor(sessionId: string): Promise<void> {
    const sessionInfo = this._activeSessions.get(sessionId);
    if (!sessionInfo || !sessionInfo.isActive) {
      throw new DebugSessionError(`Session ${sessionId} not found or inactive`);
    }

    // Get the actual session reference instead of relying on activeDebugSession
    const session = this._sessionReferences.get(sessionId);
    if (!session) {
      throw new DebugSessionError(
        `Session reference not found for ${sessionId}`
      );
    }

    this.logger.info(
      `🚀 Force injecting interceptor (bypassing all checks) into: ${sessionInfo.name} (${sessionId})`
    );

    try {
      this.logger.info(`💉 Attempting direct injection into: ${session.name}`);

      const interceptorCode = InterceptorCode.getInterceptorCode();
      this.logger.debug(
        `📝 Interceptor code length: ${interceptorCode.length} characters`
      );

      // Try injection with different methods
      const methods = [
        {
          name: 'evaluate with repl context',
          request: { expression: interceptorCode, context: 'repl' },
        },
        {
          name: 'evaluate with watch context',
          request: { expression: interceptorCode, context: 'watch' },
        },
        {
          name: 'evaluate without context',
          request: { expression: interceptorCode },
        },
        {
          name: 'evaluate with frameId 0',
          request: { expression: interceptorCode, frameId: 0 },
        },
      ];

      for (const method of methods) {
        try {
          this.logger.debug(`🧪 Trying injection method: ${method.name}`);
          const result = await session.customRequest(
            'evaluate',
            method.request
          );
          this.logger.info(
            `✅ Force injection successful using method: ${method.name}`,
            result
          );

          // Verify injection worked
          try {
            const verifyResult = await session.customRequest('evaluate', {
              expression: 'global.__NETWORK_INTERCEPTOR_INSTALLED__',
              context: 'repl',
            });

            // DAP returns results as strings, so check for string "true" or boolean true
            if (
              verifyResult &&
              (verifyResult.result === true || verifyResult.result === 'true')
            ) {
              this.logger.info(
                `✅ Force injection verified: interceptor is installed in ${sessionInfo.name}`
              );
            } else {
              this.logger.warn(
                `⚠️ Force injection verification failed for ${sessionInfo.name}:`,
                verifyResult
              );
            }
          } catch (verifyError) {
            this.logger.debug(
              `❓ Could not verify force injection in ${sessionInfo.name}:`,
              verifyError instanceof Error ? verifyError.message : verifyError
            );
          }

          return; // Success!
        } catch (methodError) {
          this.logger.debug(
            `❌ Method '${method.name}' failed for ${sessionInfo.name}:`,
            methodError instanceof Error ? methodError.message : methodError
          );
        }
      }

      throw new DebugSessionError('All force injection methods failed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to force inject interceptor into session ${sessionInfo.name} (${sessionId}): ${message}`,
        error
      );
      throw new InterceptorInjectionError(
        `Force injection failed: ${message}`,
        error as Error
      );
    }
  }

  private setupDebugEventListeners(): void {
    // Listen for debug session start
    vscode.debug.onDidStartDebugSession((session) => {
      this.handleSessionStart(session);
    });

    // Listen for debug session end
    vscode.debug.onDidTerminateDebugSession((session) => {
      this.handleSessionEnd(session);
    });

    // Listen for debug session messages
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker: (session: vscode.DebugSession) => {
        return {
          onDidSendMessage: (message: unknown) => {
            this.handleDebugMessage(session, message);
          },
        };
      },
    });
  }

  private handleSessionStart(session: vscode.DebugSession): void {
    if (!this.isSessionSupported(session.type)) {
      this.logger.debug(`Unsupported session type: ${session.type}`);
      return;
    }

    const sessionInfo: SessionInfo = {
      id: session.id,
      type: session.type,
      name: session.name,
      startTime: new Date(),
      isActive: true,
    };

    this._activeSessions.set(session.id, sessionInfo);
    this._sessionReferences.set(session.id, session); // Store the session reference

    // Enhanced logging for monorepo environments
    const allSessions = Array.from(this._activeSessions.values());
    this.logger.info(
      `🚀 Debug session started: ${session.name} (${session.type})`
    );
    this.logger.debug(
      `📊 Active sessions count: ${allSessions.length}`,
      allSessions.map((s) => `${s.name} (${s.type})`)
    );

    // Notify callbacks
    this.sessionStartCallbacks.forEach((callback) => {
      try {
        callback(sessionInfo);
      } catch (error) {
        this.logger.error('Error in session start callback', error);
      }
    });

    // Auto-inject interceptor if configured and session is suitable
    const config = this.configService.getConfig();
    if (config.autoCapture) {
      const shouldInject = this.shouldAutoInject(session);
      if (shouldInject) {
        this.logger.info(
          `⚡ Auto-injection triggered for: ${session.name} (score-based selection)`
        );
        this.logger.info(
          `ℹ️  Note: Interceptor injected but capture is stopped. Use 'Start Capture' command to begin logging.`
        );
        this.autoInjectInterceptor(session.id);
      } else {
        this.logger.debug(
          `⏭️  Auto-injection skipped for: ${session.name} (insufficient score)`
        );
      }
    } else {
      this.logger.debug(
        `⚙️  Auto-capture disabled, skipping injection for: ${session.name}`
      );
    }
  }

  private shouldAutoInject(session: vscode.DebugSession): boolean {
    // Skip worker threads - these are rarely main application processes
    if (session.name.includes('[worker')) {
      this.logger.debug(
        `Skipping auto-injection for worker thread: ${session.name}`
      );
      return false;
    }

    // Use a scoring system to determine if this is likely an application session
    const score = this.calculateSessionScore(session);
    const shouldInject = score >= 50; // Threshold for auto-injection

    this.logger.debug(
      `Session scoring for ${session.name}: ${score} (${shouldInject ? 'INJECT' : 'SKIP'})`
    );

    return shouldInject;
  }

  private calculateSessionScore(session: vscode.DebugSession): number {
    let score = 0;
    const name = session.name.toLowerCase();

    // Positive indicators (application-like)
    if (name.includes('index.ts') || name.includes('index.js')) score += 80;
    if (name.includes('main.ts') || name.includes('main.js')) score += 80;
    if (name.includes('app.ts') || name.includes('app.js')) score += 70;
    if (name.includes('server.ts') || name.includes('server.js')) score += 70;
    if (name.includes('start') && !name.includes('start landing')) score += 60;
    if (name.includes('.ts') || name.includes('.js')) score += 40;
    if (name.match(/\[\d+\]$/)) score += 30; // Process with PID like [70515]

    // Neutral indicators (could be application or tooling)
    if (
      name.includes('pnpm') ||
      name.includes('npm') ||
      name.includes('yarn')
    ) {
      // Package managers can spawn applications, but check context
      if (
        name.includes('dev') ||
        name.includes('serve') ||
        name.includes('start')
      ) {
        score += 20; // Development servers often spawn actual apps
      } else {
        score -= 10; // Pure package manager operations
      }
    }

    if (name.includes('cli.mjs') || name.includes('cli.js')) {
      // CLI tools can spawn applications
      if (
        name.includes('dev') ||
        name.includes('serve') ||
        name.includes('start')
      ) {
        score += 20;
      } else {
        score -= 10;
      }
    }

    // Negative indicators (tooling-like)
    if (
      name.includes('webpack') ||
      name.includes('vite') ||
      name.includes('rollup')
    )
      score -= 20;
    if (name.includes('test') || name.includes('spec')) score -= 20;
    if (name.includes('build') || name.includes('compile')) score -= 20;
    if (name.includes('lint') || name.includes('format')) score -= 30;
    if (name.includes('git') || name.includes('husky')) score -= 40;

    // Session type bonuses
    if (session.type === 'node' || session.type === 'pwa-node') score += 10;

    return Math.max(0, Math.min(100, score)); // Clamp between 0-100
  }

  private handleSessionEnd(session: vscode.DebugSession): void {
    const sessionInfo = this._activeSessions.get(session.id);
    if (sessionInfo) {
      const updatedSession = { ...sessionInfo, isActive: false };
      this._activeSessions.set(session.id, updatedSession);
      this._sessionReferences.delete(session.id); // Remove session reference

      this.logger.info(`Debug session ended: ${session.name}`);

      // Notify callbacks
      this.sessionEndCallbacks.forEach((callback) => {
        try {
          callback(session.id);
        } catch (error) {
          this.logger.error('Error in session end callback', error);
        }
      });

      // Clean up after some time
      setTimeout(() => {
        this._activeSessions.delete(session.id);
      }, 60000); // Keep for 1 minute for reference
    }
  }

  private handleDebugMessage(
    session: vscode.DebugSession,
    message: unknown
  ): void {
    if (!this.isValidMessage(message)) {
      return;
    }

    // Look for network interceptor messages
    if (message.type === 'event' && message.event === 'output') {
      const output = message.body?.output;
      if (
        typeof output === 'string' &&
        output.includes('__NETWORK_INTERCEPTOR__')
      ) {
        this.parseNetworkEvent(session.id, output);
      }
    }
  }

  private isValidMessage(message: unknown): message is {
    type: string;
    event?: string;
    body?: { output?: string };
  } {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      typeof (message as { type: unknown }).type === 'string'
    );
  }

  private parseNetworkEvent(sessionId: string, output: string): void {
    try {
      const markerIndex = output.indexOf('__NETWORK_INTERCEPTOR__');
      if (markerIndex === -1) {
        return;
      }

      const jsonStr = output.substring(markerIndex + 23);
      const event: NetworkEvent = JSON.parse(jsonStr);

      // Add session context
      const eventWithSession = { ...event, sessionId };

      this.networkService.handleNetworkEvent(eventWithSession);
    } catch (error) {
      this.logger.warn('Failed to parse network event', {
        sessionId,
        output: output.substring(0, 200) + '...', // Truncate long output
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async autoInjectInterceptor(sessionId: string): Promise<void> {
    const sessionInfo = this._activeSessions.get(sessionId);
    if (!sessionInfo) {
      this.logger.warn(`Session ${sessionId} not found for auto-injection`);
      return;
    }

    const sessionName = sessionInfo.name;

    try {
      this.logger.info(
        `🔄 Starting auto-injection for: ${sessionName} (${sessionId})`
      );

      // Small delay to ensure session is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Enhanced logging for monorepo debugging
      this.logger.debug(`🎯 Attempting injection into: ${sessionName}`, {
        sessionId,
        sessionType: sessionInfo.type,
        startTime: sessionInfo.startTime,
        isActive: sessionInfo.isActive,
      });

      await this.injectInterceptor(sessionId);

      this.logger.info(
        `✅ Auto-injection successful for: ${sessionName} (${sessionId})`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Enhanced error categorization for monorepo environments
      const isMainSession = this.isLikelyMainSession(sessionName);
      const logLevel = isMainSession ? 'warn' : 'debug';

      this.logger[logLevel](
        `❌ Auto-injection failed for ${isMainSession ? 'main' : 'auxiliary'} session: ${sessionName} (${sessionId})`,
        {
          error: errorMessage,
          sessionType: sessionInfo.type,
          isMainSession,
          suggestion: isMainSession
            ? 'Try using "Manual Inject Interceptor" or "Force Inject Interceptor (Debug)" commands'
            : 'This might be a tooling session - consider using manual injection if needed',
        }
      );

      // For main sessions, provide helpful hints
      if (isMainSession) {
        this.logger.info(
          `💡 Tip: In monorepo environments, you can use manual injection commands for better control`
        );
      }
    }
  }

  private isLikelyMainSession(sessionName: string): boolean {
    const name = sessionName.toLowerCase();
    return (
      name.includes('index.ts') ||
      name.includes('index.js') ||
      name.includes('main.ts') ||
      name.includes('main.js') ||
      name.includes('app.ts') ||
      name.includes('app.js') ||
      name.includes('server.ts') ||
      name.includes('server.js') ||
      (name.includes('start') && !name.includes('start landing'))
    );
  }

  public getSessionInsights(): {
    totalSessions: number;
    activeSessions: number;
    sessionsByType: Record<string, number>;
    sessionsByScore: Array<{
      name: string;
      score: number;
      willInject: boolean;
    }>;
    recommendations: string[];
  } {
    const sessions = Array.from(this._activeSessions.values());
    const activeSessions = sessions.filter((s) => s.isActive);

    const sessionsByType = activeSessions.reduce(
      (acc, session) => {
        acc[session.type] = (acc[session.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const sessionsByScore = activeSessions
      .map((session) => {
        const mockSession = {
          name: session.name,
          type: session.type,
        } as vscode.DebugSession;
        const score = this.calculateSessionScore(mockSession);
        return {
          name: session.name,
          score,
          willInject: score >= 50,
        };
      })
      .sort((a, b) => b.score - a.score);

    const recommendations: string[] = [];

    if (sessionsByScore.length === 0) {
      recommendations.push(
        'No debug sessions found. Start your application in debug mode.'
      );
    } else if (sessionsByScore.filter((s) => s.willInject).length === 0) {
      recommendations.push(
        'No sessions meet auto-injection criteria. Consider using manual injection.'
      );
      if (sessionsByScore.length > 0) {
        const highestSession = sessionsByScore[0];
        if (highestSession) {
          recommendations.push(
            `Highest scoring session: "${highestSession.name}" (score: ${highestSession.score})`
          );
        }
      }
    } else if (sessionsByScore.filter((s) => s.willInject).length > 1) {
      recommendations.push(
        'Multiple sessions will receive auto-injection. This is normal in monorepo environments.'
      );
    }

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      sessionsByType,
      sessionsByScore,
      recommendations,
    };
  }

  public logSessionInsights(): void {
    const insights = this.getSessionInsights();

    this.logger.info('📊 Session Insights (Monorepo Debug Info)');
    this.logger.info(`  Total Sessions: ${insights.totalSessions}`);
    this.logger.info(`  Active Sessions: ${insights.activeSessions}`);

    if (Object.keys(insights.sessionsByType).length > 0) {
      this.logger.info('  Session Types:');
      Object.entries(insights.sessionsByType).forEach(([type, count]) => {
        this.logger.info(`    ${type}: ${count}`);
      });
    }

    if (insights.sessionsByScore.length > 0) {
      this.logger.info('  Session Scores (Auto-injection threshold: 50):');
      insights.sessionsByScore.forEach((session) => {
        const icon = session.willInject ? '✅' : '❌';
        this.logger.info(`    ${icon} ${session.name}: ${session.score}`);
      });
    }

    if (insights.recommendations.length > 0) {
      this.logger.info('  Recommendations:');
      insights.recommendations.forEach((rec) => {
        this.logger.info(`    • ${rec}`);
      });
    }
  }

  public dispose(): void {
    this._activeSessions.clear();
    this._sessionReferences.clear(); // Clear session references
    this.sessionStartCallbacks.clear();
    this.sessionEndCallbacks.clear();
  }
}
