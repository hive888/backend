# API Testing Guide

This guide provides step-by-step instructions to test all API endpoints.

## Prerequisites

1. Server running: `npm start` or `npm run dev`
2. Database connected and configured
3. Environment variables set in `.env`
4. Testing tool: Postman, curl, or HTTP client

**Base URL:** `http://localhost:3000/api`

---

## Quick Test Script

Create a test script to automate testing:

```bash
# Save as test-api.sh
#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "🧪 Testing PTGR API Endpoints"
echo "================================"
echo ""

# Test Health Check
echo "1. Testing Health Check..."
curl -X GET "$BASE_URL/health" | jq
echo ""

# Test Login (replace with real credentials)
echo "2. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"testpass"}')
echo "$LOGIN_RESPONSE" | jq

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
echo "Token: $TOKEN"
echo ""
```

---

## Step-by-Step Testing

### 1. Health Check

```bash
curl -X GET http://localhost:3000/api/health
```

**Expected:** 200 OK with health status

---

### 2. Authentication Tests

Authentication endpoints are now enhanced with validation, token rotation, and improved error handling.

#### 2.1 Login

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user with username and password. Returns access token and refresh token.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "password123"
  }'
```

**Postman Setup:**
1. Method: `POST`
2. URL: `{{base_url}}/auth/login`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": 1,
      "username": "user@example.com",
      "customer_id": 123,
      "first_name": "John",
      "last_name": "Doe",
      "roles": ["user"],
      "is_email_verified": 1,
      "is_kyc_verified": 0,
      "profile_picture": "https://...",
      "phone": "+1234567890",
      "phoneVerifid": 1
    }
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "username",
      "message": "username is required"
    },
    {
      "field": "password",
      "message": "password is required"
    }
  ]
}
```

**401 - Invalid Credentials:**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

**Postman Test Script (to save tokens):**
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set("access_token", jsonData.data.accessToken);
    pm.environment.set("refresh_token", jsonData.data.refreshToken);
    pm.environment.set("user_id", jsonData.data.user.user_id);
    console.log("✅ Tokens saved to environment variables");
}
```

**Important:** Save both `accessToken` and `refreshToken` for subsequent requests.

---

#### 2.2 Refresh Token

**Endpoint:** `POST /api/auth/refresh`

**Description:** Refresh access token using refresh token. **NEW:** Now implements token rotation - returns a new refresh token and revokes the old one.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

**Postman Setup:**
1. Method: `POST`
2. URL: `{{base_url}}/auth/refresh`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": 1,
      "username": "user@example.com",
      "customer_id": 123,
      "first_name": "John",
      "last_name": "Doe",
      "roles": ["user"],
      "is_email_verified": 1,
      "is_kyc_verified": 0,
      "profile_picture": "https://...",
      "phone": "+1234567890",
      "phoneVerifid": 1
    }
  }
}
```

**Important Notes:**
- The refresh endpoint now returns a **new refresh token** (token rotation)
- The old refresh token is automatically revoked
- **Always update your stored refresh token** with the new one from the response
- Tokens include the latest user data from the database

**Postman Test Script (to update tokens):**
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set("access_token", jsonData.data.accessToken);
    pm.environment.set("refresh_token", jsonData.data.refreshToken); // Update refresh token!
    console.log("✅ Tokens refreshed and saved");
} else {
    console.log("❌ Token refresh failed");
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "refreshToken",
      "message": "refresh token is required"
    }
  ]
}
```

**401 - Invalid/Expired Refresh Token:**
```json
{
  "success": false,
  "error": "jwt expired",
  "code": "TOKEN_EXPIRED"
}
```

---

#### 2.3 Logout

**Endpoint:** `POST /api/auth/logout`

**Description:** Logout user by revoking both access and refresh tokens. Requires authentication.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

**Postman Setup:**
1. Method: `POST`
2. URL: `{{base_url}}/auth/logout`
3. Headers:
   - `Authorization: Bearer {{access_token}}`
   - `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully logged out",
  "data": {
    "accessTokenRevoked": true,
    "refreshTokenRevoked": true
  }
}
```

**Postman Test Script:**
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    if (jsonData.data.accessTokenRevoked && jsonData.data.refreshTokenRevoked) {
        // Clear tokens from environment
        pm.environment.unset("access_token");
        pm.environment.unset("refresh_token");
        console.log("✅ Logged out successfully - tokens cleared");
    }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "refreshToken",
      "message": "refresh token is required"
    }
  ]
}
```

