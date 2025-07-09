const axios = require('axios');

console.log('🚀 Starting Axios request test...');

// Test 1: Axios GET request
async function testAxiosGet() {
  console.log('\n📡 Testing Axios GET request...');

  try {
    const response = await axios.get('https://httpbin.org/get');
    console.log(`✅ Axios GET response status: ${response.status}`);
    console.log(
      `📦 Axios GET response length: ${JSON.stringify(response.data).length} bytes`
    );
  } catch (error) {
    console.error(`❌ Axios GET error: ${error.message}`);
  }
}

// Test 2: Axios POST request
async function testAxiosPost() {
  console.log('\n📤 Testing Axios POST request...');

  try {
    const data = {
      message: 'Hello from Axios test!',
      timestamp: new Date().toISOString(),
      user: 'network-interceptor-test',
    };

    const response = await axios.post('https://httpbin.org/post', data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Header': 'network-interceptor',
      },
    });

    console.log(`✅ Axios POST response status: ${response.status}`);
    console.log(
      `📦 Axios POST response length: ${JSON.stringify(response.data).length} bytes`
    );
  } catch (error) {
    console.error(`❌ Axios POST error: ${error.message}`);
  }
}

// Test 3: Multiple concurrent axios requests
async function testConcurrentRequests() {
  console.log('\n🔄 Testing concurrent Axios requests...');

  const urls = [
    'https://httpbin.org/status/200',
    'https://httpbin.org/status/201',
    'https://httpbin.org/status/404',
    'https://httpbin.org/delay/1',
  ];

  try {
    const promises = urls.map((url, index) => {
      console.log(`📡 Starting request ${index + 1}: ${url}`);
      return axios
        .get(url)
        .then((res) => {
          console.log(`✅ Response ${index + 1}: ${res.status}`);
          return res;
        })
        .catch((err) => {
          console.log(
            `❌ Error ${index + 1}: ${err.response?.status || err.message}`
          );
          return null;
        });
    });

    const results = await Promise.all(promises);
    console.log(
      `📊 Completed ${results.filter((r) => r !== null).length}/${urls.length} requests`
    );
  } catch (error) {
    console.error(`❌ Concurrent requests error: ${error.message}`);
  }
}

// Test 4: Axios with custom config
async function testAxiosWithConfig() {
  console.log('\n⚙️ Testing Axios with custom config...');

  const customAxios = axios.create({
    baseURL: 'https://httpbin.org',
    timeout: 5000,
    headers: {
      'X-Custom-Header': 'interceptor-test',
      'User-Agent': 'Network-Interceptor-Test/1.0',
    },
  });

  try {
    const response = await customAxios.get('/headers');
    console.log(`✅ Custom Axios response status: ${response.status}`);
    console.log(
      `📦 Custom Axios response length: ${JSON.stringify(response.data).length} bytes`
    );
  } catch (error) {
    console.error(`❌ Custom Axios error: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log('🔍 Network Interceptor Axios Test');
  console.log('=================================');

  // Wait a bit for any interceptor to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Run tests sequentially
  await testAxiosGet();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testAxiosPost();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testConcurrentRequests();
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await testAxiosWithConfig();

  console.log('\n✅ Axios test completed!');
}

main().catch(console.error);
