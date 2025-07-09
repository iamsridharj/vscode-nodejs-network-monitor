import * as vscode from 'vscode';
import { IWebviewService, WebviewMessage, NetworkRequest } from '../types';
import { LoggerService } from '../services/LoggerService';

export class WebviewService implements IWebviewService {
  private static instance: WebviewService;
  private webviewPanel: vscode.WebviewPanel | undefined;
  private readonly logger = LoggerService.getInstance();
  private readonly messageCallbacks: Set<(message: WebviewMessage) => void> =
    new Set();
  private extensionUri: vscode.Uri | undefined;

  private constructor() {}

  public static getInstance(): WebviewService {
    if (!WebviewService.instance) {
      WebviewService.instance = new WebviewService();
    }
    return WebviewService.instance;
  }

  public setExtensionUri(uri: vscode.Uri): void {
    this.extensionUri = uri;
  }

  public get isVisible(): boolean {
    return this.webviewPanel?.visible ?? false;
  }

  public show(): void {
    if (this.webviewPanel) {
      this.webviewPanel.reveal(vscode.ViewColumn.Two);
      return;
    }

    this.createWebviewPanel();
  }

  public hide(): void {
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
  }

  public postMessage(message: WebviewMessage): void {
    if (!this.webviewPanel) {
      this.logger.warn('Attempted to post message to non-existent webview');
      return;
    }

    this.webviewPanel.webview.postMessage(message).then(
      () => this.logger.debug('Message posted to webview', message),
      (error) => this.logger.error('Failed to post message to webview', error)
    );
  }

  public onMessage(callback: (message: WebviewMessage) => void): void {
    this.messageCallbacks.add(callback);
  }

  public updateRequests(requests: readonly NetworkRequest[]): void {
    this.postMessage({
      type: 'updateRequests',
      data: requests,
    });
  }

  private createWebviewPanel(): void {
    this.webviewPanel = vscode.window.createWebviewPanel(
      'networkInterceptor',
      'Network Requests',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: this.extensionUri ? [this.extensionUri] : [],
      }
    );

