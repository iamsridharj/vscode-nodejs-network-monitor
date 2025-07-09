const http = require('http');
const https = require('https');

console.log('🚀 Starting HTTP request test...');

// Test 1: Simple HTTP GET request
function testHttpGet() {
  console.log('\n📡 Testing HTTP GET request...');

  const req = http.get('http://httpbin.org/get', (res) => {
    console.log(`✅ HTTP GET response status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`📦 HTTP GET response length: ${data.length} bytes`);
    });
  });

  req.on('error', (err) => {
    console.error(`❌ HTTP GET error: ${err.message}`);
  });
}

// Test 2: HTTPS GET request
function testHttpsGet() {
  console.log('\n🔒 Testing HTTPS GET request...');

  const req = https.get('https://httpbin.org/get', (res) => {
    console.log(`✅ HTTPS GET response status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`📦 HTTPS GET response length: ${data.length} bytes`);
    });
  });

  req.on('error', (err) => {
    console.error(`❌ HTTPS GET error: ${err.message}`);
  });
}

// Test 3: HTTP POST request
function testHttpPost() {
  console.log('\n📤 Testing HTTP POST request...');

  const postData = JSON.stringify({
    message: 'Hello from network interceptor test!',
    timestamp: new Date().toISOString(),
  });

  const options = {
    hostname: 'httpbin.org',
    port: 80,
    path: '/post',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = http.request(options, (res) => {
    console.log(`✅ HTTP POST response status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`📦 HTTP POST response length: ${data.length} bytes`);
    });
  });

  req.on('error', (err) => {
    console.error(`❌ HTTP POST error: ${err.message}`);
  });

  req.write(postData);
  req.end();
}

// Test 4: Multiple requests in sequence
function testMultipleRequests() {
  console.log('\n🔄 Testing multiple requests...');

  const urls = [
    'http://httpbin.org/status/200',
    'http://httpbin.org/status/404',
    'http://httpbin.org/delay/1',
  ];

  urls.forEach((url, index) => {
    setTimeout(() => {
      console.log(`📡 Request ${index + 1}: ${url}`);
      http
        .get(url, (res) => {
          console.log(`✅ Response ${index + 1}: ${res.statusCode}`);
        })
        .on('error', (err) => {
          console.error(`❌ Error ${index + 1}: ${err.message}`);
        });
    }, index * 2000); // Stagger requests by 2 seconds
  });
}

// Main execution
async function main() {
  console.log('🔍 Network Interceptor Test Application');
  console.log('=====================================');

  // Wait a bit for any interceptor to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Run tests
  testHttpGet();

  setTimeout(() => {
    testHttpsGet();
  }, 2000);

  setTimeout(() => {
    testHttpPost();
  }, 4000);

  setTimeout(() => {
    testMultipleRequests();
  }, 6000);

  // Keep the process alive for 20 seconds
  setTimeout(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  }, 20000);
}

main().catch(console.error);
