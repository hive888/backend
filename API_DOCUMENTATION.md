# PTGR API Documentation

**Base URL:** `http://localhost:3000/api` (or your server URL)  
**API Version:** 1.0.0  
**Last Updated:** 2025-01-XX

---

## Table of Contents

1. [Error Handling](#error-handling)
2. [Authentication](#authentication)
3. [Health Check](#health-check)
4. [Customer Management](#customer-management)
5. [User Management](#user-management)
6. [Course Access](#course-access)
7. [Academy (Multi-course)](#academy-multi-course)
8. [Contests](#contests)
9. [Talent Pool](#talent-pool)
10. [Course Structure](#course-structure)
11. [Quiz Management](#quiz-management)
12. [Webhooks](#webhooks)

---

## Error Handling

All API endpoints follow a consistent error response format. Errors are returned as JSON objects with the following structure:

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "message": "Additional details (optional)"
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `MISSING_BODY` | Request body is missing or invalid |
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 400 | `INVALID_BODY_FORMAT` | Request body is not a valid JSON object |
| 401 | `NO_AUTH_TOKEN` | Authorization token is missing |
| 401 | `INVALID_CREDENTIALS` | Invalid username/password |
| 401 | `INVALID_TOKEN` | Token is invalid or malformed |
| 401 | `TOKEN_EXPIRED` | Token has expired |
| 401 | `TOKEN_REVOKED` | Token has been revoked |
| 401 | `NO_REFRESH_TOKEN` | Refresh token is missing |
| 403 | `UNAUTHORIZED` | User lacks required permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 404 | `USER_NOT_FOUND` | User does not exist |
| 404 | `EMAIL_NOT_FOUND` | Email address not found |
| 409 | `DUPLICATE_ENTRY` | Resource already exists |
| 500 | `SERVER_ERROR` | Internal server error |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

### Error Response Examples

#### Missing Request Body (400)
```json
{
  "success": false,
  "error": "Request body is required",
  "code": "MISSING_BODY",
  "message": "This endpoint requires a JSON request body"
}
```

#### Validation Error (400)
```json
{
  "success": false,
  "error": "Username and password are required",
  "code": "VALIDATION_ERROR"
}
```

#### Invalid Credentials (401)
```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

#### Missing Token (401)
```json
{
  "success": false,
  "error": "No token provided",
  "code": "NO_AUTH_TOKEN"
}
```

#### Token Expired (401)
```json
{
  "success": false,
  "error": "Token has expired",
  "code": "TOKEN_EXPIRED"
}
```

#### Not Found (404)
```json
{
  "success": false,
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

#### Duplicate Entry (409)
```json
{
  "success": false,
  "error": "Email already exists",
  "code": "DUPLICATE_ENTRY"
}
```

#### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

### Success Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Best Practices for Error Handling

1. **Always check the `success` field** to determine if the request was successful
2. **Use the `code` field** for programmatic error handling
3. **Display the `error` field** to users as it contains human-readable messages
4. **Handle 401 errors** by redirecting to login or refreshing tokens
5. **Handle 400 errors** by validating input and showing validation messages
6. **Log server errors (500)** and provide user-friendly error messages

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Login
**POST** `/api/auth/login`

Authenticate user and get access tokens.

**Request Body:**
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
      "customer_id": 123,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "profile_picture": "https://...",
      "phone": "+1234567890",
      "is_email_verified": 1,
      "is_phone_verified": 0,
      "is_kyc_verified": 0
    }
  }
}
```

**Error Responses:**

- **400 - Missing Body:**
```json
{
  "success": false,
  "error": "Request body is required",
  "code": "MISSING_BODY"
}
```

- **400 - Validation Error:**
```json
{
  "success": false,
  "error": "Username and password are required",
  "code": "VALIDATION_ERROR"
}
```

- **401 - Invalid Credentials:**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

- **500 - Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

### Google Login
**POST** `/api/auth/google-login`

Authenticate using a Google **ID token**.

**Behavior:** This endpoint handles **both signup and login**.
- If the user exists → logs in and returns tokens
- If the user does not exist → creates a `customers` + `users` record, then returns tokens

**Request Body:**
```json
{
  "token": "google_id_token_here"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Google signup successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "customer_id": 123,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "profile_picture": "https://...",
      "phone": "+1234567890",
      "is_email_verified": 1,
      "is_phone_verified": 0,
      "is_kyc_verified": 0
    },
    "isNewUser": true
  }
}
```

**Error Responses:**

- **400 - Missing/Invalid Token:**
```json
{
  "success": false,
  "error": "Google token is required",
  "code": "VALIDATION_ERROR"
}
```

- **400 - Google Token Missing Email:**
```json
{
  "success": false,
  "error": "Google token does not include an email address",
  "code": "GOOGLE_EMAIL_MISSING"
}
```

- **500 - Server Error:**
```json
{
  "success": false,
  "error": "Google login failed",
  "code": "GOOGLE_AUTH_ERROR"
}
```

### Refresh Token
**POST** `/api/auth/refresh`

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "new_access_token"
  }
}
```

**Error Responses:**

- **401 - Missing/Invalid Refresh Token:**
```json
{
  "success": false,
  "error": "Refresh token required",
  "code": "NO_REFRESH_TOKEN"
}
```

- **401 - Token Revoked:**
```json
{
  "success": false,
  "error": "Session expired",
  "code": "REFRESH_TOKEN_REVOKED"
}
```

### Logout
**POST** `/api/auth/logout` 🔒

Revoke access and refresh tokens.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully logged out",
  "details": {
    "accessTokenRevoked": true,
    "refreshTokenRevoked": true
  }
}
```

**Error Responses:**

- **400 - Missing Token:**
```json
{
  "success": false,
  "error": "No refresh token provided",
  "code": "NO_REFRESH_TOKEN"
}
```

- **500 - Logout Error:**
```json
{
  "success": false,
  "error": "Logout failed",
  "code": "LOGOUT_ERROR"
}
```

### Check Static Password
**POST** `/api/auth/check-static-password`

Check if password matches static password (for special access).

**Request Body:**
```json
{
  "password": "PTGR2025!"
}
```

---

## Health Check

### Get Health Status
**GET** `/api/health`

Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XXT00:00:00.000Z",
  "environment": "development",
  "uptime": 12345.67
}
```

---

## Customer Management

### Create Customer
**POST** `/api/customers`

Create a new customer account.

**Request:** `multipart/form-data` or `application/json`

**Body Fields (Validation Rules):**
- `email` (string, **required**) - Valid email format, max 255 characters
- `phone` (string, **required**) - 8-20 characters, valid phone format, cannot be exactly 10 characters
- `first_name` (string, **required**) - 1-100 characters, letters, spaces, hyphens, apostrophes only
- `last_name` (string, **required**) - 1-100 characters, letters, spaces, hyphens, apostrophes only
- `password` (string, optional) - Min 8 characters, must contain uppercase, lowercase, and number
- `profile_picture` (string URL, optional) - Valid URL format
- `date_of_birth` (date, optional) - ISO 8601 format, user must be at least 13 years old
- `gender` (string, optional) - One of: `male`, `female`, `other`, `prefer_not_to_say`
- `customer_type` (string, optional) - One of: `individual`, `enterprise`
- `from` (string, optional) - One of: `google`, `local`
- `source` (string, optional) - Max 100 characters

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "customer_id": 123,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "profile_picture": "https://..."
  }
}
```

**Error Responses:**

- **400 - Validation Error:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "email",
      "message": "email is required"
    },
    {
      "field": "phone",
      "message": "phone number must be between 8 and 20 characters"
    }
  ]
}
```

- **409 - Duplicate Entry:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "email",
      "message": "email already exists"
    }
  ]
}
```


### Get All Customers
**GET** `/api/customers`

Get list of all customers (public endpoint).

**Query Parameters (Validation):**
- `page` (number, optional) - Must be positive integer, default: 1
- `limit` (number, optional) - Between 1-100, default: 10
- `search` (string, optional) - Max 100 characters, searches in first_name, last_name, email

**Success Response (200):**
```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "itemsPerPage": 10,
    "totalItems": 100,
    "totalPages": 10
  },
  "summary": {...}
}
```

### Get Customer by ID
**GET** `/api/customers/:id` 🔒

Get customer details by ID.

**Authorization:** Must be the customer owner or developer role.

**Parameters:**
- `id` (integer, **required**) - Positive integer

**Success Response (200):**
```json
{
  "success": true,
  "message": "Customer retrieved successfully",
  "data": {
    "customer_id": 123,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  }
}
```

**Error Responses:**

- **400 - Invalid ID:**
```json
{
  "success": false,
  "error": "Customer ID is required",
  "code": "VALIDATION_ERROR"
}
```

- **404 - Not Found:**
```json
{
  "success": false,
  "error": "Customer not found",
  "code": "CUSTOMER_NOT_FOUND"
}
```

### Update Customer
**PUT** `/api/customers/:id` 🔒

Update customer information.

**Authorization:** Must be the customer owner or developer role.

**Request:** `multipart/form-data` or `application/json`

**Body Fields (All Optional, but validated if provided):**
- `first_name` (string) - 1-100 characters, letters/spaces/hyphens/apostrophes only
- `last_name` (string) - 1-100 characters, letters/spaces/hyphens/apostrophes only
- `email` (string) - Valid email format, max 255 characters
- `phone` (string) - 8-20 characters, valid phone format
- `profile_picture` (file or string URL) - Image file or valid URL
- `date_of_birth` (date) - ISO 8601 format, user must be at least 13 years old
- `gender` (string) - One of: `male`, `female`, `other`, `prefer_not_to_say`

**Note:** Regular customers can only update: `first_name`, `last_name`, `phone`, `date_of_birth`, `gender`, `profile_picture`. Sensitive fields (`is_email_verified`, `is_phone_verified`, `is_kyc_verified`, `customer_type`) cannot be updated.

### Get My Profile
**GET** `/api/customers/me` 🔒

Get the currently authenticated customer's profile (customer id is taken from the access token).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Customer retrieved successfully",
  "data": {
    "customer_id": 123,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### Update My Profile
**PUT** `/api/customers/me` 🔒

Update the currently authenticated customer's profile (customer id is taken from the access token).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body (same rules as Update Customer, all optional):**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+251911234567",
  "gender": "male",
  "date_of_birth": "1990-05-18"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "customer_id": 123,
    "first_name": "John",
    ...
  }
}
```

