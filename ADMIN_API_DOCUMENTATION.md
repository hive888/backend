# Admin Dashboard API Documentation

**Base URL:** `http://localhost:3000/api/admin`  
**API Version:** 1.0.0  
**Authorization:** All endpoints require authentication with `developer` role

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard Overview](#dashboard-overview)
3. [Customer Management](#customer-management)
4. [Talent Pool Management](#talent-pool-management)
5. [Contest Management](#contest-management)
6. [Access Code Management](#access-code-management)
7. [Analytics & Reports](#analytics--reports)
8. [Error Handling](#error-handling)

---

## Authentication

All admin endpoints require:
- **Authorization Header:** `Authorization: Bearer <access_token>`
- **Role:** User must have `developer` role

**Getting Access Token:**

First, login using the auth endpoint:
```
POST /api/auth/login
{
  "username": "your_username",
  "password": "your_password"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Error Response (403 Forbidden):**
```json
{
  "success": false,
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

---

## Dashboard Overview

### Get Dashboard Statistics
**GET** `/api/admin/dashboard` 🔒

Get comprehensive dashboard statistics including overview metrics, trends, and recent activity.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "overview": {
      "customers": {
        "total_customers": 1250,
        "active_customers": 1100,
        "inactive_customers": 150,
        "email_verified": 980,
        "phone_verified": 850,
        "kyc_verified": 720,
        "individual": 1000,
        "enterprise": 250,
        "new_today": 15,
        "new_this_week": 120,
        "new_this_month": 450
      },
      "users": {
        "total_users": 1250,
        "users_with_customers": 1200,
        "local_auth": 800,
        "google_auth": 400
      },
      "contests": {
        "total_contests": 5,
        "total_registrations": 450,
        "unique_participants": 380,
        "contests_created_today": 0
      },
      "talent_pool": {
        "total_registrations": 280,
        "pending": 120,
        "approved": 140,
        "rejected": 20,
        "new_today": 8
      }
    },
    "trends": {
      "customers": {
        "labels": ["2025-01-03", "2025-01-04", "2025-01-05", "2025-01-06", "2025-01-07", "2025-01-08", "2025-01-09"],
        "data": [12, 15, 18, 10, 14, 16, 15]
      },
      "revenue": {
        "labels": [],
        "data": []
      }
    },
    "recent_activity": {
      "new_customers": [
        {
          "customer_id": 1251,
          "first_name": "John",
          "last_name": "Doe",
          "email": "john@example.com",
          "customer_type": "individual",
          "created_at": "2025-01-09T10:30:00.000Z"
        },
        {
          "customer_id": 1250,
          "first_name": "Jane",
          "last_name": "Smith",
          "email": "jane@example.com",
          "customer_type": "enterprise",
          "created_at": "2025-01-09T09:15:00.000Z"
        }
      ]
    }
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to retrieve dashboard statistics",
  "code": "SERVER_ERROR"
}
```

---

## Customer Management

### Get Customers List
**GET** `/api/admin/customers` 🔒

Get paginated list of customers with advanced filtering options.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page |
| `search` | string | No | - | Search by name, email, or phone |
| `customer_type` | string | No | - | Filter by type: `individual` or `enterprise` |
| `is_active` | boolean | No | - | Filter by active status: `true` or `false` |
| `is_kyc_verified` | boolean | No | - | Filter by KYC verification status |
| `is_email_verified` | boolean | No | - | Filter by email verification status |
| `sort_by` | string | No | `created_at` | Sort field: `created_at`, `updated_at`, `first_name`, `last_name`, `email` |
| `sort_order` | string | No | `DESC` | Sort direction: `ASC` or `DESC` |

**Example Request:**
```
GET /api/admin/customers?page=1&limit=20&customer_type=individual&is_active=true&sort_by=created_at&sort_order=DESC&search=john
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "customer_id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "phone": "+251911234567",
        "customer_type": "individual",
        "is_active": 1,
        "is_email_verified": 1,
        "is_phone_verified": 1,
        "is_kyc_verified": 0,
        "profile_picture": "https://cdn.example.com/profile/john.png",
        "date_of_birth": "1990-05-18",
        "gender": "male",
        "created_at": "2025-01-01T00:00:00.000Z",
        "updated_at": "2025-01-08T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "total_pages": 63
    }
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to retrieve customers",
  "code": "SERVER_ERROR"
}
```

---

### Get Customer Details
**GET** `/api/admin/customers/:id` 🔒

Get comprehensive customer details including associated user account, registrations, and contest participation.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Customer ID |

**Example Request:**
```
GET /api/admin/customers/1
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "customer": {
      "customer_id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+251911234567",
      "customer_type": "individual",
      "is_active": 1,
      "is_email_verified": 1,
      "is_phone_verified": 1,
      "is_kyc_verified": 0,
      "profile_picture": "https://cdn.example.com/profile/john.png",
      "date_of_birth": "1990-05-18",
      "gender": "male",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-08T10:00:00.000Z"
    },
    "user": {
      "user_id": 1,
      "customer_id": 1,
      "username": "john@example.com",
      "auth_provider": "local",
      "role_name": "customer",
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    "contest_registrations": [
      {
        "registration_id": 1,
        "contest_id": 1,
        "customer_id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "slug": "winter-2025",
        "description": "Winter Trading Contest 2025",
        "created_at": "2025-01-05T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Customer not found",
  "code": "CUSTOMER_NOT_FOUND"
}
```

---

### Update Customer
**PUT** `/api/admin/customers/:id` 🔒

Update customer information comprehensively. Admin can update any field including verification statuses.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Customer ID |

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.updated@example.com",
  "phone": "+251911234568",
  "customer_type": "enterprise",
  "is_active": true,
  "is_email_verified": true,
  "is_phone_verified": false,
  "is_kyc_verified": true,
  "profile_picture": "https://cdn.example.com/profile/john-new.png",
  "date_of_birth": "1990-05-18",
  "gender": "male"
}
```

**Allowed Fields:**
- `first_name` (string)
- `last_name` (string)
- `email` (string, valid email format)
- `phone` (string)
- `customer_type` (string: `individual` or `enterprise`)
- `is_active` (boolean)
- `is_email_verified` (boolean)
- `is_phone_verified` (boolean)
- `is_kyc_verified` (boolean)
- `profile_picture` (string, URL)
- `date_of_birth` (string, YYYY-MM-DD format)
- `gender` (string: `male`, `female`, `other`)

**Example Request:**
```
PUT /api/admin/customers/1
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "first_name": "John Updated",
  "is_active": false,
  "is_kyc_verified": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Customer updated successfully",
  "data": {
    "customer_id": 1,
    "first_name": "John Updated",
    "last_name": "Doe",
    "email": "john@example.com",
    "is_active": 0,
    "is_kyc_verified": 1,
    "updated_at": "2025-01-09T12:00:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Customer not found",
  "code": "CUSTOMER_NOT_FOUND"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to update customer",
  "code": "SERVER_ERROR"
}
```

---

### Delete Customer
**DELETE** `/api/admin/customers/:id` 🔒

Soft delete a customer (sets `deleted_at` timestamp). The customer record remains in the database but is marked as deleted.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Customer ID |

**Example Request:**
```
DELETE /api/admin/customers/1
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Customer not found",
  "code": "CUSTOMER_NOT_FOUND"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to delete customer",
  "code": "SERVER_ERROR"
}
```

---

## Talent Pool Management

### Get Talent Pool Registrations
**GET** `/api/admin/talent-pool` 🔒

Get paginated list of talent pool registrations with filtering.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page |
| `status` | string | No | - | Filter by status: `pending`, `approved`, `rejected` |
| `country` | string | No | - | Filter by country |
| `search` | string | No | - | Search by name or email |

**Example Request:**
```
GET /api/admin/talent-pool?page=1&limit=20&status=pending&country=Ethiopia
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "registrations": [
      {
        "id": 1,
        "full_name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+251911234567",
        "country": "Ethiopia",
        "city": "Addis Ababa",
        "status": "pending",
        "education_level": "Bachelor's",
        "years_experience": "3-5",
        "work_type": "Full-time",
        "availability": "Immediate",
        "created_at": "2025-01-05T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 280,
      "total_pages": 14
    }
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to retrieve talent pool registrations",
  "code": "SERVER_ERROR"
}
```

---

### Get Talent Pool Statistics
**GET** `/api/admin/talent-pool/stats` 🔒

Get comprehensive statistics about talent pool registrations grouped by various criteria.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "byAgeRange": [
      { "age_range": "18-25", "count": 50 },
      { "age_range": "26-35", "count": 120 },
      { "age_range": "36-45", "count": 80 },
      { "age_range": "46+", "count": 30 }
    ],
    "byEducation": [
      { "education_level": "Bachelor's", "count": 150 },
      { "education_level": "Master's", "count": 80 },
      { "education_level": "PhD", "count": 30 },
      { "education_level": "Diploma", "count": 20 }
    ],
    "byExperience": [
      { "years_experience": "0-2", "count": 40 },
      { "years_experience": "3-5", "count": 120 },
      { "years_experience": "6-10", "count": 80 },
      { "years_experience": "10+", "count": 40 }
    ],
    "byWorkType": [
      { "work_type": "Full-time", "count": 200 },
      { "work_type": "Part-time", "count": 50 },
      { "work_type": "Contract", "count": 30 }
    ],
    "byAvailability": [
      { "availability": "Immediate", "count": 150 },
      { "availability": "1 month", "count": 80 },
      { "availability": "2-3 months", "count": 50 }
    ],
    "byCountry": [
      { "country": "Ethiopia", "count": 180 },
      { "country": "Kenya", "count": 50 },
      { "country": "Nigeria", "count": 30 },
      { "country": "Ghana", "count": 20 }
    ],
    "byStatus": [
      { "status": "pending", "count": 120 },
      { "status": "approved", "count": 140 },
      { "status": "rejected", "count": 20 }
    ]
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to retrieve talent pool statistics",
  "code": "SERVER_ERROR"
}
```

---

### Update Talent Pool Status
**PATCH** `/api/admin/talent-pool/:id/status` 🔒

Update the status of a talent pool registration.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Talent pool registration ID |

**Request Body:**
```json
{
  "status": "approved"
}
```

**Valid Statuses:** `pending`, `approved`, `rejected`

**Example Request:**
```
PATCH /api/admin/talent-pool/1/status
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "status": "approved"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Registration status updated successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Talent pool registration not found",
  "code": "TALENT_POOL_NOT_FOUND"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Invalid status. Must be one of: pending, approved, rejected",
  "code": "VALIDATION_ERROR"
}
```

---

## Contest Management

### Get Contests List
**GET** `/api/admin/contests` 🔒

Get list of all contests with registration counts.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "winter-2025",
      "description": "Winter Trading Contest 2025",
      "type": "demo",
      "created_at": "2025-01-01T00:00:00.000Z",
      "registration_count": 150
    },
    {
      "id": 2,
      "slug": "spring-2025",
      "description": "Spring Trading Contest 2025",
      "type": "live",
      "created_at": "2025-02-01T00:00:00.000Z",
      "registration_count": 200
    }
  ]
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to retrieve contests",
  "code": "SERVER_ERROR"
}
```

---

### Get Contest Details
**GET** `/api/admin/contests/:id` 🔒

Get contest details with all registrations.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Contest ID |

**Example Request:**
```
GET /api/admin/contests/1
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contest": {
      "id": 1,
      "slug": "winter-2025",
      "description": "Winter Trading Contest 2025",
      "type": "demo",
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    "registrations": [
      {
        "registration_id": 1,
        "contest_id": 1,
        "customer_id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "created_at": "2025-01-05T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Contest not found",
  "code": "CONTEST_NOT_FOUND"
}
```

---

## Access Code Management

### Get Access Codes List
**GET** `/api/admin/access-codes` 🔒

Get paginated list of access codes with usage statistics.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page |
| `status` | string | No | - | Filter by status: `active`, `inactive`, `expired` |
| `search` | string | No | - | Search by code or university name |

**Example Request:**
```
GET /api/admin/access-codes?page=1&limit=20&status=active&search=PTGR
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_codes": [
      {
        "id": 1,
        "code": "PTGR2025",
        "university_name": "Example University",
        "total_students": 100,
        "max_uses": 100,
        "is_active": 1,
        "expires_at": "2025-12-31T23:59:59.000Z",
        "total_users": 85,
        "registered_users": 80,
        "completed_users": 65,
        "created_at": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "total_pages": 2
    }
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to retrieve access codes",
  "code": "SERVER_ERROR"
}
```

---

### Get Access Code Details
**GET** `/api/admin/access-codes/:id` 🔒

Get access code details with user statistics and associated users.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Access code ID |

**Example Request:**
```
GET /api/admin/access-codes/1
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_code": {
      "id": 1,
      "code": "PTGR2025",
      "university_name": "Example University",
      "total_students": 100,
      "max_uses": 100,
      "is_active": 1,
      "expires_at": "2025-12-31T23:59:59.000Z",
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    "statistics": {
      "total": 100,
      "by_status": [
        { "status": "registered", "count": 80 },
        { "status": "pending", "count": 15 },
        { "status": "completed", "count": 65 },
        { "status": "cancelled", "count": 5 }
      ],
      "summary": {
        "registered": 80,
        "pending": 15,
        "completed": 65,
        "cancelled": 5
      },
      "registration_rate": 80
    },
    "users": [
      {
        "user_id": 1,
        "customer_id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "status": "registered",
        "created_at": "2025-01-05T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Access code not found",
  "code": "ACCESS_CODE_NOT_FOUND"
}
```

---

### Create Access Code
**POST** `/api/admin/access-codes` 🔒

Create a new access code.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "PTGR2025",
  "course_id": 1,
  "university_name": "Example University",
  "total_students": 100,
  "max_uses": 100,
  "payment_amount": 0,
  "payment_currency": "USD",
  "is_active": true,
  "expires_at": "2025-12-31T23:59:59.000Z",
  "notes": "Optional notes about this access code"
}
```

**Required Fields:**
- `code` (string) - Unique access code
- `is_active` (boolean)

**Optional Fields:**
- `course_id` (number) - Link this access code to a specific course (recommended for Academy)
- `university_name` (string)
- `total_students` (number)
- `max_uses` (number)
- `payment_amount` (number) - Additional payment required for this code. Set `0` to make the code completely free.
- `payment_currency` (string) - Currency for payment amount (default `USD`)
- `expires_at` (string, ISO 8601 date format)
- `expires_at` formats supported by API:
  - ISO 8601 (e.g. `"2026-01-31T00:00:00.000Z"`)
  - MySQL DATETIME string (e.g. `"2026-01-31 00:00:00"`)
  - Date-only (e.g. `"2026-01-31"` -> treated as `"2026-01-31 00:00:00"`)
- `notes` (string)

**Example Request:**
```
POST /api/admin/access-codes
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "code": "PTGR2025NEW",
  "university_name": "New University",
  "total_students": 200,
  "max_uses": 200,
  "is_active": true,
  "expires_at": "2025-12-31T23:59:59.000Z"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Access code created successfully",
  "data": {
    "id": 26,
    "code": "PTGR2025NEW",
    "course_id": 1,
    "university_name": "New University",
    "total_students": 200,
    "max_uses": 200,
    "payment_amount": 0,
    "payment_currency": "USD",
    "is_active": 1,
    "expires_at": "2025-12-31T23:59:59.000Z",
    "created_at": "2025-01-09T12:00:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Access code already exists",
  "code": "DUPLICATE_ENTRY"
}
```

---

### Update Access Code
**PUT** `/api/admin/access-codes/:id` 🔒

Update access code information.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Access code ID |

**Request Body:**
```json
{
  "code": "PTGR2025UPDATED",
  "max_uses": 150,
  "is_active": false,
  "expires_at": "2026-12-31T23:59:59.000Z"
}
```

**Example Request:**
```
PUT /api/admin/access-codes/1
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "max_uses": 150,
  "is_active": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Access code updated successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Access code not found",
  "code": "ACCESS_CODE_NOT_FOUND"
}
```

---

## Analytics & Reports

### Get Analytics Report
**GET** `/api/admin/analytics` 🔒

Get comprehensive analytics report with various metrics.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | number | No | 30 | Analysis period in days |

**Example Request:**
```
GET /api/admin/analytics?period=30
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "customer_growth": [
      {
        "date": "2025-01-01",
        "count": 15,
        "cumulative": 1200
      },
      {
        "date": "2025-01-02",
        "count": 18,
        "cumulative": 1218
      }
    ],
    "revenue_analytics": [],
    "customer_type_distribution": [
      {
        "customer_type": "individual",
        "count": 1000
      },
      {
        "customer_type": "enterprise",
        "count": 250
      }
    ],
    "top_countries": [
      {
        "country": "Ethiopia",
        "count": 150
      },
      {
        "country": "Kenya",
        "count": 80
      },
      {
        "country": "Nigeria",
        "count": 50
      }
    ]
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to retrieve analytics",
  "code": "SERVER_ERROR"
}
```

---

## Error Handling

All endpoints follow a standard error response format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 400 | `DUPLICATE_ENTRY` | Resource already exists |
| 400 | `MISSING_BODY` | Request body is required |
| 401 | `NO_AUTH_TOKEN` | Authorization token is missing |
| 401 | `INVALID_TOKEN` | Token is invalid or expired |
| 403 | `FORBIDDEN` | User lacks required permissions (not developer role) |
| 404 | `NOT_FOUND` | Resource not found |
| 404 | `CUSTOMER_NOT_FOUND` | Customer not found |
| 404 | `CONTEST_NOT_FOUND` | Contest not found |
| 404 | `ACCESS_CODE_NOT_FOUND` | Access code not found |
| 404 | `TALENT_POOL_NOT_FOUND` | Talent pool registration not found |
| 500 | `SERVER_ERROR` | Internal server error |

---

## Rate Limiting

Currently, there are no rate limits on admin endpoints. However, it's recommended to:
- Implement client-side caching for dashboard data (refresh every 5-10 minutes)
- Use pagination for large datasets
- Avoid making excessive requests
- Batch operations when possible

---

## Best Practices

1. **Pagination:** Always use pagination when fetching lists to avoid large payloads
2. **Filtering:** Use query parameters to filter results on the server side
3. **Caching:** Cache dashboard statistics on the client side (refresh every 5-10 minutes)
4. **Error Handling:** Always handle error responses gracefully
5. **Security:** Never expose admin endpoints to unauthorized users
6. **Validation:** Validate all input data on the client side before sending requests
7. **Logging:** All admin actions are logged for audit purposes

---

## Testing Endpoints

### Using cURL

**Get Dashboard Stats:**
```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Get Customers:**
```bash
curl -X GET "http://localhost:3000/api/admin/customers?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Update Customer:**
```bash
curl -X PUT http://localhost:3000/api/admin/customers/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Updated Name",
    "is_active": true
  }'
```

---

**Last Updated:** 2025-01-10  
**API Version:** 1.0.0

