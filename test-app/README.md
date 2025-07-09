# Network Interceptor Test Application

This is a simple Node.js test application designed to test the VS Code Network Interceptor extension.

## Setup

1. Install dependencies:
```bash
npm install
```

## Running Tests

### Basic HTTP/HTTPS Tests (using native Node.js modules)
```bash
npm start
# or
node index.js
```

This will run tests using Node.js native `http` and `https` modules:
- ✅ HTTP GET request
- ✅ HTTPS GET request  
- ✅ HTTP POST request with JSON body
- ✅ Multiple sequential requests

### Axios Tests (using third-party HTTP library)
```bash
npm test
# or
node test-requests.js
```

This will run tests using the Axios library:
- ✅ Axios GET request
- ✅ Axios POST request with headers
- ✅ Concurrent requests
- ✅ Custom Axios instance with config

## How to Test the Network Interceptor

1. **Open this project in VS Code**
2. **Set a breakpoint** in `index.js` (line 108 in the `main()` function)
3. **Start debugging** (F5 or Debug > Start Debugging)
4. **Use the Network Interceptor extension**:
   - Open Command Palette (Cmd/Ctrl + Shift + P)
   - Run: "Network Interceptor: Force Inject Interceptor (Debug)"
   - Open the Network Panel: "Network Interceptor: Show Network Panel"
5. **Continue execution** (F5) to let the HTTP requests run
6. **Check the Network Panel** to see if requests are being captured

## Expected Behavior

When the interceptor is working correctly, you should see:
- 📡 HTTP requests appearing in the Network Panel
- 📦 Request/response details including headers and body
- ⏱️ Request timing information
- 🔍 Both native Node.js and Axios requests being captured

## Troubleshooting

If you don't see network requests:
1. Check the VS Code Output panel for Network Interceptor logs
2. Verify the interceptor was successfully injected
3. Make sure you're debugging the Node.js process (not just running it normally)
4. Try the "Force Inject Interceptor" command if auto-injection fails

## Test URLs

The test uses `httpbin.org` which provides various HTTP testing endpoints:
- `GET /get` - Returns request data
- `POST /post` - Returns posted data
- `/status/200` - Returns specific HTTP status codes
- `/delay/1` - Returns response after specified delay
- `/headers` - Returns request headers 