**Error Responses:**

- **400 - Validation Error:**
```json
{
  "success": false,
  "error": "Request body is required",
  "code": "MISSING_BODY"
}
```

- **409 - Duplicate Entry:**
```json
{
  "success": false,
  "error": "Email already exists",
  "code": "DUPLICATE_ENTRY",
  "field": "email"
}
```

### Delete Customer
**DELETE** `/api/customers/:id` 🔒

Delete a customer account (soft delete).

**Authorization:** Developer role only.

**Parameters:**
- `id` (integer, **required**) - Positive integer

**Success Response (200):**
```json
{
  "success": true,
  "message": "Customer deleted successfully",
  "data": {
    "customer_id": 123,
    "deletion_type": "soft"
  }
}
```

### Get Full Profile
**GET** `/api/customers/full-profile` 🔒

Get customer profile with addresses.

**Authorization:** Must be authenticated.

### Update Full Profile
**PUT** `/api/customers/update/full-profile` 🔒

Update complete customer profile including addresses.

**Request:** `multipart/form-data`

### Update Profile Picture
**PATCH** `/api/customers/:id/profile-picture` 🔒

Update customer profile picture.

**Authorization:** Developer role only.

**Request:** `multipart/form-data` with `profile_picture` file.

### Get Customer Summary
**GET** `/api/customers/summary` 🔒