    this.setupWebviewContent();
    this.setupWebviewEventHandlers();
  }

  private setupWebviewContent(): void {
    if (!this.webviewPanel) {
      return;
    }

    this.webviewPanel.webview.html = this.getHtmlContent(
      this.webviewPanel.webview
    );
  }

  private setupWebviewEventHandlers(): void {
    if (!this.webviewPanel) {
      return;
    }

    // Handle disposal
    this.webviewPanel.onDidDispose(() => {
      this.webviewPanel = undefined;
      this.logger.info('Webview panel disposed');
    });

    // Handle visibility changes
    this.webviewPanel.onDidChangeViewState((event) => {
      this.logger.debug(
        `Webview visibility changed: ${event.webviewPanel.visible}`
      );
    });

    // Handle messages from webview
    this.webviewPanel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        this.logger.debug('Received message from webview', message);

        // Notify all registered callbacks
        this.messageCallbacks.forEach((callback) => callback(message));
      },
      undefined,
      []
    );
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Network Interceptor</title>
    <style>
        :root {
            --bg-color: var(--vscode-editor-background);
            --text-color: var(--vscode-editor-foreground);
            --border-color: var(--vscode-panel-border);
            --hover-bg: var(--vscode-list-hoverBackground);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --button-hover-bg: var(--vscode-button-hoverBackground);
            --error-color: var(--vscode-editorError-foreground);
            --warning-color: var(--vscode-editorWarning-foreground);
            --success-color: var(--vscode-terminal-ansiGreen);
            --link-color: var(--vscode-textLink-foreground);
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-color);
            background: var(--bg-color);
        }

        .toolbar {
            display: flex;
            gap: 10px;
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
            align-items: center;
        }

        .spacer {
            flex-grow: 1;
        }

        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-primary {
            background: var(--button-bg);
            color: var(--button-fg);
        }

        .btn-primary:hover:not(:disabled) {
            background: var(--button-hover-bg);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover:not(:disabled) {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-sm {
            padding: 4px 8px;
            font-size: 11px;
        }

        .counter {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }

        .filters {
            display: flex;
            gap: 10px;
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
        }

        .filter-input, .filter-select {
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 12px;
        }

        .filter-input {
            flex-grow: 1;
            min-width: 200px;
        }

        .table-container {
            flex-grow: 1;
            overflow: auto;
            height: calc(100vh - 120px);
        }

        .requests-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        .requests-table th {
            background: var(--vscode-editor-background);
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .requests-table td {
            padding: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .requests-table tr:hover {
            background: var(--hover-bg);
            cursor: pointer;
        }

        .method {
            font-weight: bold;
            text-transform: uppercase;
        }

        .method-GET { color: var(--success-color); }
        .method-POST { color: var(--link-color); }
        .method-PUT { color: var(--warning-color); }
        .method-DELETE { color: var(--error-color); }
        .method-PATCH { color: var(--vscode-terminal-ansiCyan); }

        .status {
            font-weight: bold;
        }

        .status-2xx { color: var(--success-color); }
        .status-3xx { color: var(--link-color); }
        .status-4xx { color: var(--warning-color); }
        .status-5xx { color: var(--error-color); }

        .empty-state {
            display: none;
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state.visible {
            display: block;
        }

        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        }

        .modal-overlay.visible {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: var(--vscode-editor-background);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid var(--border-color);
        }

        .modal-header h2 {
            margin: 0;
            font-size: 18px;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-close:hover {
            color: var(--text-color);
        }

        .modal-body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }

        .detail-section {
            margin-bottom: 20px;
        }

        .detail-section h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: var(--vscode-textLink-foreground);
        }

        .detail-content {
            background: var(--vscode-editor-background);
            padding: 10px;
            border-radius: 3px;
        }

        .info-row {
            display: flex;
            padding: 4px 0;
        }

        .info-label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
            min-width: 100px;
        }

        .info-value {
            color: var(--text-color);
            word-break: break-all;
            flex: 1;
        }

        .json-controls {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }

        .code-block {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--border-color);
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .error-message {
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid var(--error-color);
            color: var(--error-color);
            padding: 10px;
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
        }

        .success-feedback {
            color: var(--success-color);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button id="clear-btn" class="btn btn-primary">Clear</button>
        <button id="export-btn" class="btn btn-secondary">Export</button>
        <button id="auto-scroll-btn" class="btn btn-secondary">Auto Scroll: On</button>
        <div class="spacer"></div>
        <div id="request-count" class="counter">0 requests</div>
    </div>

    <div class="filters">
        <input type="text" id="url-filter" class="filter-input" placeholder="Filter by URL...">
        <select id="method-filter" class="filter-select">
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
        </select>
        <select id="status-filter" class="filter-select">
            <option value="">All Status</option>
            <option value="2xx">2xx Success</option>
            <option value="3xx">3xx Redirect</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
        </select>
    </div>

    <div class="table-container">
        <table class="requests-table">
            <thead>
                <tr>
                    <th>Method</th>
                    <th>URL</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody id="requests-tbody">
            </tbody>
        </table>
    </div>

    <div id="empty-state" class="empty-state">
        <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
        <h3>No network requests captured yet</h3>
        <p>Run your Node.js application to see network requests here.</p>
    </div>

    <!-- Modal -->
    <div id="modal-overlay" class="modal-overlay">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2 id="modal-title">Request Details</h2>
                <button id="modal-close-btn" class="modal-close">&times;</button>
            </div>
            <div id="modal-body" class="modal-body"></div>
        </div>
    </div>

    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();
            
            let requests = [];
            let filteredRequests = [];
            let autoScroll = true;

            // DOM Elements
            const elements = {
                clearBtn: document.getElementById('clear-btn'),
                exportBtn: document.getElementById('export-btn'),
                autoScrollBtn: document.getElementById('auto-scroll-btn'),
                modalCloseBtn: document.getElementById('modal-close-btn'),
                modalOverlay: document.getElementById('modal-overlay'),
                urlFilter: document.getElementById('url-filter'),
                methodFilter: document.getElementById('method-filter'),
                statusFilter: document.getElementById('status-filter'),
                requestsTbody: document.getElementById('requests-tbody'),
                emptyState: document.getElementById('empty-state'),
                requestsTable: document.querySelector('.requests-table'),
                requestCount: document.getElementById('request-count'),
                modalTitle: document.getElementById('modal-title'),
                modalBody: document.getElementById('modal-body')
            };

            // Initialize UI
            function initializeUI() {
                // Add event listeners with null checks
                if (elements.clearBtn) {
                    elements.clearBtn.addEventListener('click', clearRequests);
                }
                
                if (elements.exportBtn) {
                    elements.exportBtn.addEventListener('click', exportRequests);
                }
                
                if (elements.autoScrollBtn) {
                    elements.autoScrollBtn.addEventListener('click', toggleAutoScroll);
                }
                
                if (elements.modalCloseBtn) {
                    elements.modalCloseBtn.addEventListener('click', closeModal);
                }
                
                if (elements.modalOverlay) {
                    elements.modalOverlay.addEventListener('click', function(e) {
                        if (e.target === elements.modalOverlay) {
                            closeModal();
                        }
                    });
                }
                
                // Filter event listeners
                if (elements.urlFilter) {
                    elements.urlFilter.addEventListener('input', applyFilters);
                }
                
                if (elements.methodFilter) {
                    elements.methodFilter.addEventListener('change', applyFilters);
                }
                
                if (elements.statusFilter) {
                    elements.statusFilter.addEventListener('change', applyFilters);
                }
                
                // Keyboard shortcuts
                document.addEventListener('keydown', function(event) {
                    if (event.key === 'Escape') {
                        closeModal();
                    }
                });
                
                // Message handling
                window.addEventListener('message', handleMessage);
            }

            // Event handlers
            function clearRequests() {
                vscode.postMessage({ type: 'clear' });
                requests = [];
                filteredRequests = [];
                updateUI();
            }

            function exportRequests() {
                if (requests.length === 0) {
                    vscode.postMessage({ 
                        type: 'info',
                        message: 'No requests to export'
                    });
                    return;
                }
                vscode.postMessage({ type: 'export' });
            }

            function toggleAutoScroll() {
                autoScroll = !autoScroll;
                if (elements.autoScrollBtn) {
                    elements.autoScrollBtn.textContent = 'Auto Scroll: ' + (autoScroll ? 'On' : 'Off');
                }
            }

            function showRequestDetails(index) {
                const request = filteredRequests[index];
                if (!request) return;
                
                if (elements.modalTitle) {
                    elements.modalTitle.textContent = request.method + ' ' + new URL(request.url).pathname;
                }
                
                if (elements.modalBody) {
                    elements.modalBody.innerHTML = generateRequestDetailsHTML(request, index);
                }
                
                if (elements.modalOverlay) {
                    elements.modalOverlay.classList.add('visible');
                }
                
                // Add event listeners to copy/format buttons
                setupModalButtonListeners();
            }

            function closeModal() {
                if (elements.modalOverlay) {
                    elements.modalOverlay.classList.remove('visible');
                }
            }

            function setupModalButtonListeners() {
                const copyButtons = document.querySelectorAll('[data-action="copy"]');
                const formatButtons = document.querySelectorAll('[data-action="format"]');
                
                copyButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const containerId = this.getAttribute('data-container');
                        copyJsonContent(containerId, this);
                    });
                });
                
                formatButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const containerId = this.getAttribute('data-container');
                        formatJsonContent(containerId);
                    });
                });
            }

            function copyJsonContent(containerId, button) {
                const element = document.getElementById(containerId);
                if (element && navigator.clipboard) {
                    navigator.clipboard.writeText(element.textContent).then(() => {
                        const originalText = button.textContent;
                        button.textContent = '✓ Copied!';
                        button.classList.add('success-feedback');
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.classList.remove('success-feedback');
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy:', err);
                        vscode.postMessage({ 
                            type: 'error',
                            message: 'Failed to copy to clipboard'
                        });
                    });
                }
            }

            function formatJsonContent(containerId) {
                const element = document.getElementById(containerId);
                if (element) {
                    try {
                        const parsed = JSON.parse(element.textContent);
                        element.textContent = JSON.stringify(parsed, null, 2);
                    } catch (e) {
                        // Not valid JSON, ignore
                    }
                }
            }

            function generateRequestDetailsHTML(request, index) {
                let html = '';
                
                // General info
                html += \`
                    <div class="detail-section">
                        <h3>General</h3>
                        <div class="detail-content">
                            <div class="info-row">
                                <div class="info-label">Method:</div>
                                <div class="info-value">\${request.method}</div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">URL:</div>
                                <div class="info-value">\${request.url}</div>
                            </div>
                            <div class="info-row">
                                <div class="info-label">Time:</div>
                                <div class="info-value">\${new Date(request.timestamp).toLocaleString()}</div>
                            </div>
                            \${request.duration ? \`<div class="info-row">
                                <div class="info-label">Duration:</div>
                                <div class="info-value">\${request.duration}ms</div>
                            </div>\` : ''}
                            \${request.responseStatus ? \`<div class="info-row">
                                <div class="info-label">Status:</div>
                                <div class="info-value">\${request.responseStatus} \${request.responseStatusText || ''}</div>
                            </div>\` : ''}
                        </div>
                    </div>
                \`;
                
                // Request Headers
                if (request.requestHeaders && Object.keys(request.requestHeaders).length > 0) {
                    html += \`
                        <div class="detail-section">
                            <h3>Request Headers</h3>
                            <div class="detail-content">
                    \`;
                    for (const [key, value] of Object.entries(request.requestHeaders)) {
                        html += \`
                            <div class="info-row">
                                <div class="info-label">\${escapeHtml(key)}:</div>
                                <div class="info-value">\${escapeHtml(String(value))}</div>
                            </div>
                        \`;
                    }
                    html += '</div></div>';
                }
                
                // Request Body
                if (request.requestBody) {
                    const bodyId = 'req-body-' + index;
                    const bodyContent = typeof request.requestBody === 'string' 
                        ? request.requestBody 
                        : JSON.stringify(request.requestBody, null, 2);
                    
                    html += \`
                        <div class="detail-section">
                            <h3>Request Body</h3>
                            \${createJsonControls(bodyContent, bodyId)}
                            <pre id="\${bodyId}" class="code-block">\${escapeHtml(bodyContent)}</pre>
                        </div>
                    \`;
                }
                
                // Response Headers
                if (request.responseHeaders && Object.keys(request.responseHeaders).length > 0) {
                    html += \`
                        <div class="detail-section">
                            <h3>Response Headers</h3>
                            <div class="detail-content">
                    \`;
                    for (const [key, value] of Object.entries(request.responseHeaders)) {
                        html += \`
                            <div class="info-row">
                                <div class="info-label">\${escapeHtml(key)}:</div>
                                <div class="info-value">\${escapeHtml(String(value))}</div>
                            </div>
                        \`;
                    }
                    html += '</div></div>';
                }
                
                // Response Body
                if (request.responseBody) {
                    const bodyId = 'res-body-' + index;
                    const bodyContent = typeof request.responseBody === 'string' 
                        ? request.responseBody 
                        : JSON.stringify(request.responseBody, null, 2);
                    
                    html += \`
                        <div class="detail-section">
                            <h3>Response Body</h3>
                            \${createJsonControls(bodyContent, bodyId)}
                            <pre id="\${bodyId}" class="code-block">\${escapeHtml(bodyContent)}</pre>
                        </div>
                    \`;
                }
                
                // Error
                if (request.error) {
                    html += \`
                        <div class="detail-section">
                            <h3>Error</h3>
                            <div class="error-message">\${escapeHtml(request.error)}</div>
                        </div>
                    \`;
                }
                
                return html;
            }

            function createJsonControls(content, containerId) {
                try {
                    JSON.parse(content);
                    return \`
                        <div class="json-controls">
                            <button class="btn btn-secondary btn-sm" data-container="\${containerId}" data-action="copy">📋 Copy</button>
                            <button class="btn btn-secondary btn-sm" data-container="\${containerId}" data-action="format">✨ Format</button>
                        </div>
                    \`;
                } catch (e) {
                    return ''; // Not valid JSON
                }
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            function applyFilters() {
                const urlFilter = (elements.urlFilter?.value || '').toLowerCase();
                const methodFilter = elements.methodFilter?.value || '';
                const statusFilter = elements.statusFilter?.value || '';
                
                filteredRequests = requests.filter(req => {
                    const urlMatch = !urlFilter || req.url.toLowerCase().includes(urlFilter);
                    const methodMatch = !methodFilter || req.method === methodFilter;
                    let statusMatch = true;
                    
                    if (statusFilter && req.responseStatus) {
                        const statusCode = req.responseStatus;
                        if (statusFilter === '2xx') statusMatch = statusCode >= 200 && statusCode < 300;
                        else if (statusFilter === '3xx') statusMatch = statusCode >= 300 && statusCode < 400;
                        else if (statusFilter === '4xx') statusMatch = statusCode >= 400 && statusCode < 500;
                        else if (statusFilter === '5xx') statusMatch = statusCode >= 500 && statusCode < 600;
                    }
                    
                    return urlMatch && methodMatch && statusMatch;
                });
                
                updateUI();
            }

            function updateUI() {
                // Update counter
                if (elements.requestCount) {
                    elements.requestCount.textContent = filteredRequests.length + ' request' + (filteredRequests.length !== 1 ? 's' : '');
                }
                
                // Toggle empty state
                if (requests.length === 0) {
                    if (elements.requestsTable) elements.requestsTable.style.display = 'none';
                    if (elements.emptyState) elements.emptyState.classList.add('visible');
                } else {
                    if (elements.requestsTable) elements.requestsTable.style.display = 'table';
                    if (elements.emptyState) elements.emptyState.classList.remove('visible');
                }
                
                // Clear table
                if (elements.requestsTbody) {
                    elements.requestsTbody.innerHTML = '';
                    
                    // Add rows
                    filteredRequests.forEach((request, index) => {
                        const row = document.createElement('tr');
                        row.onclick = () => showRequestDetails(index);
                        
                        const methodClass = 'method method-' + request.method;
                        const statusClass = request.responseStatus ? 
                            'status status-' + Math.floor(request.responseStatus / 100) + 'xx' : 'status';
                        
                        row.innerHTML = \`
                            <td class="\${methodClass}">\${request.method}</td>
                            <td>\${new URL(request.url).pathname}</td>
                            <td class="\${statusClass}">\${request.responseStatus || '-'}</td>
                            <td>\${request.duration ? request.duration + 'ms' : '-'}</td>
                            <td>\${new Date(request.timestamp).toLocaleTimeString()}</td>
                        \`;
                        
                        elements.requestsTbody.appendChild(row);
                    });
                    
                    // Auto scroll
                    if (autoScroll && filteredRequests.length > 0 && elements.requestsTbody.lastElementChild) {
                        elements.requestsTbody.lastElementChild.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }

            function handleMessage(event) {
                const message = event.data;
                switch (message.type) {
                    case 'updateRequests':
                        requests = message.data || [];
                        applyFilters(); // This will also update UI
                        break;
                    case 'clear':
                        requests = [];
                        filteredRequests = [];
                        updateUI();
                        break;
                }
            }

            // Initialize
            initializeUI();
            updateUI();
        })();
    </script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose(): void {
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
      this.webviewPanel = undefined;
    }
    this.messageCallbacks.clear();
  }
}