**401 - No Access Token:**
```json
{
  "success": false,
  "error": "No token provided",
  "code": "NO_AUTH_TOKEN"
}
```

---

#### 2.4 Google Login

**Endpoint:** `POST /api/auth/google-login`

**Description:** Authenticate using a Google **ID token**. This endpoint supports **both signup and login**.

**Prerequisite:** Set `GOOGLE_CLIENT_ID` in your server environment (see `DATABASE_SETUP.md`).

**How to get an ID token (recommended):**
- Use your frontend (Google Identity Services) to obtain an `id_token`, then paste it into Postman.

**How to get an ID token in Postman (OAuth 2.0 Authorization Code):**
1. In Postman create a new request (any URL)
2. Go to **Authorization** tab → Type: **OAuth 2.0**
3. Click **Get New Access Token** and use:
   - Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
   - Access Token URL: `https://oauth2.googleapis.com/token`
   - Client ID: `<your GOOGLE_CLIENT_ID>`
   - Client Secret: `<your GOOGLE_CLIENT_SECRET>`
   - Scope: `openid email profile`
   - Callback URL: `https://oauth.pstmn.io/v1/callback`
4. Complete the consent flow
5. In the token details, copy the **id_token**

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/google-login \
  -H "Content-Type: application/json" \
  -d '{
    "token": "google_id_token_here"
  }'
```

**Postman Setup:**
1. Method: `POST`
2. URL: `{{base_url}}/auth/google-login`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "token": "google_id_token_here"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Google login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": 1,
      "username": "user@example.com",
      "customer_id": 123
    }
  }
}
```

---

#### 2.5 Complete Authentication Workflow

**Testing Flow:**

1. **Login** → Save `accessToken` and `refreshToken`
2. **Use Access Token** → Make authenticated requests
3. **When Access Token Expires** → Use Refresh Token endpoint
4. **Update Refresh Token** → Save the new refresh token
5. **Continue Using Access Token** → Make more authenticated requests
6. **Logout** → Revoke both tokens

**Postman Collection Structure:**
```
Authentication/
  ├── Login
  ├── Refresh Token
  ├── Logout
  └── Google Login
```

**Postman Environment Variables:**
- `base_url`: `http://localhost:3000/api`
- `access_token`: (set after login/refresh)
- `refresh_token`: (set after login/refresh, updated after refresh)
- `user_id`: (set after login)

---

#### 2.6 Testing Protected Endpoints

After login, use the access token in the Authorization header:

**Example:**
```bash
curl -X GET http://localhost:3000/api/customers/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Postman Setup:**
- Add to Headers: `Authorization: Bearer {{access_token}}`
- Or use the Authorization tab → Type: Bearer Token → Token: `{{access_token}}`

---

#### 2.7 Common Authentication Testing Scenarios

**Scenario 1: Token Expiration**
1. Login and get tokens
2. Wait for access token to expire (default: 15 minutes)
3. Make a request with expired token → Should get `401 TOKEN_EXPIRED`
4. Use refresh token endpoint → Get new tokens
5. Continue with new access token

**Scenario 2: Token Rotation**
1. Login and get tokens
2. Use refresh token endpoint
3. Verify old refresh token is revoked (try using it → should fail)
4. Use new refresh token → Should work

**Scenario 3: Logout**
1. Login and get tokens
2. Logout with both tokens
3. Try using access token → Should get `401 TOKEN_REVOKED`
4. Try using refresh token → Should get `401 REFRESH_TOKEN_REVOKED`

---

#### 2.8 Error Handling Tips

- **401 INVALID_CREDENTIALS**: Check username/password
- **401 TOKEN_EXPIRED**: Use refresh token endpoint
- **401 TOKEN_REVOKED**: User logged out, need to login again
- **400 VALIDATION_ERROR**: Check request body format and required fields
- **500 SERVER_ERROR**: Check server logs, verify database connection
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

---

### 3. Customer Management Tests

#### 3.1 Create Customer
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: multipart/form-data" \
  -F "first_name=John" \
  -F "last_name=Doe" \
  -F "email=john.doe@example.com" \
  -F "phone=+1234567890" \
  -F "password=password123" \
  -F "source=https://example.com"
```

**Or with JSON:**
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "password": "password123",
    "source": "https://example.com"
  }'