Get customer statistics summary.

**Authorization:** Developer role only.

### Request Phone OTP
**POST** `/api/customers/phone/request-otp`

Request OTP for phone verification.

**Request Body:**
- `phone` (string, **required**) - 8-20 characters, valid phone format
- `channel` (string, optional) - One of: `sms`, `email` (default: `sms`)

**Rate Limit:** 10 requests per 10 minutes per phone number

**Success Response (200):**
```json
{
  "success": true,
  "message": "Verification code sent",
  "data": {
    "to": "+1234567890",
    "channel": "sms",
    "message": "SMS sent successfully"
  }
}
```

**Error Responses:**

- **400 - Validation Error:**
```json
{
  "success": false,
  "errors": [
    {
      "field": "phone",
      "message": "phone is required"
    }
  ]
}
```

- **429 - Too Many Requests:**
```json
{
  "success": false,
  "code": "TOO_MANY_REQUESTS",
  "error": "Please wait before requesting another code",
  "retry_after_seconds": 45
}
```

### Verify Phone OTP
**POST** `/api/customers/phone/verify-otp` 🔒

Verify phone OTP code.

**Authorization:** Must be authenticated.

**Request Body:**
- `phone` (string, **required**) - 8-20 characters
- `code` (string, **required**) - 4-8 characters, numbers only

