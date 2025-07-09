import * as vscode from 'vscode';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class LoggerService {
  private static instance: LoggerService;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly logLevel: LogLevel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      'Network Interceptor'
    );
    this.logLevel = LogLevel.INFO; // Can be made configurable
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public debug(message: string, data?: unknown): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  public info(message: string, data?: unknown): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log(LogLevel.INFO, message, data);
    }
  }

  public warn(message: string, data?: unknown): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log(LogLevel.WARN, message, data);
    }
  }

  public error(message: string, error?: Error | unknown): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log(LogLevel.ERROR, message, error);
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];

    let logMessage = `[${timestamp}] [${levelStr}] ${message}`;

    if (data) {
      if (data instanceof Error) {
        logMessage += `\n${data.stack ?? data.message}`;
      } else {
        logMessage += `\n${JSON.stringify(data, null, 2)}`;
      }
    }

    this.outputChannel.appendLine(logMessage);
  }

  public show(): void {
    this.outputChannel.show();
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
