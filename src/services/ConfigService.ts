import * as vscode from 'vscode';
import { InterceptorConfig } from '../types';

export class ConfigService {
  private static instance: ConfigService;
  private readonly configSection = 'networkInterceptor';
  private _onConfigChange = new vscode.EventEmitter<InterceptorConfig>();
  public readonly onConfigChange = this._onConfigChange.event;

  private constructor() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(this.configSection)) {
        this._onConfigChange.fire(this.getConfig());
      }
    });
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public getConfig(): InterceptorConfig {
    const config = vscode.workspace.getConfiguration(this.configSection);

    return {
      autoCapture: config.get<boolean>('autoCapture', true),
      maxRequests: config.get<number>('maxRequests', 1000),
      captureBody: config.get<boolean>('captureBody', true),
      filterPatterns: config.get<readonly string[]>('filterPatterns', []),
    };
  }

  public async updateConfig(
    key: keyof InterceptorConfig,
    value: unknown
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configSection);
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  public shouldFilterUrl(url: string): boolean {
    const { filterPatterns } = this.getConfig();
    return filterPatterns.some((pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch {
        return url.includes(pattern);
      }
    });
  }

  public dispose(): void {
    this._onConfigChange.dispose();
  }
}