**Success Response (200):**
```json
{
  "success": true,
  "message": "Phone verified successfully",
  "data": {
    "customer_id": 123,
    "is_phone_verified": true
  }
}
```

**Error Responses:**

- **400 - Invalid Code:**
```json
{
  "success": false,
  "error": "Invalid or expired verification code",
  "code": "INVALID_OTP"
}
```

### Send Verification Email
**POST** `/api/customers/send-verification-email`

Send email verification link.

**Request Body:**
- `email` (string, **required**) - Valid email format

**Success Response (200):**
```json
{
  "success": true,
  "message": "Verification email has been sent"
}
```

**Error Responses:**

- **400 - Already Verified:**
```json
{
  "success": false,
  "error": "Email is already verified",
  "code": "ALREADY_VERIFIED"
}
```

- **404 - Email Not Found:**
```json
{
  "success": false,
  "error": "Email address not found in our system",
  "code": "EMAIL_NOT_FOUND"
}
```

### Verify Email
**POST** `/api/customers/verify-email`

Verify email with token.

**Request Body:**
- `token` (string, **required**) - Min 10 characters, valid JWT token

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email successfully verified",
  "data": {
    "customer_id": 123,
    "is_email_verified": true,
    "email_verified_at": "2025-01-09T10:00:00.000Z"
  }
}
```

**Error Responses:**

- **400 - Token Expired:**
```json
{
  "success": false,
  "error": "Verification token has expired",
  "code": "TOKEN_EXPIRED"
}
```

- **400 - Invalid Token:**
```json
{
  "success": false,
  "error": "Invalid verification token",
  "code": "INVALID_TOKEN"
}
```

---

## User Management

### Get All Users
**GET** `/api/users` 🔒

Get list of all users.

**Authorization:** Developer role only.

**Query Parameters:**
- `limit` (number, optional)
- `offset` (number, optional)
- `role_id` (number, optional)
- `username` (string, optional)

### Create User
**POST** `/api/users`

Create a new user account.

**Request Body:**
```json
{
  "customer_id": 123,
  "username": "user@example.com",
  "password": "password123",
  "role_id": 1
}
```

### Get User by ID
**GET** `/api/users/:id` 🔒

Get user details by ID.

**Authorization:** Developer role only.

### Update User
**PUT** `/api/users/:id` 🔒

Update user information.

**Authorization:** Must be the user owner.

**Request Body:**
```json
{
  "username": "newemail@example.com",
  "role_id": 2
}
```

### Forgot Password
**POST** `/api/users/forgot-password`

Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset link has been sent to your email"
}
```

