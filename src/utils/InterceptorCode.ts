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
    
    // Try to pre-load zlib module and make it globally available
    let zlibModule = null;
    try {
        zlibModule = require('zlib');
        global.__NETWORK_INTERCEPTOR_ZLIB__ = zlibModule;
    } catch (zlibError) {
        // Silent failure - zlib not available
    }
    
    // Mark as installed
    global.__NETWORK_INTERCEPTOR_INSTALLED__ = true;
    
    // Store original methods to ensure we get them before any other libraries
    const originalHttpRequest = http.request;
    const originalHttpGet = http.get;
    const originalHttpsRequest = https.request;
    const originalHttpsGet = https.get;
    
    // Maximum response body size (10MB)
    const MAX_BODY_SIZE = 10 * 1024 * 1024;
    
    function generateRequestId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    function safeStringify(obj) {
        try {
            return JSON.stringify(obj, (key, value) => {
                // Handle circular references
                if (typeof value === 'object' && value !== null) {
                    if (value instanceof Buffer) {
                        return '[Buffer data]';
                    }
                    if (value.constructor && value.constructor.name === 'IncomingMessage') {
                        return '[HTTP Response Object]';
                    }
                }
                return value;
            }, 0);
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
    
    function isCompressedData(buffer) {
        if (!buffer || buffer.length < 2) return false;
        
        // Check for gzip magic number (1f 8b)
        if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
            return 'gzip';
        }
        
        // Check for deflate (zlib) magic number - more comprehensive check
        if (buffer[0] === 0x78) {
            // Common deflate headers: 78 01, 78 9c, 78 da, 78 5e, etc.
            const secondByte = buffer[1];
            if (secondByte === 0x01 || secondByte === 0x9c || secondByte === 0xda || 
                secondByte === 0x5e || secondByte === 0x7a || secondByte === 0x5a) {
                return 'deflate';
            }
        }
        
        return false;
    }
    
    function isTextContent(buffer) {
        if (!buffer || buffer.length === 0) return true;
        
        // Check first few bytes for common text patterns
        const start = buffer.slice(0, Math.min(100, buffer.length));
        const str = start.toString('utf8', 0, Math.min(20, start.length));
        
        // Check for JSON patterns
        if (str.trim().startsWith('{') || str.trim().startsWith('[') || str.trim().startsWith('"')) {
            return true;
        }
        
        // Check for XML/HTML patterns
        if (str.includes('<') || str.includes('<?xml')) {
            return true;
        }
        
        // Check for mostly printable ASCII
        let printableCount = 0;
        for (let i = 0; i < Math.min(50, buffer.length); i++) {
            const byte = buffer[i];
            if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
                printableCount++;
            }
        }
        
        return printableCount / Math.min(50, buffer.length) > 0.8;
    }
    
    function decompressResponse(buffer, encoding) {
        if (!buffer || buffer.length === 0) {
            return buffer;
        }
        
        const originalSize = buffer.length;
        const magicBytes = buffer.slice(0, 4);
        const compressionType = isCompressedData(buffer);
        
        // Decompression attempt - no debug logging to avoid polluting terminal
        
        // Try to get zlib module using multiple approaches
        let zlib = null;
        
        // Method 1: Use pre-loaded global zlib
        if (global.__NETWORK_INTERCEPTOR_ZLIB__) {
            zlib = global.__NETWORK_INTERCEPTOR_ZLIB__;
        } else {
            // Method 2: Direct require
            try {
                zlib = require('zlib');
            } catch (e1) {
                // Method 3: Global require
                try {
                    if (typeof global !== 'undefined' && global.require) {
                        zlib = global.require('zlib');
                    }
                } catch (e2) {
                    // Method 4: Process modules
                    try {
                        if (typeof process !== 'undefined' && process.binding) {
                            zlib = process.binding('zlib');
                        }
                    } catch (e3) {
                        // Method 5: Try to find in global modules
                        try {
                            if (typeof __dirname !== 'undefined') {
                                const path = eval('require')('path');
                                const fs = eval('require')('fs');
                                zlib = eval('require')('zlib');
                            }
                        } catch (e4) {
                            // Silent failure - no zlib methods available
                        }
                    }
                }
            }
        }
        
        if (!zlib) {
            // If we can't decompress, at least detect if it's likely compressed
            if (compressionType || (encoding && (encoding.includes('gzip') || encoding.includes('deflate')))) {
                return buffer; // Return as-is, will be handled by caller
            }
            
            return buffer;
        }
        
        try {
            // Try multiple decompression methods
            const methods = [];
            
            // Add methods based on explicit encoding
            if (encoding) {
                if (encoding.includes('gzip')) methods.push('gzip');
                if (encoding.includes('deflate')) methods.push('deflate', 'raw-deflate');
                if (encoding.includes('br')) methods.push('brotli');
            }
            
            // Add methods based on magic number detection
            if (compressionType === 'gzip' && !methods.includes('gzip')) {
                methods.push('gzip');
            }
            if (compressionType === 'deflate' && !methods.includes('deflate')) {
                methods.push('deflate', 'raw-deflate');
            }
            
            // Fallback: try all methods if none detected
            if (methods.length === 0) {
                methods.push('gzip', 'deflate', 'raw-deflate');
            }
            
            // Try each method
            for (const method of methods) {
                try {
                    let decompressed;
                    switch (method) {
                        case 'gzip':
                            decompressed = zlib.gunzipSync(buffer);
                            break;
                        case 'deflate':
                            decompressed = zlib.inflateSync(buffer);
                            break;
                        case 'raw-deflate':
                            decompressed = zlib.inflateRawSync(buffer);
                            break;
                        case 'brotli':
                            if (zlib.brotliDecompressSync) {
                                decompressed = zlib.brotliDecompressSync(buffer);
                            } else {
                                continue; // Skip if brotli not available
                            }
                            break;
                        default:
                            continue;
                    }
                    
                    if (decompressed && decompressed.length > 0) {
                        return decompressed;
                    }
                } catch (error) {
                    // Silent failure - try next method
                }
            }
            
            return buffer;
        } catch (error) {
            return buffer;
        }
    }
    
    function processResponseBody(rawBuffer, headers) {
        if (!rawBuffer || rawBuffer.length === 0) {
            return undefined;
        }
        
        // Check if response is too large
        if (rawBuffer.length > MAX_BODY_SIZE) {
            return \`[Response too large: \${rawBuffer.length} bytes, truncated to \${MAX_BODY_SIZE} bytes]\`;
        }
        
        const contentEncoding = headers['content-encoding'] || headers['Content-Encoding'];
        const contentType = headers['content-type'] || headers['Content-Type'] || '';
        
        // Process response based on content type and encoding
        
        // Try to decompress if needed
        let processedBuffer = rawBuffer;
        let wasDecompressed = false;
        
        if (contentEncoding && (contentEncoding.includes('gzip') || contentEncoding.includes('deflate') || contentEncoding.includes('br'))) {
            const decompressed = decompressResponse(rawBuffer, contentEncoding);
            if (decompressed !== rawBuffer) {
                processedBuffer = decompressed;
                wasDecompressed = true;
            }
        } else {
            // Auto-detect compression even without headers
            const decompressed = decompressResponse(rawBuffer, null);
            if (decompressed !== rawBuffer) {
                processedBuffer = decompressed;
                wasDecompressed = true;
            }
        }
        
        // For JSON content-type, always try to process as text first
        const isJsonContentType = contentType.toLowerCase().includes('application/json') || 
                                  contentType.toLowerCase().includes('text/json');
        
        // Special handling for JSON content-type - try to decode even if it looks binary
        if (isJsonContentType) {
            // Check if data looks compressed but wasn't decompressed
            const compressionType = isCompressedData(processedBuffer);
            if (compressionType && !wasDecompressed) {
                return \`[JSON response appears to be \${compressionType} compressed but decompression failed - zlib module not available in debug context]\`;
            }
            
            // Check if response still looks compressed based on magic bytes
            if (processedBuffer.length > 2) {
                const first2 = processedBuffer.slice(0, 2);
                const isLikelyCompressed = (first2[0] === 0x1f && first2[1] === 0x8b) || // gzip
                                          (first2[0] === 0x78) || // deflate variants
                                          (first2[0] < 0x20 && first2[1] < 0x20); // likely binary
                
                if (isLikelyCompressed && !wasDecompressed) {
                    return \`[JSON response appears to be compressed but decompression failed - enable compression handling in your HTTP client or server]\`;
                }
            }
            
            try {
                // Try to decode as UTF-8 directly
                let bodyString = processedBuffer.toString('utf8');
                
                // Check if the decoded string contains mostly control characters (sign of failed decompression)
                let controlCharCount = 0;
                for (let i = 0; i < Math.min(100, bodyString.length); i++) {
                    const charCode = bodyString.charCodeAt(i);
                    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
                        controlCharCount++;
                    }
                }
                
                if (controlCharCount > bodyString.length * 0.3) {
                    return \`[JSON response contains high proportion of control characters - likely compressed but decompression failed]\`;
                }
                
                // Try to parse as JSON
                try {
                    const parsed = JSON.parse(bodyString);
                    return JSON.stringify(parsed, null, 2);
                } catch (jsonError) {
                    // If JSON parsing fails but we have JSON content-type, 
                    // it might be double-compressed or corrupted
                    if (processedBuffer.length < 1000) {
                        // For small responses, show the raw string for debugging
                        return \`[JSON parsing failed - raw content: \${bodyString.substring(0, 200)}]\`;
                    } else {
                        return \`[JSON parsing failed - response length: \${processedBuffer.length} bytes]\`;
                    }
                }
            } catch (encodingError) {
                return \`[JSON content-type but encoding failed: \${encodingError.message}]\`;
            }
        }
        
        // Check if the processed data is text-like
        if (!isTextContent(processedBuffer)) {
            return \`[Binary data: \${processedBuffer.length} bytes, content-type: \${contentType}]\`;
        }
        
        try {
            // Convert to string
            let bodyString = processedBuffer.toString('utf8');
            
            // Try to parse as JSON if content-type indicates JSON or content looks like JSON
            if (isJsonContentType || 
                bodyString.trim().startsWith('{') || 
                bodyString.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(bodyString);
                    return JSON.stringify(parsed, null, 2);
                } catch (jsonError) {
                    // If JSON parsing fails but content-type says it's JSON, still return as text
                    if (isJsonContentType) {
                        return bodyString;
                    }
                    // For non-JSON content-type, check if it's actually binary
                    if (!isTextContent(processedBuffer)) {
                        return \`[Binary data: \${processedBuffer.length} bytes, content-type: \${contentType}]\`;
                    }
                    return bodyString;
                }
            }
            
            return bodyString;
        } catch (encodingError) {
            // If UTF-8 conversion fails, try latin1
            try {
                return processedBuffer.toString('latin1');
            } catch (latin1Error) {
                return \`[Encoding error: unable to decode response body]\`;
            }
        }
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
            let totalSize = 0;
            let isCapturing = true;
            
            // Override the emit method to capture data before any other listeners
            const originalEmit = res.emit;
            res.emit = function(event, ...args) {
                if (event === 'data' && isCapturing) {
                    try {
                        const chunk = args[0];
                        if (chunk && totalSize < MAX_BODY_SIZE) {
                            chunks.push(Buffer.from(chunk));
                            totalSize += chunk.length;
                        }
                    } catch (error) {
                        console.error('Error capturing response chunk:', error);
                    }
                } else if (event === 'end' && isCapturing) {
                    isCapturing = false;
                    
                    try {
                        const rawBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
                        const processedBody = processResponseBody(rawBuffer, res.headers || {});
                        
                        logNetworkEvent({
                            type: 'response',
                            id: requestId,
                            timestamp: Date.now(),
                            status: res.statusCode,
                            headers: res.headers,
                            body: processedBody
                        });
                    } catch (error) {
                        console.error('Error processing response:', error);
                        logNetworkEvent({
                            type: 'response',
                            id: requestId,
                            timestamp: Date.now(),
                            status: res.statusCode,
                            headers: res.headers,
                            body: '[Error processing response body]'
                        });
                    }
                }
                
                // Always call the original emit
                return originalEmit.apply(this, [event, ...args]);
            };
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
            
            // Create the original request
            const req = originalGet.apply(this, args);
            
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
                return originalGet.apply(this, args);
            }
        };
    }
    
    // Install interceptors
    interceptModule(http, 'http', originalHttpRequest, originalHttpGet);
    interceptModule(https, 'https', originalHttpsRequest, originalHttpsGet);
    
    // Signal successful installation to extension
    console.log('__NETWORK_INTERCEPTOR__{"type":"info","message":"Network interceptor installed successfully"}');
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