```

#### 3.2 Get All Customers
```bash
curl -X GET "http://localhost:3000/api/customers?page=1&limit=10"
```

#### 3.3 Get Customer by ID
```bash
curl -X GET http://localhost:3000/api/customers/123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 3.4 Update Customer
```bash
curl -X PUT http://localhost:3000/api/customers/123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "phone": "+9876543210"
  }'
```

#### 3.5 Request Phone OTP
```bash
curl -X POST http://localhost:3000/api/customers/phone/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890"
  }'
```

#### 3.6 Verify Phone OTP
```bash
curl -X POST http://localhost:3000/api/customers/phone/verify-otp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "code": "123456"
  }'
```

#### 3.7 Send Verification Email
```bash
curl -X POST http://localhost:3000/api/customers/send-verification-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

#### 3.8 Verify Email
```bash
curl -X POST http://localhost:3000/api/customers/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "verification_token_from_email"
  }'
```

---

### 4. User Management Tests

#### 4.1 Forgot Password
```bash
curl -X POST http://localhost:3000/api/users/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com"
  }'
```

**Check email for reset link!**

#### 4.2 Reset Password
```bash
curl -X POST http://localhost:3000/api/users/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "newPassword": "newpassword123"
  }'
```

#### 4.3 Get All Users (Developer Only)
```bash
curl -X GET "http://localhost:3000/api/users?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 4.4 Create User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 123,
    "username": "newuser@example.com",
    "password": "password123",
    "role_id": 1
  }'
```

---

### 5. Course Access Tests

#### 5.1 Register for Course Access
```bash
curl -X POST http://localhost:3000/api/course-access/register \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "access_code": "PTGR2025"
  }'
```

#### 5.2 Get Subscription Status
```bash
curl -X GET http://localhost:3000/api/course-access \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 5.3 Get Subsection Content
```bash
curl -X GET http://localhost:3000/api/course-access/subsections/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 5.4 Complete Subsection
```bash
curl -X POST http://localhost:3000/api/course-access/subsections/1/complete \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true
  }'
```

#### 5.5 Submit Quiz
```bash
curl -X POST http://localhost:3000/api/course-access/sections/1/quiz/submit \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "1": [1],
      "2": [3, 4]
    }
  }'
```

---

### 5A. Academy (Multi-course) Tests (NEW)

#### 5A.1 List Courses (Public)
```bash
curl -X GET http://localhost:3000/api/academy/courses
```

#### 5A.2 Get Course By Slug (Public)
```bash
curl -X GET http://localhost:3000/api/academy/courses/web3-fundamentals
```

#### 5A.3 Check My Access (Per Course)
```bash
curl -X GET http://localhost:3000/api/academy/courses/web3-fundamentals/access \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 5A.4 Redeem Access Code (Per Course)
```bash
curl -X POST http://localhost:3000/api/academy/courses/web3-fundamentals/redeem \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "access_code": "PTGR2025"
  }'
```

---

### 6. Contest Tests

#### 6.1 List Contests
```bash
curl -X GET http://localhost:3000/api/contest
```

#### 6.2 Get Contest by Slug
```bash
curl -X GET http://localhost:3000/api/contest/winter-2025
```

#### 6.3 Join Contest
```bash
curl -X POST http://localhost:3000/api/contest/join \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contest_slug": "winter-2025",
    "country": "US",
    "exchange_user_id": "exchange123",
    "exchange_username": "trader123"
  }'
```

#### 6.4 Get My Contest Status
```bash
curl -X GET http://localhost:3000/api/contest/check/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 6.5 Get Leaderboard
```bash
curl -X GET "http://localhost:3000/api/contest/winter-2025/leaderboard?limit=10&country=US"
```

---

### 7. Talent Pool Tests

#### 7.1 Register for Talent Pool
```bash
curl -X POST http://localhost:3000/api/talent-pool/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "country": "US",
    "city": "San Francisco",
    "phone_number": "+1234567890",
    "age_range": "25-30",
    "gender": "female",
    "education_level": "bachelor",
    "years_experience": "3-5",
    "skills": ["JavaScript", "React"],
    "spoken_languages": ["English"],
    "preferred_work_type": "remote",
    "availability": "immediate"
  }'
```

#### 7.2 Get All Registrations
```bash
curl -X GET http://localhost:3000/api/talent-pool/registrations
```

#### 7.3 Get Registration Stats
```bash
curl -X GET http://localhost:3000/api/talent-pool/registrations/stats
```

---

### 8. Course Structure Tests

#### 8.1 Get All Chapters
```bash
curl -X GET "http://localhost:3000/api/chapters?page=1&limit=10"
```

#### 8.2 Create Chapter
```bash
curl -X POST http://localhost:3000/api/chapters \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Chapter 1: Introduction",
    "sort_order": 1
  }'
