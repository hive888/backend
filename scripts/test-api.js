#!/usr/bin/env node
/**
 * API Testing Script
 * Tests all API endpoints systematically
 * Usage: node scripts/test-api.js [base_url]
 */

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.argv[2] || process.env.API_URL || 'http://localhost:3000/api';

let accessToken = null;
let refreshToken = null;
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function logTest(name, status, message = '') {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} ${name}${message ? ': ' + message : ''}`);
  
  testResults.tests.push({ name, status, message });
  if (status === 'pass') testResults.passed++;
  else if (status === 'fail') testResults.failed++;
  else testResults.skipped++;
}

async function testEndpoint(name, method, url, data = null, headers = {}, expectedStatus = 200) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      validateStatus: () => true // Don't throw on any status
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      logTest(name, 'pass', `Status: ${response.status}`);
      return response.data;
    } else {
      logTest(name, 'fail', `Expected ${expectedStatus}, got ${response.status}`);
      return null;
    }
  } catch (error) {
    logTest(name, 'fail', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 PTGR API Testing Suite');
  console.log('========================');
  console.log(`Base URL: ${BASE_URL}\n`);
  
  // ============================================
  // 1. HEALTH CHECK
  // ============================================
  console.log('\n📊 Health Check');
  console.log('----------------');
  await testEndpoint('Health Check', 'GET', '/health');
  
  // ============================================
  // 2. AUTHENTICATION
  // ============================================
  console.log('\n🔐 Authentication');
  console.log('-----------------');
  
  // Test login with dummy credentials (will fail but tests endpoint)
  const loginData = await testEndpoint(
    'Login (Test)', 
    'POST', 
    '/auth/login', 
    {
      username: 'test@example.com',
      password: 'testpass'
    },
    {},
    401 // Expected to fail with invalid credentials
  );
  
  // If you have real credentials, uncomment and use:
  /*
  const loginData = await testEndpoint('Login', 'POST', '/auth/login', {
    username: 'your-email@example.com',
    password: 'your-password'
  });
  
  if (loginData?.data?.accessToken) {
    accessToken = loginData.data.accessToken;
    refreshToken = loginData.data.refreshToken;
    console.log('✅ Authentication successful!');
  }
  */
  
  const authHeaders = accessToken ? {
    'Authorization': `Bearer ${accessToken}`
  } : {};
  
  // ============================================
  // 3. PUBLIC ENDPOINTS
  // ============================================
  console.log('\n🌐 Public Endpoints');
  console.log('-------------------');
  
  await testEndpoint('List Contests', 'GET', '/contest');
  await testEndpoint('Get All Chapters', 'GET', '/chapters');
  await testEndpoint('Get All Sections', 'GET', '/sections');
  await testEndpoint('Get All Subsections', 'GET', '/subsections');
  await testEndpoint('Get All Customers (Public)', 'GET', '/customers?limit=5');
  
  // ============================================
  // 4. CUSTOMER ENDPOINTS
  // ============================================
  console.log('\n👤 Customer Endpoints');
  console.log('---------------------');
  
  await testEndpoint('Request Phone OTP', 'POST', '/customers/phone/request-otp', {
    phone: '+1234567890'
  });
  
  await testEndpoint('Send Verification Email', 'POST', '/customers/send-verification-email', {
    email: 'test@example.com'
  });
  
  // ============================================
  // 5. USER ENDPOINTS
  // ============================================
  console.log('\n👥 User Endpoints');
  console.log('-----------------');
  
  await testEndpoint('Forgot Password', 'POST', '/users/forgot-password', {
    username: 'test@example.com'
  });
  
  // ============================================
  // 6. TALENT POOL
  // ============================================
  console.log('\n💼 Talent Pool');
  console.log('--------------');
  
  await testEndpoint('Get All Registrations', 'GET', '/talent-pool/registrations');
  await testEndpoint('Get Registration Stats', 'GET', '/talent-pool/registrations/stats');
  await testEndpoint('Get Status Definitions', 'GET', '/talent-pool/registrations/status-definitions');
  
  // ============================================
  // 7. AUTHENTICATED ENDPOINTS (if token available)
  // ============================================
  if (accessToken) {
    console.log('\n🔒 Authenticated Endpoints');
    console.log('-------------------------');
    
    await testEndpoint('Get Subscription Status', 'GET', '/course-access', null, authHeaders);
    await testEndpoint('Get My Contest Status', 'GET', '/contest/check/me', null, authHeaders);
    await testEndpoint('Get Full Profile', 'GET', '/customers/full-profile', null, authHeaders);
  } else {
    console.log('\n⏭️  Skipping authenticated endpoints (no token)');
    console.log('   To test authenticated endpoints:');
    console.log('   1. Update login credentials in this script');
    console.log('   2. Or set accessToken manually after successful login');
  }
  
  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📈 Test Summary');
  console.log('===============');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏭️  Skipped: ${testResults.skipped}`);
  console.log(`📊 Total: ${testResults.tests.length}`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'fail')
      .forEach(t => console.log(`   - ${t.name}: ${t.message}`));
  }
  
  console.log('\n✨ Testing completed!');
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

runTests();