### Reset Password
**POST** `/api/users/reset-password`

Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPassword123"
}
```

**Password Rules:**
- Minimum 8 characters
- Must include at least 1 uppercase letter, 1 lowercase letter, and 1 number

**Error Responses:**

- **400 - Weak Password:**
```json
{
  "success": false,
  "error": "Password must be at least 8 characters and include uppercase, lowercase, and a number",
  "code": "WEAK_PASSWORD"
}
```

- **400 - Token Expired:**
```json
{
  "success": false,
  "error": "Reset link has expired",
  "code": "TOKEN_EXPIRED"
}
```

- **400 - Invalid Token:**
```json
{
  "success": false,
  "error": "Invalid token",
  "code": "INVALID_TOKEN"
}
```

### Get All Roles
**GET** `/api/users/roles` 🔒

Get list of all user roles.

**Authorization:** Developer role only.

### Create Role
**POST** `/api/users/roles` 🔒

Create a new user role.

**Authorization:** Developer role only.

**Request Body:**
```json
{
  "role_name": "moderator",
  "description": "Moderator role"
}
```

### Get Role Statistics
**GET** `/api/users/roles/statistics` 🔒

Get statistics about user roles.

**Authorization:** Developer role only.

---

## Course Access

### Register for Course Access
**POST** `/api/course-access/register` 🔒

Register for course access using access code.
If the access code is free (`access_codes.payment_amount = 0`), registration happens immediately and Stripe is skipped.
If the access code requires payment (`payment_amount > 0`), the API returns `decision=PAYMENT_REQUIRED` with a Stripe `checkout_url`.

**Request Body:**
```json
{
  "access_code": "PTGR2025"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Course access granted",
  "data": {
    "registration_id": 123,
    "status": "active"
  }
}
```

### Get Subscription Status
**GET** `/api/course-access` 🔒

Get current course subscription status.

**Response:**
```json
{
  "success": true,
  "data": {
    "has_access": true,
    "registration_id": 123,
    "status": "active"
  }
}
```

### Get Subsection Content
**GET** `/api/course-access/subsections/:id` 🔒

Get content for a specific subsection.

**Response:**
```json
{
  "success": true,
  "data": {
    "subsection_id": 1,
    "title": "Introduction",
    "content": "...",
    "is_locked": false,
    "lock_reason": null
  }
}
```

### Complete Subsection
**POST** `/api/course-access/subsections/:id/complete` 🔒

Mark subsection as completed.

**Request Body:**
```json
{
  "completed": true
}
```

### Create Subsection Quiz
**POST** `/api/course-access/sections/:id/quiz` 🔒

Create a quiz for a subsection.

**Request Body:**
```json
{
  "questions": [
    {
      "prompt_html": "<p>What is...?</p>",
      "options": [
        {"text_html": "Option 1", "is_correct": true},
        {"text_html": "Option 2", "is_correct": false}
      ]
    }
  ]
}
```

### Get Subsection Quiz Info
**GET** `/api/course-access/sections/:id/quiz` 🔒

Get quiz information for a subsection.

### Submit Subsection Quiz
**POST** `/api/course-access/sections/:id/quiz/submit` 🔒

Submit quiz answers.

**Request Body:**
```json
{
  "answers": {
    "1": [1, 2],
    "2": [3]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "passed": true,
    "section_progress": {
      "completed": 5,
      "total": 10,
      "percent": 50
    }
  }
}
```

### Get Subsection Quiz Admin View
**GET** `/api/course-access/sections/:id/quiz/admin` 🔒

Get quiz with correct answers (admin view).

---

## Contests

### Create Contest
**POST** `/api/contest` 🔒

Create a new trading contest.

**Request Body:**
```json
{
  "slug": "winter-2025",
  "description": "Winter Trading Contest 2025",
  "type": "demo"
}
```

### List Contests
**GET** `/api/contest`

Get list of all contests.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "winter-2025",
      "description": "Winter Trading Contest 2025",
      "type": "demo",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get Contest by Slug
**GET** `/api/contest/:slug`

Get contest details by slug.

### Update Contest
**PATCH** `/api/contest/:slug` 🔒

Update contest information.

**Request Body:**
```json
{
  "description": "Updated description",
  "type": "live"
}
```

### Delete Contest
**DELETE** `/api/contest/:slug` 🔒

Delete a contest.

### Join Contest
**POST** `/api/contest/join` 🔒

Join a trading contest.

**Request Body:**
```json
{
  "contest_slug": "winter-2025",
  "country": "US",
  "exchange_user_id": "exchange123",
  "exchange_username": "trader123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Joined contest successfully.",
  "data": {
    "registration_id": 123,
    "contest_id": 1
  }
}
```

### Get My Contest Status
**GET** `/api/contest/check/me` 🔒

Get current user's contest registrations and status.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "registration_id": 123,
      "contest": {
        "id": 1,
        "slug": "winter-2025",
        "description": "Winter Trading Contest"
      },
      "latest_metrics": {
        "totalWalletBalance": 10000,
        "netProfit": 500,
        "tradesCount": 25
      }
    }
  ]
}
```

### Get Leaderboard
**GET** `/api/contest/:slug/leaderboard`

Get contest leaderboard.

**Query Parameters:**
- `limit` (number, optional, default: 100)
- `country` (string, optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "registration_id": 123,
      "customer_id": 456,
      "exchange_username": "trader123",
      "net_profit": 5000,
      "rank_position": 1
    }
  ]
}
```

### List Registrations by Contest
**GET** `/api/contest/:slug/registrations` 🔒

Get all registrations for a contest.

### Upsert Contest Metrics
**POST** `/api/contest/registrations/:id/metrics`

Update contest metrics for a registration.

**Request Body:**
```json
{
  "totalWalletBalance": 10000,
  "totalUnrealizedProfit": 500,
  "netProfit": 1000,
  "tradesCount": 25,
  "lastUpdated": "2025-01-01T00:00:00.000Z"
}
```

---

## Talent Pool

### Register for Talent Pool
**POST** `/api/talent-pool/register`

Submit talent pool registration.

**Request Body:**
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "country": "US",
  "city": "New York",
  "phone_number": "+1234567890",
  "age_range": "25-30",
  "gender": "male",
  "education_level": "bachelor",
  "years_experience": "3-5",
  "skills": ["JavaScript", "Node.js"],
  "spoken_languages": ["English", "Spanish"],
  "preferred_work_type": "remote",
  "availability": "immediate",
  "heard_about_us": "website",
  "skills_description": "Experienced developer..."
}
```