```

#### 8.3 Get Sections by Chapter
```bash
curl -X GET http://localhost:3000/api/sections/chapter/1
```

#### 8.4 Get Subsections by Section
```bash
curl -X GET http://localhost:3000/api/subsections/section/1
```

---

### 9. Quiz Management Tests

#### 9.1 Get Quiz
```bash
curl -X GET http://localhost:3000/api/subsection-quizzes/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 9.2 Create Question
```bash
curl -X POST http://localhost:3000/api/subsection-quizzes/1/questions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_html": "<p>What is Node.js?</p>",
    "sort_order": 1
  }'
```

#### 9.3 Create Option
```bash
curl -X POST http://localhost:3000/api/subsection-quizzes/questions/1/options \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text_html": "<p>A JavaScript runtime</p>",
    "is_correct": true,
    "sort_order": 1
  }'
```

---

## Automated Test Script

Save this as `test-all-endpoints.js`:

```javascript
const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

let accessToken = null;
let refreshToken = null;

async function testEndpoint(name, method, url, data = null, headers = {}) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   ${method} ${url}`);
    
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`   ✅ Success: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200));
    
    return response.data;
  } catch (error) {
    console.log(`   ❌ Error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.log(`   Error Data:`, JSON.stringify(error.response.data, null, 2).substring(0, 200));
    }
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests');
  console.log('=====================\n');
  
  // 1. Health Check
  await testEndpoint('Health Check', 'GET', '/health');
  
  // 2. Login (replace with real credentials)
  const loginData = await testEndpoint('Login', 'POST', '/auth/login', {
    username: 'test@example.com',
    password: 'testpass'
  });
  
  if (loginData?.data?.accessToken) {
    accessToken = loginData.data.accessToken;
    refreshToken = loginData.data.refreshToken;
    console.log('\n✅ Authentication successful!');
  } else {
    console.log('\n⚠️  Login failed - skipping authenticated tests');
    return;
  }
  
  const authHeaders = {
    'Authorization': `Bearer ${accessToken}`
  };
  
  // 3. Get Subscription Status
  await testEndpoint('Get Subscription Status', 'GET', '/course-access', null, authHeaders);
  
  // 4. Get My Contest Status
  await testEndpoint('Get My Contest Status', 'GET', '/contest/check/me', null, authHeaders);
  
  // 5. List Contests
  await testEndpoint('List Contests', 'GET', '/contest');
  
  // 6. Get All Chapters
  await testEndpoint('Get All Chapters', 'GET', '/chapters');
  
  // 7. Get All Customers
  await testEndpoint('Get All Customers', 'GET', '/customers?limit=5');
  
  console.log('\n✅ All tests completed!');
}

runTests().catch(console.error);
```

**Run the test script:**
```bash
npm install axios  # if not already installed
node test-all-endpoints.js
```

---

## Postman Collection

You can import this into Postman:

1. Create a new Collection: "PTGR API"
2. Add environment variables:
   - `base_url`: `http://localhost:3000/api`
   - `access_token`: (will be set after login)
   - `refresh_token`: (will be set after login)

3. Create folders for each section:
   - Authentication
   - Customers
   - Users
   - Course Access
   - Contests
   - Talent Pool
   - Course Structure
   - Quizzes

---

## Common Issues

### 401 Unauthorized
- Check if token is included in Authorization header
- Verify token hasn't expired
- Use refresh token to get new access token

### 403 Forbidden
- Check user role/permissions
- Verify you're accessing your own resources (for ownership checks)

### 404 Not Found
- Verify endpoint URL is correct
- Check if resource ID exists in database

### 500 Server Error
- Check server logs
- Verify database connection
- Check environment variables

---

## Testing Checklist

- [ ] Health check endpoint
- [ ] User registration/login
- [ ] Password reset flow
- [ ] Email verification
- [ ] Phone OTP verification
- [ ] Course access registration
- [ ] Course content access
- [ ] Quiz submission
- [ ] Contest joining
- [ ] Talent pool registration
- [ ] CRUD operations for chapters/sections/subsections
- [ ] Quiz management (create/update/delete)

---

**Happy Testing! 🚀**

