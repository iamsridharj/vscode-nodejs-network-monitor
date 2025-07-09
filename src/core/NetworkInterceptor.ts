import * as vscode from 'vscode';
import { NetworkEvent } from '../types';

export class NetworkInterceptor {
  private static readonly INTERCEPTOR_MARKER = '__NETWORK_INTERCEPTOR__';

  public static async injectIntoSession(
    session: vscode.DebugSession
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const interceptorCode = NetworkInterceptor.generateInterceptorCode();

    try {
      await session.customRequest('evaluate', {
        expression: interceptorCode,
        context: 'repl',
      });
    } catch (error) {
      console.error('Failed to inject network interceptor:', error);
      throw error;
    }
  }

  private static generateInterceptorCode(): string {
    return `
(function() {
  try {
    const http = require('http');
    const https = require('https');
    
    function interceptModule(module, protocol) {
      const originalRequest = module.request;
      
      module.request = function(...args) {
        const requestId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const startTime = Date.now();
        
        try {
          const { options, callback } = parseRequestArgs(args, protocol);
          const url = buildUrl(options, protocol);
          
          logNetworkEvent({
            type: 'request',
            id: requestId,
            timestamp: startTime,
            data: {
              method: options.method || 'GET',
              url: url,
              headers: options.headers || {}
            }
          });
          
          const req = originalRequest.apply(this, args);
          
          interceptRequestBody(req, requestId, startTime, options, url);
          interceptResponse(req, requestId);
          interceptError(req, requestId);
          
          return req;
        } catch (error) {
          console.error('Error in network interceptor:', error);
          return originalRequest.apply(this, args);
        }
      };
    }
    
    function parseRequestArgs(args, protocol) {
      let options = {};
      let callback;
      
      if (typeof args[0] === 'string' || args[0] instanceof URL) {
        const url = new URL(args[0]);
        options = {
          hostname: url.hostname,
          port: url.port || (protocol === 'https' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'GET'
        };
        callback = args[1];
      } else if (typeof args[0] === 'object') {
        options = args[0];
        callback = args[1];
      }
      
      return { options, callback };
    }
    
    function buildUrl(options, protocol) {
      const hostname = options.hostname || options.host || 'localhost';
      const port = options.port || (protocol === 'https' ? 443 : 80);
      const path = options.path || '/';
      return \`\${protocol}://\${hostname}:\${port}\${path}\`;
    }
    
    function interceptRequestBody(req, requestId, startTime, options, url) {
      const originalWrite = req.write;
      const originalEnd = req.end;
      let requestBody = '';
      
      req.write = function(chunk, ...args) {
        if (chunk) {
          requestBody += chunk.toString();
        }
        return originalWrite.apply(this, [chunk, ...args]);
      };
      
      req.end = function(chunk, ...args) {
        if (chunk) {
          requestBody += chunk.toString();
        }
        
        if (requestBody) {
          logNetworkEvent({
            type: 'request',
            id: requestId,
            timestamp: startTime,
            data: {
              method: options.method || 'GET',
              url: url,
              headers: options.headers || {},
              body: requestBody
            }
          });
        }
        
        return originalEnd.apply(this, [chunk, ...args]);
      };
    }
    
    function interceptResponse(req, requestId) {
      req.on('response', (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        
        res.on('end', () => {
          logNetworkEvent({
            type: 'response',
            id: requestId,
            timestamp: Date.now(),
            data: {
              status: res.statusCode,
              headers: res.headers || {},
              body: responseBody
            }
          });
        });
      });
    }
    
    function interceptError(req, requestId) {
      req.on('error', (error) => {
        logNetworkEvent({
          type: 'error',
          id: requestId,
          timestamp: Date.now(),
          data: {
            error: error.message
          }
        });
      });
    }
    
    function logNetworkEvent(event) {
      try {
        console.log('${NetworkInterceptor.INTERCEPTOR_MARKER}' + JSON.stringify(event));
      } catch (error) {
        console.error('Failed to log network event:', error);
      }
    }
    
    interceptModule(http, 'http');
    interceptModule(https, 'https');
    
    console.log('Network interceptor installed successfully');
  } catch (error) {
    console.error('Failed to install network interceptor:', error);
  }
})();
`;
  }

  public static isInterceptorOutput(output: string): boolean {
    return output.includes(NetworkInterceptor.INTERCEPTOR_MARKER);
  }

  public static parseInterceptorOutput(output: string): NetworkEvent | null {
    const markerIndex = output.indexOf(NetworkInterceptor.INTERCEPTOR_MARKER);
    if (markerIndex === -1) return null;

    const jsonString = output.substring(
      markerIndex + NetworkInterceptor.INTERCEPTOR_MARKER.length
    );

    try {
      const parsed = JSON.parse(jsonString);

      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.type &&
        parsed.id &&
        parsed.timestamp &&
        parsed.data
      ) {
        return parsed as NetworkEvent;
      }

      console.warn(
        'Parsed data does not match NetworkEvent structure:',
        parsed
      );
      return null;
    } catch (error) {
      console.error(
        'Failed to parse interceptor output:',
        error,
        'JSON:',
        jsonString
      );
      return null;
    }
  }
}