### Get All Registrations
**GET** `/api/talent-pool/registrations`

Get all talent pool registrations.

**Query Parameters:**
- `status` (number, optional)

### Get Registration Stats
**GET** `/api/talent-pool/registrations/stats`

Get statistics about talent pool registrations.

### Get Filtered Registrations
**GET** `/api/talent-pool/registrations/filter`

Get filtered talent pool registrations.

**Query Parameters:**
- `status`, `country`, `education_level`, `years_experience`, `preferred_work_type`, `availability`, `search`

### Get Status Definitions
**GET** `/api/talent-pool/registrations/status-definitions`

Get status definitions for talent pool registrations.

### Get Registration by ID
**GET** `/api/talent-pool/registrations/:id`

Get specific talent pool registration.

### Update Registration Status
**PUT** `/api/talent-pool/registrations/:id/status`

Update registration status.

**Request Body:**
```json
{
  "status": 1
}
```

### Update Registration
**PUT** `/api/talent-pool/registrations/:id`

Update registration details.

### Delete Registration
**DELETE** `/api/talent-pool/registrations/:id`

Delete a registration.

---

## Course Structure

### Chapters

#### Get All Chapters
**GET** `/api/chapters`

**Query Parameters:**
- `page` (number, optional)
- `limit` (number, optional)
- `sortBy` (string, optional, default: "sort_order")
- `order` (string, optional, "ASC" or "DESC")

#### Get Chapter by ID
**GET** `/api/chapters/:id`

#### Create Chapter
**POST** `/api/chapters`

**Request Body:**
```json
{
  "title": "Chapter 1: Introduction",
  "sort_order": 1
}
```

#### Update Chapter
**PUT** `/api/chapters/:id`

**Request Body:**
```json
{
  "title": "Updated Title",
  "sort_order": 2
}
```

#### Delete Chapter
**DELETE** `/api/chapters/:id`

### Sections

#### Get All Sections
**GET** `/api/sections`

**Query Parameters:**
- `page`, `limit`, `sortBy`, `order`

#### Get Sections by Chapter
**GET** `/api/sections/chapter/:chapterId`

#### Get Section by ID
**GET** `/api/sections/:id`

#### Create Section
**POST** `/api/sections`

**Request Body:**
```json
{
  "chapter_id": 1,
  "title": "Section 1.1",
  "sort_order": 1
}
```

#### Update Section
**PUT** `/api/sections/:id`

#### Delete Section
**DELETE** `/api/sections/:id`

### Subsections

#### Get All Subsections
**GET** `/api/subsections`

**Query Parameters:**
- `page`, `limit`, `sortBy`, `order`

#### Get Subsections by Section
**GET** `/api/subsections/section/:sectionId`

#### Get Subsection by ID
**GET** `/api/subsections/:id`

#### Create Subsection
**POST** `/api/subsections`

**Request Body:**
```json
{
  "section_id": 1,
  "title": "Subsection 1.1.1",
  "content": "Content here...",
  "sort_order": 1,
  "quiz_pass_score": 70
}
```

#### Update Subsection
**PUT** `/api/subsections/:id`

#### Delete Subsection
**DELETE** `/api/subsections/:id`

---

## Quiz Management

### Get Quiz
**GET** `/api/subsection-quizzes/:subsectionId` 🔒

Get quiz for a subsection.

**Response:**
```json
{
  "success": true,
  "data": {
    "subsection_id": 1,
    "questions": [
      {
        "id": 1,
        "prompt_html": "<p>Question text</p>",
        "options": [
          {"id": 1, "text_html": "Option 1", "is_correct": true},
          {"id": 2, "text_html": "Option 2", "is_correct": false}
        ]
      }
    ]
  }
}
```

### Create Question
**POST** `/api/subsection-quizzes/:subsectionId/questions` 🔒

