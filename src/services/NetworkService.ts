import {
  NetworkRequest,
  NetworkEvent,
  NetworkEventHandler,
  INetworkService,
  ExportOptions,
  RequestFilter,
  NetworkEventData,
} from '../types';
import { ConfigService } from './ConfigService';
import { LoggerService } from './LoggerService';

export class NetworkService implements INetworkService {
  private static instance: NetworkService;
  private readonly _requests: Map<string, NetworkRequest> = new Map();
  private readonly eventHandlers: Set<NetworkEventHandler> = new Set();
  private readonly logger = LoggerService.getInstance();
  private readonly configService = ConfigService.getInstance();
  private _isCapturing = false;

  private constructor() {
    this.configService.onConfigChange((config) => {
      this.enforceMaxRequests(config.maxRequests);
    });
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  public get requests(): readonly NetworkRequest[] {
    return Array.from(this._requests.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public get isCapturing(): boolean {
    return this._isCapturing;
  }

  public startCapture(): void {
    this._isCapturing = true;
    this.logger.info('Network capture started');
  }

  public stopCapture(): void {
    this._isCapturing = false;
    this.logger.info('Network capture stopped');
  }

  public clearRequests(): void {
    this._requests.clear();
    this.logger.info('Network requests cleared');
  }

  public getRequest(id: string): NetworkRequest | undefined {
    return this._requests.get(id);
  }

  public addEventHandler(handler: NetworkEventHandler): void {
    this.eventHandlers.add(handler);
  }

  public removeEventHandler(handler: NetworkEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  public handleNetworkEvent(event: NetworkEvent): void {
    if (!this._isCapturing) {
      return;
    }

    const config = this.configService.getConfig();

    if (event.url && this.configService.shouldFilterUrl(event.url)) {
      this.logger.debug(`Filtered request: ${event.url}`);
      return;
    }

    // Ensure the event has proper data structure for RequestManager compatibility
    const eventWithData = this.ensureEventDataStructure(event);

    switch (eventWithData.type) {
      case 'request':
        this.handleRequestEvent(eventWithData, config.captureBody);
        break;
      case 'response':
        this.handleResponseEvent(eventWithData, config.captureBody);
        break;
      case 'error':
        this.handleErrorEvent(eventWithData);
        break;
    }

    this.enforceMaxRequests(config.maxRequests);
  }

  private ensureEventDataStructure(event: NetworkEvent): NetworkEvent {
    // If event already has data, return as is
    if (event.data) {
      return event;
    }

    // Create data structure from flat event properties
    let data: NetworkEventData;

    switch (event.type) {
      case 'request':
        data = {
          method: event.method!,
          url: event.url!,
          ...(event.headers !== undefined && { headers: event.headers }),
          ...(event.body !== undefined && { body: event.body }),
        };
        break;
      case 'response':
        data = {
          status: event.status!,
          ...(event.headers !== undefined && { headers: event.headers }),
          ...(event.body !== undefined && { body: event.body }),
        };
        break;
      case 'error':
        data = {
          error: event.error!,
        };
        break;
      default:
        throw new Error(`Unknown event type: ${event.type}`);
    }

    return { ...event, data };
  }

  private handleRequestEvent(event: NetworkEvent, captureBody: boolean): void {
    if (!event.method || !event.url) {
      this.logger.warn('Invalid request event', event);
      return;
    }

    const request: NetworkRequest = {
      id: event.id,
      timestamp: new Date(event.timestamp),
      method: event.method,
      url: event.url,
      headers: event.headers ?? {},
      requestBody: captureBody ? event.body : undefined,
    };

    this._requests.set(event.id, request);
    this.logger.info(`🚀 Request: ${event.method} ${event.url}`);

    // Log request details if body is present
    if (captureBody && event.body) {
      this.logger.info(`📤 Request body: ${JSON.stringify(event.body)}`);
    }

    this.eventHandlers.forEach((handler) => {
      try {
        handler.onRequest(request);
      } catch (error) {
        this.logger.error('Error in request handler', error);
      }
    });
  }

  private handleResponseEvent(event: NetworkEvent, captureBody: boolean): void {
    const request = this._requests.get(event.id);
    if (!request) {
      this.logger.warn(`Response event for unknown request: ${event.id}`);
      return;
    }

    const updatedRequest: NetworkRequest = {
      ...request,
      ...(event.status !== undefined && { responseStatus: event.status }),
      ...(event.headers !== undefined && { responseHeaders: event.headers }),
      ...(captureBody &&
        event.body !== undefined && { responseBody: event.body }),
      duration: event.timestamp - request.timestamp.getTime(),
    };

    this._requests.set(event.id, updatedRequest);

    // Enhanced response logging
    const statusEmoji =
      event.status && event.status >= 200 && event.status < 300 ? '✅' : '❌';
    this.logger.info(
      `${statusEmoji} Response: ${event.status} for ${request.method} ${request.url} (${updatedRequest.duration}ms)`
    );

    // Log response headers if present
    if (event.headers && Object.keys(event.headers).length > 0) {
      this.logger.info(
        `📨 Response headers: ${JSON.stringify(event.headers, null, 2)}`
      );
    }

    // Log response body if present and captured
    if (captureBody && event.body) {
      this.logger.info(`📥 Response body: ${JSON.stringify(event.body)}`);
    }

    this.eventHandlers.forEach((handler) => {
      try {
        handler.onResponse(updatedRequest);
      } catch (error) {
        this.logger.error('Error in response handler', error);
      }
    });
  }

  private handleErrorEvent(event: NetworkEvent): void {
    const request = this._requests.get(event.id);
    if (!request) {
      this.logger.warn(`Error event for unknown request: ${event.id}`);
      return;
    }

    const updatedRequest: NetworkRequest = {
      ...request,
      ...(event.error !== undefined && { error: event.error }),
    };

    this._requests.set(event.id, updatedRequest);
    this.logger.error(
      `💥 Error for ${request.method} ${request.url}: ${event.error}`
    );

    this.eventHandlers.forEach((handler) => {
      try {
        handler.onError(updatedRequest);
      } catch (error) {
        this.logger.error('Error in error handler', error);
      }
    });
  }

  private enforceMaxRequests(maxRequests: number): void {
    if (this._requests.size <= maxRequests) {
      return;
    }

    const sortedRequests = Array.from(this._requests.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const toRemove = sortedRequests.slice(0, this._requests.size - maxRequests);
    toRemove.forEach((request) => this._requests.delete(request.id));

    this.logger.info(
      `Removed ${toRemove.length} old requests to enforce limit`
    );
  }

  public filterRequests(filter: RequestFilter): NetworkRequest[] {
    return this.requests.filter((request) => {
      if (filter.method && request.method !== filter.method) {
        return false;
      }
      if (filter.url && !request.url.includes(filter.url)) {
        return false;
      }
      if (filter.status && request.responseStatus !== filter.status) {
        return false;
      }
      if (
        filter.hasError !== undefined &&
        Boolean(request.error) !== filter.hasError
      ) {
        return false;
      }
      return true;
    });
  }

  public async exportRequests(options: ExportOptions): Promise<string> {
    const requests = options.filter
      ? this.filterRequests(options.filter)
      : this.requests;

    switch (options.format) {
      case 'json':
        return this.exportAsJson([...requests], options);
      case 'csv':
        return this.exportAsCsv([...requests], options);
      case 'har':
        return this.exportAsHar([...requests], options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportAsJson(
    requests: NetworkRequest[],
    options: ExportOptions
  ): string {
    const data = requests.map((request) => ({
      id: request.id,
      timestamp: request.timestamp.toISOString(),
      method: request.method,
      url: request.url,
      ...(options.includeHeaders && {
        headers: request.headers,
        responseHeaders: request.responseHeaders,
      }),
      ...(options.includeBodies && {
        requestBody: request.requestBody,
        responseBody: request.responseBody,
      }),
      responseStatus: request.responseStatus,
      duration: request.duration,
      error: request.error,
    }));

    return JSON.stringify(data, null, 2);
  }

  private exportAsCsv(
    requests: NetworkRequest[],
    options: ExportOptions
  ): string {
    const headers = [
      'ID',
      'Timestamp',
      'Method',
      'URL',
      'Status',
      'Duration',
      'Error',
    ];
    if (options.includeHeaders) {
      headers.push('Request Headers', 'Response Headers');
    }
    if (options.includeBodies) {
      headers.push('Request Body', 'Response Body');
    }

    const rows = requests.map((request) => {
      const row = [
        request.id,
        request.timestamp.toISOString(),
        request.method,
        request.url,
        request.responseStatus?.toString() ?? '',
        request.duration?.toString() ?? '',
        request.error ?? '',
      ];

      if (options.includeHeaders) {
        row.push(
          JSON.stringify(request.headers),
          JSON.stringify(request.responseHeaders ?? {})
        );
      }

      if (options.includeBodies) {
        row.push(
          JSON.stringify(request.requestBody ?? ''),
          JSON.stringify(request.responseBody ?? '')
        );
      }

      return row;
    });

    return [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
  }

  private exportAsHar(
    requests: NetworkRequest[],
    options: ExportOptions
  ): string {
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'VS Code Network Interceptor',
          version: '1.0.0',
        },
        entries: requests.map((request) => ({
          startedDateTime: request.timestamp.toISOString(),
          time: request.duration ?? 0,
          request: {
            method: request.method,
            url: request.url,
            httpVersion: 'HTTP/1.1',
            headers: options.includeHeaders
              ? Object.entries(request.headers).map(([name, value]) => ({
                  name,
                  value,
                }))
              : [],
            queryString: [],
            postData:
              options.includeBodies && request.requestBody
                ? {
                    mimeType: 'application/json',
                    text:
                      typeof request.requestBody === 'string'
                        ? request.requestBody
                        : JSON.stringify(request.requestBody),
                  }
                : undefined,
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: request.responseStatus ?? 0,
            statusText: this.getStatusText(request.responseStatus ?? 0),
            httpVersion: 'HTTP/1.1',
            headers:
              options.includeHeaders && request.responseHeaders
                ? Object.entries(request.responseHeaders).map(
                    ([name, value]) => ({ name, value })
                  )
                : [],
            content:
              options.includeBodies && request.responseBody
                ? {
                    size: -1,
                    mimeType: 'application/json',
                    text:
                      typeof request.responseBody === 'string'
                        ? request.responseBody
                        : JSON.stringify(request.responseBody),
                  }
                : { size: 0, mimeType: '', text: '' },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
          },
          cache: {},
          timings: {
            blocked: -1,
            dns: -1,
            connect: -1,
            send: 0,
            wait: request.duration ?? 0,
            receive: 0,
            ssl: -1,
          },
        })),
      },
    };

    return JSON.stringify(har, null, 2);
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return statusTexts[status] ?? 'Unknown';
  }
}
