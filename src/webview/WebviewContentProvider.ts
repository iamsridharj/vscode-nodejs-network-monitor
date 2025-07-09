import * as vscode from 'vscode';
import { NetworkRequest } from '../types';

export class WebviewContentProvider {
  constructor(private readonly webview: vscode.Webview) {}

  public getContent(requests: readonly NetworkRequest[]): string {
    const nonce = this.getNonce();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Network Requests</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            padding: 0;
            margin: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .toolbar {
            padding: 8px 16px;
            background: var(--vscode-titleBar-activeBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }
        
        .toolbar-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .toolbar-group:not(:last-child)::after {
            content: '';
            width: 1px;
            height: 20px;
            background: var(--vscode-panel-border);
            margin-left: 12px;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border, transparent);
            padding: 4px 12px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 13px;
            height: 26px;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        button:active {
            background: var(--vscode-button-activeBackground);
        }
        
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .filter-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        input, select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 2px 6px;
            height: 24px;
            font-size: 13px;
            border-radius: 2px;
        }
        
        input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        
        .status-badge {
            color: var(--vscode-editor-foreground);
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 2px;
            min-width: 60px;
            text-align: center;
        }
        
        .requests-container {
            flex: 1;
            overflow: auto;
            position: relative;
        }
        
        .requests-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        
        .requests-table th {
            background: var(--vscode-editor-background);
            position: sticky;
            top: 0;
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: 600;
            z-index: 1;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .requests-table th:nth-child(1) { width: 60px; }  /* Method */
        .requests-table th:nth-child(2) { width: auto; }   /* URL */
        .requests-table th:nth-child(3) { width: 80px; }  /* Status */
        .requests-table th:nth-child(4) { width: 80px; }  /* Duration */
        .requests-table th:nth-child(5) { width: 120px; } /* Time */
        
        .requests-table td {
            padding: 6px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            vertical-align: middle;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .requests-table tr {
            cursor: pointer;
            transition: background-color 0.1s ease;
        }
        
        .requests-table tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .method {
            font-weight: 600;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 2px;
            text-align: center;
            color: var(--vscode-editor-background);
        }
        
        .method.get { background: #4CAF50; }
        .method.post { background: #2196F3; }
        .method.put { background: #FF9800; }
        .method.delete { background: #f44336; }
        .method.patch { background: #9C27B0; }
        .method.head { background: #607D8B; }
        .method.options { background: #795548; }
        
        .status {
            font-weight: 600;
            font-size: 13px;
        }
        
        .status.success { color: #4CAF50; }
        .status.redirect { color: #FF9800; }
        .status.client-error { color: #f44336; }
        .status.server-error { color: #f44336; }
        .status.pending { color: var(--vscode-descriptionForeground); }
        .status.error { color: #f44336; }
        
        .url {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        
        .duration {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            text-align: right;
        }
        
        .time {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .modal {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .modal-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--vscode-titleBar-activeBackground);
        }
        
        .modal-title {
            font-weight: 600;
            font-size: 14px;
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 4px;
            color: var(--vscode-icon-foreground);
        }
        
        .modal-close:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        .modal-content {
            padding: 20px;
            min-width: 600px;
        }
        
        .detail-section {
            margin-bottom: 24px;
        }
        
        .detail-section h3 {
            margin: 0 0 8px 0;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
        }
        
        .detail-content {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            overflow: auto;
            max-height: 200px;
        }
        
        .info-row {
            display: flex;
            margin-bottom: 4px;
        }
        
        .info-label {
            min-width: 100px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
        }
        
        .info-value {
            font-family: var(--vscode-editor-font-family);
        }
        
        .hidden {
            display: none !important;
        }
        
        .json-controls {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        
        .btn {
            padding: 4px 8px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .btn-sm {
            padding: 2px 6px;
            font-size: 11px;
        }
        
        .spacer {
            flex-grow: 1;
        }
        
        .counter {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            padding: 4px 8px;
        }
        
        .filters {
            display: flex;
            gap: 8px;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-panel-background);
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
        }
        
        .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 8px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            line-height: 1.4;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        .modal-content {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .modal-body {
            padding: 20px;
            min-width: 600px;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button id="clear-btn" class="btn btn-primary" onclick="clearRequests()">Clear</button>
        <button id="export-btn" class="btn btn-secondary" onclick="exportRequests()">Export</button>
        <button id="auto-scroll-btn" class="btn btn-secondary" onclick="toggleAutoScroll()">Auto Scroll: On</button>
        <div class="spacer"></div>
        <div id="request-count" class="counter">0 requests</div>
    </div>

    <div class="filters">
        <input type="text" id="url-filter" placeholder="Filter by URL..." class="filter-input">
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
        <table id="requests-table" class="requests-table">
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
        <div class="empty-icon">🔍</div>
        <h3>No network requests captured yet</h3>
        <p>Run your Node.js application to see network requests here.</p>
    </div>

    <!-- Modal -->
    <div id="modal-overlay" class="modal-overlay hidden" onclick="closeModal(event)">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modal-title">Request Details</h2>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div id="modal-content" class="modal-body"></div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        let requests = ${JSON.stringify(requests)};
        let filteredRequests = requests;
        let autoScroll = true;

        // Initialize auto-scroll button text
        document.getElementById('auto-scroll-btn').textContent = \`Auto Scroll: \${autoScroll ? 'On' : 'Off'}\`;
        
        // State management
        function updateUI() {
            applyFilters();
            renderRequests();
            updateRequestCount();
            toggleEmptyState();
        }
        
        function applyFilters() {
            const urlFilter = document.getElementById('url-filter').value.toLowerCase();
            const methodFilter = document.getElementById('method-filter').value;
            const statusFilter = document.getElementById('status-filter').value;
            
            filteredRequests = requests.filter(request => {
                if (urlFilter && !request.url.toLowerCase().includes(urlFilter)) {
                    return false;
                }
                
                if (methodFilter && request.method !== methodFilter) {
                    return false;
                }
                
                if (statusFilter) {
                    if (statusFilter === 'error' && !request.error) {
                        return false;
                    } else if (statusFilter !== 'error') {
                        const status = request.responseStatus;
                        if (!status) return false;
                        
                        const statusRange = statusFilter.replace('xx', '');
                        if (!status.toString().startsWith(statusRange)) {
                            return false;
                        }
                    }
                }
                
                return true;
            });
        }
        
        function renderRequests() {
            const tbody = document.getElementById('requests-tbody');
            tbody.innerHTML = '';
            
            filteredRequests.forEach((request, index) => {
                const row = createRequestRow(request, index);
                tbody.appendChild(row);
            });
            
            if (autoScroll && filteredRequests.length > 0) {
                tbody.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
            }
        }
        
        function createRequestRow(request, index) {
            const row = document.createElement('tr');
            row.onclick = () => showRequestDetails(index);
            
            // Method cell
            const methodCell = document.createElement('td');
            const methodSpan = document.createElement('span');
            methodSpan.className = \`method \${request.method.toLowerCase()}\`;
            methodSpan.textContent = request.method;
            methodCell.appendChild(methodSpan);
            
            // URL cell
            const urlCell = document.createElement('td');
            urlCell.className = 'url';
            urlCell.textContent = request.url;
            urlCell.title = request.url;
            
            // Status cell
            const statusCell = document.createElement('td');
            const statusSpan = document.createElement('span');
            statusSpan.className = \`status \${getStatusClass(request)}\`;
            statusSpan.textContent = getStatusText(request);
            statusCell.appendChild(statusSpan);
            
            // Duration cell
            const durationCell = document.createElement('td');
            durationCell.className = 'duration';
            durationCell.textContent = request.duration ? \`\${request.duration}ms\` : '-';
            
            // Time cell
            const timeCell = document.createElement('td');
            timeCell.className = 'time';
            timeCell.textContent = new Date(request.timestamp).toLocaleTimeString();
            
            row.appendChild(methodCell);
            row.appendChild(urlCell);
            row.appendChild(statusCell);
            row.appendChild(durationCell);
            row.appendChild(timeCell);
            
            return row;
        }
        
        function getStatusClass(request) {
            if (request.error) return 'error';
            if (!request.responseStatus) return 'pending';
            
            const status = request.responseStatus;
            if (status >= 200 && status < 300) return 'success';
            if (status >= 300 && status < 400) return 'redirect';
            if (status >= 400 && status < 500) return 'client-error';
            if (status >= 500) return 'server-error';
            return '';
        }
        
        function getStatusText(request) {
            if (request.error) return 'Error';
            if (!request.responseStatus) return 'Pending';
            return request.responseStatus.toString();
        }
        
        function updateRequestCount() {
            const count = filteredRequests.length;
            const total = requests.length;
            const countEl = document.getElementById('request-count');
            
            if (count === total) {
                countEl.textContent = \`\${count} request\${count !== 1 ? 's' : ''}\`;
            } else {
                countEl.textContent = \`\${count} of \${total} request\${total !== 1 ? 's' : ''}\`;
            }
        }
        
        function toggleEmptyState() {
            const table = document.getElementById('requests-table');
            const emptyState = document.getElementById('empty-state');
            
            if (requests.length === 0) {
                table.classList.add('hidden');
                emptyState.classList.remove('hidden');
            } else {
                table.classList.remove('hidden');
                emptyState.classList.add('hidden');
            }
        }
        
        // Event handlers
        function clearRequests() {
            vscode.postMessage({ type: 'clear' });
        }
        
        function exportRequests() {
            vscode.postMessage({ type: 'export' });
        }
        
        function toggleAutoScroll() {
            autoScroll = !autoScroll;
            const btn = document.getElementById('auto-scroll-btn');
            btn.textContent = \`Auto Scroll: \${autoScroll ? 'On' : 'Off'}\`;
        }
        
        // Make functions globally accessible
        window.clearRequests = clearRequests;
        window.exportRequests = exportRequests;
        window.toggleAutoScroll = toggleAutoScroll;
        window.showRequestDetails = showRequestDetails;
        window.closeModal = closeModal;
        window.copyJsonContent = copyJsonContent;
        window.formatJsonContent = formatJsonContent;
        
        function showRequestDetails(index) {
            const request = filteredRequests[index];
            if (!request) return;
            
            const modal = document.getElementById('modal-overlay');
            const content = document.getElementById('modal-content');
            const title = document.getElementById('modal-title');
            
            title.textContent = \`\${request.method} \${new URL(request.url).pathname}\`;
            content.innerHTML = generateRequestDetailsHTML(request);
            modal.classList.remove('hidden');
        }
        
        function closeModal(event) {
            if (event && event.target !== event.currentTarget) return;
            document.getElementById('modal-overlay').classList.add('hidden');
        }
        
        // Close modal when clicking outside
        document.getElementById('modal-overlay').addEventListener('click', closeModal);
        
        function generateRequestDetailsHTML(request) {
            const sections = [];
            
            // General info
            sections.push(\`
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
                            <div class="info-value">\${request.responseStatus}</div>
                        </div>\` : ''}
                        \${request.error ? \`<div class="info-row">
                            <div class="info-label">Error:</div>
                            <div class="info-value">\${request.error}</div>
                        </div>\` : ''}
                    </div>
                </div>
            \`);
            
            // Request headers
            if (request.headers && Object.keys(request.headers).length > 0) {
                const headersContent = JSON.stringify(request.headers, null, 2);
                const headersId = 'request-headers-' + Date.now();
                sections.push(\`
                    <div class="detail-section">
                        <h3>Request Headers</h3>
                        \${createJsonControls(headersContent, headersId)}
                        <pre id="\${headersId}" class="detail-content code-block">\${headersContent}</pre>
                    </div>
                \`);
            }
            
            // Request body
            if (request.requestBody) {
                const bodyContent = typeof request.requestBody === 'string' ? 
                    request.requestBody : 
                    JSON.stringify(request.requestBody, null, 2);
                const bodyId = 'request-body-' + Date.now();
                sections.push(\`
                    <div class="detail-section">
                        <h3>Request Body</h3>
                        \${createJsonControls(bodyContent, bodyId)}
                        <pre id="\${bodyId}" class="detail-content code-block">\${bodyContent}</pre>
                    </div>
                \`);
            }
            
            // Response headers
            if (request.responseHeaders && Object.keys(request.responseHeaders).length > 0) {
                const responseHeadersContent = JSON.stringify(request.responseHeaders, null, 2);
                const responseHeadersId = 'response-headers-' + Date.now();
                sections.push(\`
                    <div class="detail-section">
                        <h3>Response Headers</h3>
                        \${createJsonControls(responseHeadersContent, responseHeadersId)}
                        <pre id="\${responseHeadersId}" class="detail-content code-block">\${responseHeadersContent}</pre>
                    </div>
                \`);
            }
            
            // Response body
            if (request.responseBody) {
                const responseBodyContent = typeof request.responseBody === 'string' ? 
                    request.responseBody : 
                    JSON.stringify(request.responseBody, null, 2);
                const responseBodyId = 'response-body-' + Date.now();
                sections.push(\`
                    <div class="detail-section">
                        <h3>Response Body</h3>
                        \${createJsonControls(responseBodyContent, responseBodyId)}
                        <pre id="\${responseBodyId}" class="detail-content code-block">\${responseBodyContent}</pre>
                    </div>
                \`);
            }
            
            return sections.join('');
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                // Could add a toast notification here
                console.log('Copied to clipboard');
            });
        }

        function formatJson(text) {
            try {
                const parsed = JSON.parse(text);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                return text; // Return original if not valid JSON
            }
        }

        function createJsonControls(content, containerId) {
            const isValidJson = (() => {
                try {
                    JSON.parse(content);
                    return true;
                } catch (e) {
                    return false;
                }
            })();

            if (!isValidJson) {
                return ''; // No controls for non-JSON content
            }

            return \`
                <div class="json-controls">
                    <button class="btn btn-secondary btn-sm" onclick="copyJsonContent('\${containerId}')">📋 Copy</button>
                    <button class="btn btn-secondary btn-sm" onclick="formatJsonContent('\${containerId}')">✨ Format</button>
                </div>
            \`;
        }

        function copyJsonContent(containerId) {
            const element = document.getElementById(containerId);
            if (element) {
                copyToClipboard(element.textContent);
            }
        }

        function formatJsonContent(containerId) {
            const element = document.getElementById(containerId);
            if (element) {
                const formatted = formatJson(element.textContent);
                element.textContent = formatted;
            }
        }
        
        // Filter event listeners
        document.getElementById('url-filter').addEventListener('input', updateUI);
        document.getElementById('method-filter').addEventListener('change', updateUI);
        document.getElementById('status-filter').addEventListener('change', updateUI);
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeModal();
            } else if (event.ctrlKey || event.metaKey) {
                if (event.key === 'k') {
                    event.preventDefault();
                    document.getElementById('url-filter').focus();
                } else if (event.key === 'r') {
                    event.preventDefault();
                    clearRequests();
                }
            }
        });
        
        // Message handling
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'updateRequests') {
                requests = message.data || [];
                updateUI();
            } else if (message.type === 'clear') {
                requests = [];
                updateUI();
            }
        });
        
        // Initial render
        updateUI();
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
}