Create a new quiz question.

**Request Body:**
```json
{
  "prompt_html": "<p>What is...?</p>",
  "sort_order": 1
}
```

### Update Question
**PUT** `/api/subsection-quizzes/questions/:questionId` 🔒

Update a quiz question.

**Request Body:**
```json
{
  "prompt_html": "<p>Updated question</p>",
  "sort_order": 2
}
```

### Delete Question
**DELETE** `/api/subsection-quizzes/questions/:questionId` 🔒

Delete a quiz question.

### Create Option
**POST** `/api/subsection-quizzes/questions/:questionId/options` 🔒

Add an option to a question.

**Request Body:**
```json
{
  "text_html": "<p>Option text</p>",
  "is_correct": true,
  "sort_order": 1
}
```

### Update Option
**PUT** `/api/subsection-quizzes/options/:optionId` 🔒

Update a quiz option.

**Request Body:**
```json
{
  "text_html": "<p>Updated option</p>",
  "is_correct": false,
  "sort_order": 2
}
```

### Delete Option
**DELETE** `/api/subsection-quizzes/options/:optionId` 🔒

Delete a quiz option.

---

## Webhooks

### Stripe Webhook
**POST** `/api/webhook/stripe-webhook`

Handle Stripe payment webhooks.

**Note:** This endpoint expects raw Stripe webhook events. Configure in Stripe dashboard.

---

## Error Responses

All endpoints may return the following error formats:

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

### Authentication Error (401)
```json
{
  "success": false,
  "error": "No token provided",
  "code": "NO_AUTH_TOKEN"
}
```

### Authorization Error (403)
```json
{
  "success": false,
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

---

## Rate Limiting

Some endpoints have rate limiting:
- Phone OTP requests: 10 requests per 10 minutes
- Other endpoints may have rate limiting based on server configuration

---

## Notes

- 🔒 = Requires authentication (Bearer token)
- All timestamps are in ISO 8601 format
- File uploads use `multipart/form-data`
- JSON endpoints use `application/json`
- Pagination defaults: `page=1`, `limit=10` (unless specified)

---

## Testing

See `API_TESTING_GUIDE.md` for detailed testing instructions and examples.

---

## Academy (Multi-course)

### List Courses
**GET** `/api/academy/courses`

Public course catalog.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Courses retrieved successfully",
  "data": [
    {
      "id": 1,
      "slug": "web3-fundamentals",
      "title": "Web3 Fundamentals",
      "short_description": "Learn the basics of blockchain and Web3.",
      "detailed_description": "Full description...",
      "thumbnail_url": "https://...",
      "is_active": 1
    }
  ]
}
```

### Create Course (Developer Only)
**POST** `/api/academy/courses` 🔒 (role: `developer`)

Create a new course in the Academy catalog.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "slug": "self-study",
  "title": "Self Study Program",
  "short_description": "PTGR Self Study",
  "detailed_description": "Full description...",
  "thumbnail_url": "https://...",
  "is_active": true
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "id": 1,
    "slug": "self-study",
    "title": "Self Study Program",
    "short_description": "PTGR Self Study",
    "detailed_description": "Full description...",
    "thumbnail_url": "https://...",
    "is_active": 1
  }
}
```

**Error Responses:**
- `409 DUPLICATE_ENTRY`: slug already exists

### Get Course By Slug
**GET** `/api/academy/courses/:slug`

Public course details.

### Check My Access (Per Course)
**GET** `/api/academy/courses/:slug/access` 🔒

Checks if the authenticated customer has access to this specific course.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Course access checked",
  "data": {
    "course": { "id": 1, "slug": "web3-fundamentals", "title": "Web3 Fundamentals" },
    "has_access": false,
    "status": "none",
    "expires_at": null
  }
}
```

### Redeem Access Code (Per Course)
**POST** `/api/academy/courses/:slug/redeem` 🔒

Redeem an access code for a specific course. The access code must belong to that course (by `access_codes.course_id`).
If the code is free (`access_codes.payment_amount = 0`), no Stripe payment is required (access is granted immediately).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "access_code": "PTGR2025"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Course access granted",
  "data": {
    "course": { "id": 1, "slug": "web3-fundamentals", "title": "Web3 Fundamentals" },
    "has_access": true,
    "code_stats": { "code": "PTGR2025", "remaining": 99 }
  }
}
```

