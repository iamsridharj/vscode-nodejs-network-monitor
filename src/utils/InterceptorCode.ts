export class InterceptorCode {
  public static getInterceptorCode(): string {
    return `
(function() {
    // Check if interceptor is already installed
    if (global.__NETWORK_INTERCEPTOR_INSTALLED__) {
        console.log('__NETWORK_INTERCEPTOR__{"type":"info","message":"Interceptor already installed"}');
        return;
    }

    const http = require('http');
    const https = require('https');
    const { EventEmitter } = require('events');
    
    // Mark as installed
    global.__NETWORK_INTERCEPTOR_INSTALLED__ = true;
    
    // Store original methods to ensure we get them before any other libraries
    const originalHttpRequest = http.request;
    const originalHttpGet = http.get;
    const originalHttpsRequest = https.request;
    const originalHttpsGet = https.get;
    
    function generateRequestId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    function safeStringify(obj) {
        try {
            return JSON.stringify(obj, null, 0);
        } catch (error) {
            return '[Circular or Non-Serializable Object]';
        }
    }
    
    function logNetworkEvent(event) {
        try {
        console.log(\`__NETWORK_INTERCEPTOR__\${safeStringify(event)}\`);
        } catch (error) {
            console.error('Failed to log network event:', error);
        }
    }
    
    function parseUrl(urlOrOptions, options) {
        let url, opts;
        
        try {
        if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
            url = new URL(urlOrOptions);
            opts = options || {};
        } else {
            opts = urlOrOptions;
            const protocol = opts.protocol || 'http:';
            const hostname = opts.hostname || opts.host || 'localhost';
            const port = opts.port || (protocol === 'https:' ? 443 : 80);
            const path = opts.path || '/';
            url = new URL(\`\${protocol}//\${hostname}:\${port}\${path}\`);
            }
        } catch (error) {
            // Fallback for malformed URLs
            opts = urlOrOptions || {};
            const protocol = opts.protocol || 'http:';
            const hostname = opts.hostname || opts.host || 'localhost';
            const port = opts.port || (protocol === 'https:' ? 443 : 80);
            const path = opts.path || '/';
            url = { toString: () => \`\${protocol}//\${hostname}:\${port}\${path}\` };
        }
        
        return { url, opts };
    }
    
    function captureRequestBody(req, requestId, method, url, headers) {
        const chunks = [];
        const originalWrite = req.write;
        const originalEnd = req.end;
        
        req.write = function(chunk, encoding, callback) {
            if (chunk) {
                chunks.push(Buffer.from(chunk));
            }
            return originalWrite.call(this, chunk, encoding, callback);
        };
        
        req.end = function(chunk, encoding, callback) {
            if (chunk) {
                chunks.push(Buffer.from(chunk));
            }
            
            const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
            
            logNetworkEvent({
                type: 'request',
                id: requestId,
                timestamp: Date.now(),
                method: method,
                url: url.toString(),
                headers: headers,
                body: body
            });
            
            return originalEnd.call(this, chunk, encoding, callback);
        };
    }
    
    function captureResponse(req, requestId) {
        req.on('response', (res) => {
            const chunks = [];
            const originalOn = res.on;
            
            res.on = function(event, listener) {
                if (event === 'data') {
                    const originalListener = listener;
                    const wrappedListener = function(chunk) {
                        chunks.push(Buffer.from(chunk));
                        return originalListener.call(this, chunk);
                    };
                    return originalOn.call(this, event, wrappedListener);
                }
                return originalOn.call(this, event, listener);
            };
            
            res.on('end', () => {
                const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
                
                logNetworkEvent({
                    type: 'response',
                    id: requestId,
                    timestamp: Date.now(),
                    status: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            logNetworkEvent({
                type: 'error',
                id: requestId,
                timestamp: Date.now(),
                error: error.message,
                stack: error.stack
            });
        });
    }
    
    function interceptModule(module, moduleName, originalRequest, originalGet) {
        module.request = function(...args) {
            const requestId = generateRequestId();
            
            try {
            const { url, opts } = parseUrl(args[0], args[1]);
            const method = (opts.method || 'GET').toUpperCase();
            const headers = opts.headers || {};
            
            // Create the original request
            const req = originalRequest.apply(this, args);
            
                // Log immediately for GET requests, capture body for others
                if (method === 'GET' || method === 'HEAD') {
                logNetworkEvent({
                    type: 'request',
                    id: requestId,
                    timestamp: Date.now(),
                    method: method,
                    url: url.toString(),
                    headers: headers
                });
                } else {
                    // Capture request body for non-GET requests
                    captureRequestBody(req, requestId, method, url, headers);
            }
            
            // Capture response
            captureResponse(req, requestId);
            
            return req;
            } catch (error) {
                logNetworkEvent({
                    type: 'error',
                    id: requestId,
                    timestamp: Date.now(),
                    error: \`Interceptor error: \${error.message}\`,
                    stack: error.stack
                });
                
                // Fall back to original request
                return originalRequest.apply(this, args);
            }
        };
        
        module.get = function(...args) {
            const requestId = generateRequestId();
            
            try {
            const { url, opts } = parseUrl(args[0], args[1]);
            const headers = opts.headers || {};
            
            logNetworkEvent({
                type: 'request',
                id: requestId,
                timestamp: Date.now(),
                method: 'GET',
                url: url.toString(),
                headers: headers
            });
            
            const req = originalGet.apply(this, args);
            captureResponse(req, requestId);
            
            return req;
            } catch (error) {
                logNetworkEvent({
                    type: 'error',
                    id: requestId,
                    timestamp: Date.now(),
                    error: \`Interceptor error: \${error.message}\`,
                    stack: error.stack
                });
                
                // Fall back to original get
                return originalGet.apply(this, args);
            }
        };
    }
    
    // Intercept both http and https modules with saved original methods
    try {
        interceptModule(http, 'http', originalHttpRequest, originalHttpGet);
        interceptModule(https, 'https', originalHttpsRequest, originalHttpsGet);
        
        logNetworkEvent({
            type: 'info',
            message: 'Network interceptor successfully installed',
            timestamp: Date.now(),
            modules: ['http', 'https']
        });
        
        console.log('✅ Network interceptor installed successfully');
        
        // Add test function
        global.__NETWORK_INTERCEPTOR_TEST__ = function() {
            logNetworkEvent({
                type: 'info',
                message: 'Test event from interceptor',
                timestamp: Date.now()
            });
        };
        
    } catch (error) {
        logNetworkEvent({
            type: 'error',
            message: 'Failed to install network interceptor',
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
        
        console.error('❌ Failed to install network interceptor:', error);
    }
})();
`;
  }

  public static getAdvancedInterceptorCode(): string {
    return `
(function() {
    // Enhanced interceptor with fetch support and better error handling
    if (global.__NETWORK_INTERCEPTOR_INSTALLED__) {
        return;
    }
    
    const http = require('http');
    const https = require('https');
    
    global.__NETWORK_INTERCEPTOR_INSTALLED__ = true;
    global.__NETWORK_INTERCEPTOR_CONFIG__ = {
        captureBody: true,
        maxBodySize: 1024 * 1024, // 1MB
        captureHeaders: true,
        enabled: true
    };
    
    function generateRequestId() {
        return \`req_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    }
    
    function safeStringify(obj, maxLength = 10000) {
        try {
            const str = JSON.stringify(obj, null, 0);
            return str.length > maxLength ? str.substring(0, maxLength) + '...[truncated]' : str;
        } catch (error) {
            return '[Non-Serializable Object]';
        }
    }
    
    function shouldCaptureBody(body) {
        const config = global.__NETWORK_INTERCEPTOR_CONFIG__;
        if (!config.captureBody) return false;
        
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        return bodyStr.length <= config.maxBodySize;
    }
    
    function logNetworkEvent(event) {
        if (!global.__NETWORK_INTERCEPTOR_CONFIG__.enabled) return;
        
        try {
            console.log(\`__NETWORK_INTERCEPTOR__\${safeStringify(event)}\`);
        } catch (error) {
            console.error('Failed to log network event:', error.message);
        }
    }
    
    // Enhanced module interception with better error handling
    function interceptModule(module, moduleName) {
        const originalRequest = module.request;
        const originalGet = module.get;
        
        module.request = function(...args) {
            if (!global.__NETWORK_INTERCEPTOR_CONFIG__.enabled) {
                return originalRequest.apply(this, args);
            }
            
            try {
                const requestId = generateRequestId();
                const { url, opts } = parseUrl(args[0], args[1]);
                const method = (opts.method || 'GET').toUpperCase();
                const headers = global.__NETWORK_INTERCEPTOR_CONFIG__.captureHeaders ? (opts.headers || {}) : {};
                
                const req = originalRequest.apply(this, args);
                
                // Enhanced request/response capturing
                enhancedCapture(req, requestId, method, url, headers);
                
                return req;
            } catch (error) {
                logNetworkEvent({
                    type: 'error',
                    message: 'Interceptor error in request',
                    error: error.message,
                    timestamp: Date.now()
                });
                return originalRequest.apply(this, args);
            }
        };
        
        module.get = function(...args) {
            if (!global.__NETWORK_INTERCEPTOR_CONFIG__.enabled) {
                return originalGet.apply(this, args);
            }
            
            try {
                const requestId = generateRequestId();
                const { url, opts } = parseUrl(args[0], args[1]);
                const headers = global.__NETWORK_INTERCEPTOR_CONFIG__.captureHeaders ? (opts.headers || {}) : {};
                
                logNetworkEvent({
                    type: 'request',
                    id: requestId,
                    timestamp: Date.now(),
                    method: 'GET',
                    url: url.toString(),
                    headers: headers
                });
                
                const req = originalGet.apply(this, args);
                enhancedResponseCapture(req, requestId);
                
                return req;
            } catch (error) {
                logNetworkEvent({
                    type: 'error',
                    message: 'Interceptor error in get',
                    error: error.message,
                    timestamp: Date.now()
                });
                return originalGet.apply(this, args);
            }
        };
    }
    
    function parseUrl(urlOrOptions, options) {
        let url, opts;
        
        if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
            url = new URL(urlOrOptions);
            opts = options || {};
        } else {
            opts = urlOrOptions;
            const protocol = opts.protocol || 'http:';
            const hostname = opts.hostname || opts.host || 'localhost';
            const port = opts.port || (protocol === 'https:' ? 443 : 80);
            const path = opts.path || '/';
            url = new URL(\`\${protocol}//\${hostname}:\${port}\${path}\`);
        }
        
        return { url, opts };
    }
    
    function enhancedCapture(req, requestId, method, url, headers) {
        const chunks = [];
        const startTime = Date.now();
        
        const originalWrite = req.write;
        const originalEnd = req.end;
        
        req.write = function(chunk, encoding, callback) {
            if (chunk && shouldCaptureBody(chunk)) {
                chunks.push(Buffer.from(chunk));
            }
            return originalWrite.call(this, chunk, encoding, callback);
        };
        
        req.end = function(chunk, encoding, callback) {
            if (chunk && shouldCaptureBody(chunk)) {
                chunks.push(Buffer.from(chunk));
            }
            
            const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
            
            logNetworkEvent({
                type: 'request',
                id: requestId,
                timestamp: startTime,
                method: method,
                url: url.toString(),
                headers: headers,
                body: body
            });
            
            return originalEnd.call(this, chunk, encoding, callback);
        };
        
        enhancedResponseCapture(req, requestId);
    }
    
    function enhancedResponseCapture(req, requestId) {
        req.on('response', (res) => {
            const responseChunks = [];
            const originalOn = res.on;
            
            res.on = function(event, listener) {
                if (event === 'data') {
                    const originalListener = listener;
                    const wrappedListener = function(chunk) {
                        if (shouldCaptureBody(chunk)) {
                            responseChunks.push(Buffer.from(chunk));
                        }
                        return originalListener.call(this, chunk);
                    };
                    return originalOn.call(this, event, wrappedListener);
                }
                return originalOn.call(this, event, listener);
            };
            
            res.on('end', () => {
                const body = responseChunks.length > 0 ? Buffer.concat(responseChunks).toString('utf8') : undefined;
                
                logNetworkEvent({
                    type: 'response',
                    id: requestId,
                    timestamp: Date.now(),
                    status: res.statusCode,
                    headers: global.__NETWORK_INTERCEPTOR_CONFIG__.captureHeaders ? res.headers : {},
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            logNetworkEvent({
                type: 'error',
                id: requestId,
                timestamp: Date.now(),
                error: error.message,
                stack: error.stack
            });
        });
        
        req.on('timeout', () => {
            logNetworkEvent({
                type: 'error',
                id: requestId,
                timestamp: Date.now(),
                error: 'Request timeout'
            });
        });
    }
    
    // Install interceptors
    try {
        interceptModule(http, 'http');
        interceptModule(https, 'https');
        
        // Add control functions
        global.__NETWORK_INTERCEPTOR_ENABLE__ = () => {
            global.__NETWORK_INTERCEPTOR_CONFIG__.enabled = true;
            console.log('✅ Network interceptor enabled');
        };
        
        global.__NETWORK_INTERCEPTOR_DISABLE__ = () => {
            global.__NETWORK_INTERCEPTOR_CONFIG__.enabled = false;
            console.log('⏸️ Network interceptor disabled');
        };
        
        global.__NETWORK_INTERCEPTOR_CONFIG_SET__ = (config) => {
            Object.assign(global.__NETWORK_INTERCEPTOR_CONFIG__, config);
            console.log('⚙️ Network interceptor config updated', global.__NETWORK_INTERCEPTOR_CONFIG__);
        };
        
        logNetworkEvent({
            type: 'info',
            message: 'Enhanced network interceptor installed',
            timestamp: Date.now(),
            config: global.__NETWORK_INTERCEPTOR_CONFIG__
        });
        
        console.log('✅ Enhanced network interceptor installed successfully');
        
    } catch (error) {
        logNetworkEvent({
            type: 'error',
            message: 'Failed to install enhanced network interceptor',
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
        
        console.error('❌ Failed to install enhanced network interceptor:', error.message);
    }
})();
        `.trim();
  }
}
