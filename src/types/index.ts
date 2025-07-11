export interface NetworkRequest {
  readonly id: string;
  readonly timestamp: Date;
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly requestBody?: unknown;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  duration?: number;
  error?: string;
  readonly sessionId?: string;
}

export interface NetworkEvent {
  readonly type: 'request' | 'response' | 'error';
  readonly id: string;
  readonly timestamp: number;
  readonly method?: string;
  readonly url?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly status?: number;
  readonly error?: string;
  readonly data?: NetworkEventData;
}

export interface RequestEventData {
  readonly method: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

export interface ResponseEventData {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

export interface ErrorEventData {
  readonly error: string;
}

export type NetworkEventData =
  | RequestEventData
  | ResponseEventData
  | ErrorEventData;

export interface InterceptorConfig {
  readonly autoCapture: boolean;
  readonly maxRequests: number;
  readonly captureBody: boolean;
  readonly filterPatterns: readonly string[];
}

export interface WebviewMessage {
  readonly type:
    | 'updateRequests'
    | 'clear'
    | 'export'
    | 'filter'
    | 'startRecording'
    | 'stopRecording'
    | 'recordingState';
  readonly data?: unknown;
  readonly isRecording?: boolean;
}

export interface RequestFilter {
  readonly method?: string;
  readonly url?: string;
  readonly status?: number;
  readonly hasError?: boolean;
}

export interface ExportOptions {
  readonly format: 'json' | 'csv' | 'har';
  readonly includeHeaders: boolean;
  readonly includeBodies: boolean;
  readonly filter?: RequestFilter;
}

export interface SessionInfo {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly startTime: Date;
  readonly isActive: boolean;
}

// Events
export interface NetworkEventHandler {
  onRequest(request: NetworkRequest): void;
  onResponse(request: NetworkRequest): void;
  onError(request: NetworkRequest): void;
}

// Service interfaces
export interface INetworkService {
  readonly requests: readonly NetworkRequest[];
  readonly isCapturing: boolean;

  startCapture(): void;
  stopCapture(): void;
  clearRequests(): void;
  getRequest(id: string): NetworkRequest | undefined;
  addEventHandler(handler: NetworkEventHandler): void;
  removeEventHandler(handler: NetworkEventHandler): void;
  exportRequests(options: ExportOptions): Promise<string>;
}

export interface IDebugService {
  readonly activeSessions: readonly SessionInfo[];

  injectInterceptor(sessionId: string): Promise<void>;
  isSessionSupported(sessionType: string): boolean;
  onSessionStart(callback: (session: SessionInfo) => void): void;
  onSessionEnd(callback: (sessionId: string) => void): void;
}

export interface IWebviewService {
  readonly isVisible: boolean;

  show(): void;
  hide(): void;
  postMessage(message: WebviewMessage): void;
  onMessage(callback: (message: WebviewMessage) => void): void;
}

// Error types
export class NetworkInterceptorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NetworkInterceptorError';
  }
}

export class DebugSessionError extends NetworkInterceptorError {
  constructor(message: string, cause?: Error) {
    super(message, 'DEBUG_SESSION_ERROR', cause);
  }
}

export class InterceptorInjectionError extends NetworkInterceptorError {
  constructor(message: string, cause?: Error) {
    super(message, 'INTERCEPTOR_INJECTION_ERROR', cause);
  }
}
