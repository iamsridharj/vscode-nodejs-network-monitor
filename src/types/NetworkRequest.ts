export interface NetworkRequest {
  readonly id: string;
  readonly timestamp: Date;
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: Record<string, string>;
  requestBody?: unknown;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  duration?: number;
  error?: string;
}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS';

export interface NetworkEvent {
  type: 'request' | 'response' | 'error';
  id: string;
  timestamp: number;
  data: NetworkEventData;
}

export interface RequestEventData {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ResponseEventData {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ErrorEventData {
  error: string;
}

export type NetworkEventData =
  | RequestEventData
  | ResponseEventData
  | ErrorEventData;
