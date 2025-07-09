const axios = require('axios');
const http = require('http');

async function testUIFunctionality() {
  console.log('🚀 Testing UI functionality...');

  // Test 1: Basic GET request
  console.log('1. Testing GET request...');
  try {
    const response = await axios.get(
      'https://jsonplaceholder.typicode.com/posts/1'
    );
    console.log('✅ GET request successful');
  } catch (error) {
    console.log('❌ GET request failed:', error.message);
  }

  // Test 2: POST request with JSON body
  console.log('2. Testing POST request with JSON body...');
  try {
    const response = await axios.post(
      'https://jsonplaceholder.typicode.com/posts',
      {
        title: 'Test Post',
        body: 'This is a test post',
        userId: 1,
      }
    );
    console.log('✅ POST request successful');
  } catch (error) {
    console.log('❌ POST request failed:', error.message);
  }

  // Test 3: Request with error
  console.log('3. Testing request with error...');
  try {
    await axios.get('https://invalid-url-that-should-fail.com');
  } catch (error) {
    console.log('✅ Error request caught (expected)');
  }

  // Test 4: Multiple rapid requests to test auto-scroll
  console.log('4. Testing multiple rapid requests...');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      axios
        .get(`https://jsonplaceholder.typicode.com/posts/${i + 1}`)
        .catch((err) => console.log(`Request ${i + 1} failed:`, err.message))
    );
  }

  await Promise.all(promises);
  console.log('✅ Multiple requests completed');

  console.log(
    '\n🎉 UI Testing completed! Check the Network Interceptor panel to verify:'
  );
  console.log('- Clear button clears all requests');
  console.log('- Export button exports requests to JSON');
  console.log('- Auto Scroll button toggles On/Off');
  console.log('- Modal close button works');
  console.log('- JSON Copy/Format buttons work in modal');
  console.log('- Response body is displayed in modal');
  console.log('- Click outside modal to close it');
  console.log('- Press Escape key to close modal');
}

testUIFunctionality();
