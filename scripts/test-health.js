#!/usr/bin/env node
/**
 * Simple Health Check Test
 * Tests the /api/health endpoint
 */

const http = require('http');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('🧪 Testing Health Endpoint');
console.log('==========================\n');

const url = new URL(`${BASE_URL}/api/health`);

const options = {
  hostname: url.hostname,
  port: url.port || 3000,
  path: url.pathname,
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  console.log('\nResponse Body:');
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      console.log('\n✅ Health check successful!');
      process.exit(0);
    } catch (e) {
      console.log(data);
      console.log('\n⚠️  Response is not valid JSON');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.error('\nTroubleshooting:');
  console.error('1. Make sure the server is running: npm start');
  console.error('2. Check if the port is correct:', options.port);
  console.error('3. Check server logs for errors');
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Request timed out');
  req.destroy();
  process.exit(1);
});

req.end();


