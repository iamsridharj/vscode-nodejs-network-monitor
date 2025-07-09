import {
  NetworkRequest,
  NetworkEvent,
  NetworkEventData,
  RequestEventData,
  ResponseEventData,
  ErrorEventData,
} from '../types';
import { EventEmitter } from 'events';

export class RequestManager extends EventEmitter {
  private requests: Map<string, NetworkRequest> = new Map();
  private readonly maxHistory: number;

  constructor(maxHistory: number = 1000) {
    super();
    this.maxHistory = maxHistory;
  }

  public handleNetworkEvent(event: NetworkEvent): void {
    try {
      if (!event.data) {
        console.warn('Network event missing data property:', event);
        return;
      }

      switch (event.type) {
        case 'request':
          this.handleRequest(event.id, event.timestamp, event.data);
          break;
        case 'response':
          this.handleResponse(event.id, event.timestamp, event.data);
          break;
        case 'error':
          this.handleError(event.id, event.timestamp, event.data);
          break;
        default:
          console.warn('Unknown network event type:', (event as any).type);
      }
    } catch (error) {
      console.error('Error handling network event:', error, event);
    }
  }

  private handleRequest(
    id: string,
    timestamp: number,
    data: NetworkEventData
  ): void {
    if (!this.isRequestEventData(data)) {
      console.warn('Invalid request event data:', data);
      return;
    }

    const request: NetworkRequest = {
      id,
      timestamp: new Date(timestamp),
      method: data.method,
      url: data.url,
      headers: data.headers || {},
      requestBody: data.body,
    };

    this.requests.set(id, request);
    this.enforceHistoryLimit();
    this.emit('requestAdded', request);
  }

  private handleResponse(
    id: string,
    timestamp: number,
    data: NetworkEventData
  ): void {
    const request = this.requests.get(id);
    if (!request) {
      console.warn('Received response for unknown request:', id);
      return;
    }

    if (!this.isResponseEventData(data)) {
      console.warn('Invalid response event data:', data);
      return;
    }

    const updatedRequest: NetworkRequest = {
      ...request,
      responseStatus: data.status,
      responseHeaders: data.headers || {},
      responseBody: data.body,
      duration: timestamp - request.timestamp.getTime(),
    };

    this.requests.set(id, updatedRequest);
    this.emit('requestUpdated', updatedRequest);
  }

  private handleError(
    id: string,
    timestamp: number,
    data: NetworkEventData
  ): void {
    const request = this.requests.get(id);
    if (!request) {
      console.warn('Received error for unknown request:', id);
      return;
    }

    if (!this.isErrorEventData(data)) {
      console.warn('Invalid error event data:', data);
      return;
    }

    const updatedRequest: NetworkRequest = {
      ...request,
      error: data.error,
    };

    this.requests.set(id, updatedRequest);
    this.emit('requestUpdated', updatedRequest);
  }

  private isRequestEventData(data: NetworkEventData): data is RequestEventData {
    const requestData = data as RequestEventData;
    return (
      requestData &&
      typeof requestData.method === 'string' &&
      typeof requestData.url === 'string' &&
      (requestData.headers === undefined ||
        typeof requestData.headers === 'object')
    );
  }

  private isResponseEventData(
    data: NetworkEventData
  ): data is ResponseEventData {
    const responseData = data as ResponseEventData;
    return (
      responseData &&
      typeof responseData.status === 'number' &&
      (responseData.headers === undefined ||
        typeof responseData.headers === 'object')
    );
  }

  private isErrorEventData(data: NetworkEventData): data is ErrorEventData {
    const errorData = data as ErrorEventData;
    return errorData && typeof errorData.error === 'string';
  }

  public getAllRequests(): NetworkRequest[] {
    return Array.from(this.requests.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  public clearRequests(): void {
    this.requests.clear();
    this.emit('requestsCleared');
  }

  private enforceHistoryLimit(): void {
    if (this.requests.size > this.maxHistory) {
      const oldestIds = Array.from(this.requests.keys()).slice(
        0,
        this.requests.size - this.maxHistory
      );

      oldestIds.forEach((id) => this.requests.delete(id));
    }
  }

  public dispose(): void {
    this.requests.clear();
    this.removeAllListeners();
  }
}
