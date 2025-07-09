import * as vscode from 'vscode';
import { NetworkRequest, WebviewMessage } from '../types';

export class NetworkWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private requests: NetworkRequest[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'out'),
        vscode.Uri.joinPath(this.context.extensionUri, 'src', 'ui'),
      ],
    };

    webviewView.webview.html = this.generateHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleWebviewMessage(message),
      undefined,
      this.context.subscriptions
    );
  }

  public createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'networkInterceptor',
      'Network Requests',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'out'),
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'ui'),
        ],
      }
    );

    panel.webview.html = this.generateHtmlContent(panel.webview);

    panel.webview.postMessage({
      type: 'updateRequests',
      data: this.requests,
    });

    panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleWebviewMessage(message),
      undefined,
      this.context.subscriptions
    );

    return panel;
  }

  public updateRequests(requests: NetworkRequest[]): void {
    this.requests = requests;

    this._view?.webview.postMessage({
      type: 'updateRequests',
      data: requests,
    });
  }

  public updatePanel(
    panel: vscode.WebviewPanel,
    requests: NetworkRequest[]
  ): void {
    panel.webview.postMessage({
      type: 'updateRequests',
      data: requests,
    });
  }

  public clearRequests(): void {
    this.requests = [];

    this._view?.webview.postMessage({
      type: 'clear',
    });
  }

  public handleWebviewMessage(message: WebviewMessage): void {
    switch (message.type) {
      case 'clear':
        vscode.commands.executeCommand('networkInterceptor.clear');
        break;
      case 'export':
        this.exportRequests();
        break;
    }
  }

  private async exportRequests(): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('network-requests.json'),
      filters: {
        'JSON files': ['json'],
      },
    });

    if (uri) {
      const content = JSON.stringify(this.requests, null, 2);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
      vscode.window.showInformationMessage(
        'Network requests exported successfully!'
      );
    }
  }

  private generateHtmlContent(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'src',
        'ui',
        'styles',
        'networkPanel.css'
      )
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Requests</title>
    <style>
        :root {
          --primary-color: #007acc;
          --success-color: #28a745;
          --warning-color: #ffc107;
          --error-color: #dc3545;
          --info-color: #17a2b8;
          --border-color: var(--vscode-panel-border);
          --bg-color: var(--vscode-editor-background);
          --text-color: var(--vscode-editor-foreground);
          --hover-color: var(--vscode-list-hoverBackground);
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--text-color);
          background-color: var(--bg-color);
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .toolbar {
          display: flex;
          align-items: center;
          padding: 10px;
          border-bottom: 1px solid var(--border-color);
          background: var(--vscode-panel-background);
          gap: 10px;
        }

        .btn {
          padding: 6px 12px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }

        .btn-primary {
          background: var(--primary-color);
          color: white;
        }

        .btn-primary:hover {
          background: #005a9e;
        }

        .btn-secondary {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        .counter {
          margin-left: auto;
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }

        .json-controls {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .btn-sm {
          padding: 2px 6px;
          font-size: 11px;
        }

        .requests-container {
          height: calc(100vh - 50px);
          overflow: auto;
        }

        #requestsTable {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        #requestsTable th {
          background: var(--vscode-panel-background);
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .request-row {
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .request-row:hover {
          background: var(--hover-color);
        }

        .request-row td {
          padding: 8px;
          border-bottom: 1px solid var(--border-color);
        }

        .method {
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          text-transform: uppercase;
        }

        .method.get { background: var(--success-color); color: white; }
        .method.post { background: var(--primary-color); color: white; }
        .method.put { background: var(--warning-color); color: black; }
        .method.delete { background: var(--error-color); color: white; }
        .method.patch { background: var(--info-color); color: white; }

        .url-cell {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status {
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
        }

        .status.success { background: var(--success-color); color: white; }
        .status.client-error { background: var(--warning-color); color: black; }
        .status.server-error { background: var(--error-color); color: white; }
        .status.info { background: var(--info-color); color: white; }
        .status.error { background: var(--error-color); color: white; }
        .status.pending { background: #6c757d; color: white; }

        .modal {
          display: none;
          position: fixed;
          z-index: 1000;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0,0,0,0.5);
        }

        .modal-content {
          background-color: var(--bg-color);
          margin: 5% auto;
          padding: 0;
          border: 1px solid var(--border-color);
          width: 80%;
          max-width: 800px;
          max-height: 80vh;
          border-radius: 6px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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

        .close {
          font-size: 28px;
          font-weight: bold;
          cursor: pointer;
          color: var(--vscode-descriptionForeground);
        }

        .close:hover {
          color: var(--text-color);
        }

        .modal-body {
          padding: 20px;
          max-height: 60vh;
          overflow-y: auto;
        }

        .detail-section {
          margin-bottom: 20px;
        }

        .detail-section h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: var(--primary-color);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
        }

        .detail-item .label {
          font-weight: bold;
          color: var(--vscode-descriptionForeground);
        }

        .detail-item .value {
          color: var(--text-color);
          word-break: break-all;
        }

        .code-block {
          background: var(--vscode-textCodeBlock-background);
          border: 1px solid var(--border-color);
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
          font-family: var(--vscode-editor-font-family);
          font-size: 12px;
          line-height: 1.4;
        }

        .error-message {
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid var(--error-color);
          color: var(--error-color);
          padding: 10px;
          border-radius: 4px;
          font-family: var(--vscode-editor-font-family);
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: var(--vscode-scrollbar-shadow);
        }

        ::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground);
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="toolbar">
            <button id="clearBtn" class="btn btn-primary" onclick="clearRequests()">Clear</button>
            <button id="exportBtn" class="btn btn-secondary" onclick="exportRequests()">Export</button>
            <button id="autoScrollBtn" class="btn btn-secondary" onclick="toggleAutoScroll()">Auto Scroll: On</button>
            <span id="requestCount" class="counter">Requests: 0</span>
        </div>
        
        <div class="requests-container">
            <table id="requestsTable">
                <thead>
                    <tr>
                        <th>Method</th>
                        <th>URL</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody id="requestsBody">
                </tbody>
            </table>
        </div>
    </div>

    <div id="modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Request Details</h2>
                <span id="closeModal" class="close">&times;</span>
            </div>
            <div id="modalBody" class="modal-body"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let requests = [];
        let autoScroll = true;

        document.getElementById('closeModal').addEventListener('click', closeModal);

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                console.log('Copied to clipboard');
            });
        }

        function formatJson(text) {
            try {
                const parsed = JSON.parse(text);
                return JSON.stringify(parsed, null, 2);
            } catch (e) {
                return text;
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
                return '';
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

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateRequests':
                    requests = message.data;
                    updateRequestsTable();
                    break;
                case 'clear':
                    requests = [];
                    updateRequestsTable();
                    break;
            }
        });

        function updateRequestsTable() {
            const tbody = document.getElementById('requestsBody');
            tbody.innerHTML = '';

            requests.forEach((request, index) => {
                const row = tbody.insertRow();
                row.className = 'request-row';
                row.onclick = () => showRequestDetails(index);

                const methodCell = row.insertCell(0);
                methodCell.innerHTML = \`<span class="method \${request.method.toLowerCase()}">\${request.method}</span>\`;

                const urlCell = row.insertCell(1);
                urlCell.textContent = request.url;
                urlCell.className = 'url-cell';

                const statusCell = row.insertCell(2);
                if (request.error) {
                    statusCell.innerHTML = '<span class="status error">Error</span>';
                } else if (request.responseStatus) {
                    const statusClass = getStatusClass(request.responseStatus);
                    statusCell.innerHTML = \`<span class="status \${statusClass}">\${request.responseStatus}</span>\`;
                } else {
                    statusCell.innerHTML = '<span class="status pending">Pending</span>';
                }

                const durationCell = row.insertCell(3);
                durationCell.textContent = request.duration ? \`\${request.duration}ms\` : '-';

                const timeCell = row.insertCell(4);
                timeCell.textContent = new Date(request.timestamp).toLocaleTimeString();
            });

            document.getElementById('requestCount').textContent = \`Requests: \${requests.length}\`;
            
            // Auto-scroll to bottom if enabled
            if (autoScroll) {
                const container = document.querySelector('.requests-container');
                container.scrollTop = container.scrollHeight;
            }
        }

        function getStatusClass(status) {
            if (status >= 200 && status < 300) return 'success';
            if (status >= 400 && status < 500) return 'client-error';
            if (status >= 500) return 'server-error';
            return 'info';
        }

        function showRequestDetails(index) {
            const request = requests[index];
            const modalBody = document.getElementById('modalBody');
            
            modalBody.innerHTML = \`
                <div class="detail-section">
                    <h3>General Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="label">Method:</span>
                            <span class="value">\${request.method}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">URL:</span>
                            <span class="value">\${request.url}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Timestamp:</span>
                            <span class="value">\${new Date(request.timestamp).toLocaleString()}</span>
                        </div>
                        \${request.duration ? \`
                        <div class="detail-item">
                            <span class="label">Duration:</span>
                            <span class="value">\${request.duration}ms</span>
                        </div>
                        \` : ''}
                    </div>
                </div>

                <div class="detail-section">
                    <h3>Request Headers</h3>
                    \${createJsonControls(JSON.stringify(request.headers, null, 2), 'req-headers-' + index)}
                    <pre id="req-headers-\${index}" class="code-block">\${JSON.stringify(request.headers, null, 2)}</pre>
                </div>

                \${request.requestBody ? \`
                <div class="detail-section">
                    <h3>Request Body</h3>
                    \${createJsonControls(typeof request.requestBody === 'string' ? request.requestBody : JSON.stringify(request.requestBody, null, 2), 'req-body-' + index)}
                    <pre id="req-body-\${index}" class="code-block">\${typeof request.requestBody === 'string' ? request.requestBody : JSON.stringify(request.requestBody, null, 2)}</pre>
                </div>
                \` : ''}

                \${request.responseStatus ? \`
                <div class="detail-section">
                    <h3>Response</h3>
                    <div class="detail-item">
                        <span class="label">Status:</span>
                        <span class="value status \${getStatusClass(request.responseStatus)}">\${request.responseStatus}</span>
                    </div>
                    <h4>Response Headers</h4>
                    \${createJsonControls(JSON.stringify(request.responseHeaders, null, 2), 'res-headers-' + index)}
                    <pre id="res-headers-\${index}" class="code-block">\${JSON.stringify(request.responseHeaders, null, 2)}</pre>
                </div>
                \` : ''}

                \${request.responseBody ? \`
                <div class="detail-section">
                    <h3>Response Body</h3>
                    \${createJsonControls(typeof request.responseBody === 'string' ? request.responseBody : JSON.stringify(request.responseBody, null, 2), 'res-body-' + index)}
                    <pre id="res-body-\${index}" class="code-block">\${typeof request.responseBody === 'string' ? request.responseBody : JSON.stringify(request.responseBody, null, 2)}</pre>
                </div>
                \` : ''}

                \${request.error ? \`
                <div class="detail-section">
                    <h3>Error</h3>
                    <div class="error-message">\${request.error}</div>
                </div>
                \` : ''}
            \`;

            document.getElementById('modal').style.display = 'block';
        }

        function closeModal() {
            document.getElementById('modal').style.display = 'none';
        }

        // Close modal when clicking outside
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                closeModal();
            }
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
        
        // Make functions globally accessible
        window.clearRequests = () => vscode.postMessage({ type: 'clear' });
        window.exportRequests = () => vscode.postMessage({ type: 'export' });
        window.toggleAutoScroll = () => {
            autoScroll = !autoScroll;
            document.getElementById('autoScrollBtn').textContent = \`Auto Scroll: \${autoScroll ? 'On' : 'Off'}\`;
        };
        window.showRequestDetails = showRequestDetails;
        window.closeModal = closeModal;
        window.copyJsonContent = copyJsonContent;
        window.formatJsonContent = formatJsonContent;

        updateRequestsTable();
    </script>
</body>
</html>`;
  }
}
