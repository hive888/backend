# Admin API Documentation

## Overview

This document provides comprehensive documentation for all admin endpoints in the Hive888 backend API. All endpoints require authentication and the `developer` role.

**Base URL:** `/api/admin`

**Authentication:** Bearer token required in `Authorization` header

**Required Role:** `developer`

---

## Table of Contents

1. [Dashboard Endpoints](#dashboard-endpoints)
2. [Summary Report Endpoint](#summary-report-endpoint)
3. [Customer Management](#customer-management)
4. [Payment Tracking](#payment-tracking)
5. [Exit Exam Payment Management](#exit-exam-payment-management)
6. [Telegram Management](#telegram-management)
7. [Access Code Management](#access-code-management)
8. [University Management](#university-management)
9. [Event Management](#event-management)
10. [Talent Pool Management](#talent-pool-management)
11. [Contest Management](#contest-management)
12. [Analytics](#analytics)

---

## Dashboard Endpoints

### Get Dashboard Overview

Get comprehensive dashboard statistics including customers, users, payments, Telegram, courses, contests, and trends.

**Endpoint:** `GET /api/admin/dashboard`

**Authentication:** Required (developer role)

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_customers": 1250,
      "total_users": 1180,
      "total_revenue": 45230.50,
      "total_payments": 342,
      "telegram_users": 456,
      "active_contests": 12
    },
    "overview": {
      "customers": {
        "total_customers": 1250,
        "active_customers": 1180,
        "inactive_customers": 70,
        "email_verified": 1150,
        "phone_verified": 980,
        "kyc_verified": 450,
        "individual": 1100,
        "enterprise": 150,
        "new_today": 5,
        "new_this_week": 35,
        "new_this_month": 120
      },
      "users": {
        "total_users": 1180,
        "users_with_customers": 1150
      },
      "contests": {
        "total_contests": 12,
        "total_registrations": 450,
        "unique_participants": 320,
        "contests_created_today": 0
      },
      "talent_pool": {
        "total_registrations": 250,
        "pending": 45,
        "approved": 180,
        "rejected": 25,
        "new_today": 2
      },
      "payments": {
        "total_payments": 342,
        "completed_payments": 310,
        "pending_payments": 20,
        "failed_payments": 12,
        "total_revenue": 45230.50,
        "avg_payment_amount": 145.90,
        "revenue_today": 1250.00,
        "revenue_this_week": 8500.00,
        "revenue_this_month": 28000.00
      },
      "telegram": {
        "total_telegram_users": 456,
        "active_telegram_users": 420,
        "blocked_telegram_users": 36,
        "new_today": 3
      },
      "courses": {
        "total_registrations": 890,
        "completed_courses": 320,
        "in_progress": 570,
        "certificates_issued": 280
      }
    },
    "trends": {
      "customer_growth": [
        { "date": "2024-01-01", "count": 100 },
        { "date": "2024-01-02", "count": 105 }
      ],
      "revenue_trends": [
        { "date": "2024-01-01", "amount": 5000 },
        { "date": "2024-01-02", "amount": 5200 }
      ]
    },
    "recent_activity": [
      {
        "type": "customer_registration",
        "description": "New customer registered",
        "timestamp": "2024-01-20T10:30:00Z"
      }
    ]
  }
}
```

---

### Get Summary Report

Get a summarized report with key metrics and insights.

**Endpoint:** `GET /api/admin/report/summary`

**Authentication:** Required (developer role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | No | Start date (ISO 8601) |
| `end_date` | string | No | End date (ISO 8601) |

**Response:**

```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    },
    "summary": {
      "total_customers": 1250,
      "new_customers": 120,
      "total_revenue": 45230.50,
      "total_payments": 342,
      "active_courses": 890,
      "certificates_issued": 280
    },
    "breakdown": {
      "by_customer_type": {
        "individual": 1100,
        "enterprise": 150
      },
      "by_payment_status": {
        "completed": 310,
        "pending": 20,
        "failed": 12
      }
    },
    "insights": [
      "Customer growth increased by 15% this month",
      "Revenue is up 20% compared to last month"
    ]
  }
}
```

---

## Customer Management

### Get All Customers

**Endpoint:** `GET /api/admin/customers`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 50) |
| `search` | string | No | Search by name or email |
| `customer_type` | string | No | Filter by type (individual/enterprise) |
| `is_active` | boolean | No | Filter by active status |

**Response:**

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
        "phone": "+1234567890",
        "customer_type": "individual",
        "is_active": true,
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "total": 1250,
    "page": 1,
    "limit": 50,
    "total_pages": 25
  }
}
```

### Get Customers with Course Progress

**Endpoint:** `GET /api/admin/customers/with-progress`

Lists all customers who have at least one completed subsection in any course. This endpoint is useful for tracking which customers are actively engaging with course content.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20) |
| `search` | string | No | Search by first name, last name, full name, or email |
| `sort_by` | string | No | Sort field: `completed_at`, `first_completed_at`, `last_completed_at`, `completed_subsections`, `first_name`, `last_name`, `email`, `created_at` (default: `completed_at`) |
| `sort_order` | string | No | Sort direction: `ASC` or `DESC` (default: `DESC`) |

**Response:**

```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "customer_id": 100079,
        "first_name": "John",
        "last_name": "Doe",
        "full_name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "profile_picture": "https://example.com/profile.jpg",
        "access_code": "UNIV2024",
        "access_code_id": 5,
        "access_code_source": "customer_course_access",
        "completed_subsections": 15,
        "first_completed_at": "2024-01-15T10:00:00Z",
        "last_completed_at": "2024-01-20T14:30:00Z",
        "created_at": "2024-01-01T10:00:00Z"
      },
      {
        "customer_id": 100092,
        "first_name": "Jane",
        "last_name": "Smith",
        "full_name": "Jane Smith",
        "email": "jane@example.com",
        "phone": "+9876543210",
        "profile_picture": null,
        "access_code": null,
        "access_code_id": null,
        "access_code_source": null,
        "completed_subsections": 8,
        "first_completed_at": "2024-01-10T09:00:00Z",
        "last_completed_at": "2024-01-18T16:45:00Z",
        "created_at": "2024-01-05T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `customer_id` | integer | Unique customer identifier |
| `first_name` | string | Customer's first name |
| `last_name` | string | Customer's last name |
| `full_name` | string | Concatenated full name (first_name + last_name) |
| `email` | string | Customer's email address |
| `phone` | string | Customer's phone number |
| `profile_picture` | string\|null | URL to customer's profile picture |
| `completed_subsections` | integer | Total number of completed subsections |
| `first_completed_at` | string\|null | Timestamp of the first completed subsection (ISO 8601) |
| `last_completed_at` | string\|null | Timestamp of the most recent completed subsection (ISO 8601) |
| `created_at` | string | Customer account creation timestamp (ISO 8601) |
| `access_code` | string\|null | Access code the customer used (if available) |
| `access_code_id` | integer\|null | Access code ID (if available) |
| `access_code_source` | string\|null | Where the access code was read from: `customer_course_access` or `selfstudy_registrations` |

**Example Request:**

```bash
curl -X GET "https://api.hive888.org/api/admin/customers/with-progress?page=1&limit=20&search=john&sort_by=completed_subsections&sort_order=DESC" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Notes:**

- Only customers with at least one completed subsection are returned
- The `completed_subsections` count represents the total number of unique subsections completed by the customer
- Search functionality searches across first name, last name, full name, and email fields
- Results are sorted by the most recent completion date by default

### Get Customer Details

**Endpoint:** `GET /api/admin/customers/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "customer": {
      "customer_id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "customer_type": "individual",
      "is_active": true,
      "is_email_verified": true,
      "is_phone_verified": true,
      "is_kyc_verified": false,
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-01-01T10:00:00Z"
    },
    "registrations": [],
    "payments": []
  }
}
```

### Update Customer

**Endpoint:** `PUT /api/admin/customers/:id`

**Request Body:**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "is_active": true
}
```

### Delete Customer

**Endpoint:** `DELETE /api/admin/customers/:id`

**Response:**

```json
{
  "success": true,
  "message": "Customer deleted successfully"
}
```

---

## Payment Tracking

### Get All Payments

**Endpoint:** `GET /api/admin/payments`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 50) |
| `customer_id` | integer | No | Filter by customer ID |
| `access_code_id` | integer | No | Filter by access code ID |
| `payment_status` | string | No | Filter by status (pending/completed/failed) |
| `payment_type` | string | No | Filter by type (course_access/exit_exam) |
| `start_date` | string | No | Filter from date |
| `end_date` | string | No | Filter to date |

**Response:**

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "customer_id": 123,
        "access_code_id": 5,
        "amount": 18.00,
        "currency": "USD",
        "payment_type": "course_access",
        "payment_status": "completed",
        "transaction_id": "cs_test_123",
        "payment_date": "2024-01-15T10:30:00Z",
        "created_at": "2024-01-15T10:25:00Z"
      }
    ],
    "total": 342,
    "page": 1,
    "limit": 50,
    "total_pages": 7
  }
}
```

### Get Payment Statistics

**Endpoint:** `GET /api/admin/payments/stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "total_payments": 342,
    "completed_payments": 310,
    "pending_payments": 20,
    "failed_payments": 12,
    "total_revenue": 45230.50,
    "avg_payment_amount": 145.90,
    "revenue_today": 1250.00,
    "revenue_this_week": 8500.00,
    "revenue_this_month": 28000.00
  }
}
```

### Get Payment by ID

**Endpoint:** `GET /api/admin/payments/:id`

### Get Customer Payments

**Endpoint:** `GET /api/admin/payments/customer/:customer_id`

### Get Payments by Status

**Endpoint:** `GET /api/admin/payments/status/:status`

---

## Exit Exam Payment Management

### Get All Exit Exam Payments

**Endpoint:** `GET /api/admin/exit-exam-payments`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 50) |
| `customer_id` | integer | No | Filter by customer ID |
| `access_code_id` | integer | No | Filter by access code ID |
| `payment_status` | string | No | Filter by status (pending/processing/completed/failed) |

**Response:**

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "customer_id": 123,
        "access_code_id": 5,
        "registration_id": 10,
        "amount": 25.00,
        "currency": "USD",
        "payment_status": "completed",
        "transaction_id": "cs_test_456",
        "payment_date": "2024-01-15T11:00:00Z",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "access_code": "UNIV2024",
        "university_name": "University Name",
        "created_at": "2024-01-15T10:55:00Z"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 50,
    "total_pages": 1
  }
}
```

### Get Exit Exam Payment by ID

**Endpoint:** `GET /api/admin/exit-exam-payments/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "customer_id": 123,
    "access_code_id": 5,
    "registration_id": 10,
    "amount": 25.00,
    "currency": "USD",
    "payment_status": "completed",
    "transaction_id": "cs_test_456",
    "payment_date": "2024-01-15T11:00:00Z",
    "payment_details": {
      "stripe_payment_intent": "pi_test_123",
      "stripe_customer": "cus_test_123"
    },
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "access_code": "UNIV2024",
    "university_name": "University Name",
    "created_at": "2024-01-15T10:55:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

---

## Telegram Management

### Get Telegram Users

**Endpoint:** `GET /api/admin/telegram/users`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 50) |
| `is_blocked` | boolean | No | Filter by blocked status |

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "telegram_user_id": 123456789,
        "username": "johndoe",
        "first_name": "John",
        "last_name": "Doe",
        "is_blocked": false,
        "joined_at": "2024-01-01T10:00:00Z"
      }
    ],
    "total": 456,
    "page": 1,
    "limit": 50
  }
}
```

### Get Telegram User Details

**Endpoint:** `GET /api/admin/telegram/users/:telegram_user_id`

### Block Telegram User

**Endpoint:** `POST /api/admin/telegram/users/:telegram_user_id/block`

**Request Body:**

```json
{
  "reason": "Violation of terms"
}
```

### Unblock Telegram User

**Endpoint:** `POST /api/admin/telegram/users/:telegram_user_id/unblock`

### Kick Telegram User

**Endpoint:** `POST /api/admin/telegram/users/:telegram_user_id/kick`

### Send Direct Message

**Endpoint:** `POST /api/admin/telegram/users/:telegram_user_id/message`

**Request Body:**

```json
{
  "message": "Hello, this is a direct message"
}
```

### Send Bulk Message to Private List

**Endpoint:** `POST /api/admin/telegram/messages/bulk/private`

**Request Body:**

```json
{
  "message": "Bulk message content",
  "user_ids": [123456789, 987654321]
}
```

### Send Bulk Message to Public List

**Endpoint:** `POST /api/admin/telegram/messages/bulk/public`

**Request Body:**

```json
{
  "message": "Public announcement"
}
```

### Get Telegram Statistics

**Endpoint:** `GET /api/admin/telegram/stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "total_users": 456,
    "active_users": 420,
    "blocked_users": 36,
    "new_today": 3,
    "new_this_week": 15,
    "new_this_month": 45
  }
}
```

---

## Access Code Management

### Get All Access Codes

**Endpoint:** `GET /api/admin/access-codes`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 50) |
| `is_active` | boolean | No | Filter by active status |
| `search` | string | No | Search by code |

**Response:**

```json
{
  "success": true,
  "data": {
    "access_codes": [
      {
        "id": 1,
        "code": "UNIV2024",
        "course_id": 1,
        "university_name": "University Name",
        "exit_exam_fee": 25.00,
        "university_id": 5,
        "payment_amount": 18.00,
        "payment_currency": "USD",
        "max_uses": 100,
        "used_count": 45,
        "is_active": true,
        "expires_at": "2024-12-31T23:59:59Z",
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 50,
    "total_pages": 1
  }
}
```

### Get Access Code Details

**Endpoint:** `GET /api/admin/access-codes/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "access_code": {
      "id": 1,
      "code": "UNIV2024",
      "course_id": 1,
      "university_name": "University Name",
      "exit_exam_fee": 25.00,
      "university_id": 5,
      "university_full_name": "Full University Name",
      "stamp_image_url": "https://example.com/stamp.png",
      "payment_amount": 18.00,
      "payment_currency": "USD",
      "max_uses": 100,
      "used_count": 45,
      "is_active": true,
      "expires_at": "2024-12-31T23:59:59Z",
      "created_at": "2024-01-01T10:00:00Z"
    },
    "statistics": {
      "total_used": 45,
      "total_registered": 40,
      "total_certified": 25
    },
    "users": []
  }
}
```

### Create Access Code

**Endpoint:** `POST /api/admin/access-codes`

**Request Body:**

```json
{
  "code": "UNIV2024",
  "course_id": 1,
  "university_name": "University Name",
  "exit_exam_fee": 25.00,
  "university_id": 5,
  "payment_amount": 18.00,
  "payment_currency": "USD",
  "max_uses": 100,
  "is_active": true,
  "expires_at": "2024-12-31T23:59:59Z",
  "notes": "Access code for university students"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Unique access code |
| `course_id` | integer | No | Associated course ID |
| `university_name` | string | No | Legacy university name field |
| `exit_exam_fee` | decimal | No | Exit exam fee (default: 0.00) |
| `university_id` | integer | No | University ID (for stamp) |
| `payment_amount` | decimal | No | Course access payment amount |
| `payment_currency` | string | No | Currency (default: USD) |
| `max_uses` | integer | No | Maximum number of uses |
| `is_active` | boolean | No | Active status (default: true) |
| `expires_at` | string | No | Expiration date (ISO 8601) |
| `notes` | string | No | Admin notes |

### Update Access Code

**Endpoint:** `PUT /api/admin/access-codes/:id`

**Request Body:** Same as create, all fields optional

---

## University Management

### Get All Universities

**Endpoint:** `GET /api/admin/universities`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `is_active` | boolean | No | Filter by active status |
| `search` | string | No | Search by university name |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "university_id": 1,
      "university_name": "University Name",
      "certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/completion/certificate.pdf",
      "achievement_certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/achievement/certificate.pdf",
      "stamp_image_url": null,
      "is_active": true,
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### Get University by ID

**Endpoint:** `GET /api/admin/universities/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "university_id": 1,
    "university_name": "University Name",
    "certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/completion/certificate.pdf",
    "achievement_certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/achievement/certificate.pdf",
    "stamp_image_url": null,
    "is_active": true,
    "created_at": "2024-01-01T10:00:00Z",
    "updated_at": "2024-01-01T10:00:00Z"
  }
}
```

### Create University

**Endpoint:** `POST /api/admin/universities`

**Content-Type:** `multipart/form-data`

**Request Body (Form Data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `university_name` | string | Yes | University name |
| `completion` | file (PDF) | No | PDF completion certificate template (max 10MB). Used when student passes the quiz (score >= pass_score, typically 70%). |
| `achievement` | file (PDF) | No | PDF achievement certificate template (max 10MB). Used when student gets high score (score >= 90%). |
| `certificate` | file (PDF) | No | **Deprecated:** Legacy field for backward compatibility. Use `completion` instead. |
| `is_active` | boolean | No | Active status (default: true) |

**Example using cURL (with both certificate types):**

```bash
curl -X POST https://api.hive888.org/api/admin/universities \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "university_name=Harvard University" \
  -F "completion=@/path/to/completion-certificate.pdf" \
  -F "achievement=@/path/to/achievement-certificate.pdf" \
  -F "is_active=true"
```

**Example using cURL (completion only):**

```bash
curl -X POST https://api.hive888.org/api/admin/universities \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "university_name=Harvard University" \
  -F "completion=@/path/to/completion-certificate.pdf"
```

**Response:**

```json
{
  "success": true,
  "message": "University created successfully",
  "data": {
    "id": 1,
    "certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/completion/1234567890-certificate.pdf",
    "achievement_certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/achievement/1234567890-certificate.pdf"
  }
}
```

**Field Descriptions:**

- `university_name`: Required. The name of the university.
- `completion`: Optional. PDF file containing the completion certificate template. Used when a student passes the quiz (score >= pass_score, typically 70%). Only PDF files are accepted. Maximum file size is 10MB. The file will be uploaded to S3 and the URL will be stored.
- `achievement`: Optional. PDF file containing the achievement certificate template. Used when a student gets a high score (score >= 90%). Only PDF files are accepted. Maximum file size is 10MB. The file will be uploaded to S3 and the URL will be stored.
- `certificate`: **Deprecated.** Legacy field for backward compatibility. If provided, it will be treated as a completion certificate. Use `completion` instead.
- `is_active`: Optional. Whether the university is active (default: true).

**Certificate Type Selection:**

The system automatically selects the appropriate certificate based on the student's quiz score:
- **Achievement Certificate**: Used when student score >= 90% (if `achievement_certificate_file_url` exists)
- **Completion Certificate**: Used when student passes the quiz (score >= pass_score, typically 70%) but < 90%, or if achievement certificate is not available
- **Default Certificate**: Used if no university certificate templates are available

**Error Responses:**

- `400 Bad Request`: If university name is missing or file is not PDF
- `500 Server Error`: If file upload fails

### Update University

**Endpoint:** `PUT /api/admin/universities/:id`

**Content-Type:** `multipart/form-data`

**Request Body (Form Data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `university_name` | string | No | University name |
| `completion` | file (PDF) | No | PDF completion certificate template (max 10MB). If provided, replaces existing completion certificate. |
| `achievement` | file (PDF) | No | PDF achievement certificate template (max 10MB). If provided, replaces existing achievement certificate. |
| `certificate` | file (PDF) | No | **Deprecated:** Legacy field for backward compatibility. If provided, replaces completion certificate. Use `completion` instead. |
| `is_active` | boolean | No | Active status |

**Example using cURL (update both certificates):**

```bash
curl -X PUT https://api.hive888.org/api/admin/universities/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "university_name=Harvard University Updated" \
  -F "completion=@/path/to/new-completion-certificate.pdf" \
  -F "achievement=@/path/to/new-achievement-certificate.pdf"
```

**Example using cURL (update completion only):**

```bash
curl -X PUT https://api.hive888.org/api/admin/universities/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "completion=@/path/to/new-completion-certificate.pdf"
```

**Response:**

```json
{
  "success": true,
  "message": "University updated successfully",
  "data": {
    "certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/completion/1234567890-new-certificate.pdf",
    "achievement_certificate_file_url": "https://s3.amazonaws.com/bucket/university_certificates/achievement/1234567890-new-certificate.pdf"
  }
}
```

**Notes:**

- All fields are optional. Only provided fields will be updated.
- If a new completion certificate file is uploaded, the old completion certificate file will be automatically deleted from S3.
- If a new achievement certificate file is uploaded, the old achievement certificate file will be automatically deleted from S3.
- You can update completion and achievement certificates independently.
- The certificate files must be PDF format only.

### Delete University

**Endpoint:** `DELETE /api/admin/universities/:id`

**Response:**

```json
{
  "success": true,
  "message": "University deleted successfully"
}
```

**Note:** Soft delete (sets `is_active` to false). The certificate file remains in S3 but the university will not be available for new access codes.

---

### Certificate Template Usage

When a student completes the exit exam and passes the final quiz, the system will:

1. Check if the access code has an associated university
2. Determine the certificate type based on the quiz score:
   - **Achievement Certificate**: If student score >= 90% and `achievement_certificate_file_url` exists, use the achievement certificate template
   - **Completion Certificate**: If student passes (score >= pass_score, typically 70%) but < 90%, or if achievement certificate is not available, use the completion certificate template (`certificate_file_url`)
3. Overlay the student's name on the selected certificate template
4. Generate and store the final certificate

**Certificate Selection Logic:**
- Score >= 90% → Achievement certificate (if available) → Completion certificate (if available) → Default certificate
- Score >= pass_score (typically 70%) but < 90% → Completion certificate (if available) → Default certificate
- Score < pass_score → No certificate generated

If no university certificate template is available, the system falls back to the default certificate template.

---

## Event Management

### Get All Events

**Endpoint:** `GET /api/admin/events`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `search` | string | No | Search in event name or description |
| `start_date` | string | No | Filter events from this date (ISO 8601) |
| `end_date` | string | No | Filter events until this date (ISO 8601) |

**Response:**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "event_id": 1,
        "event_name": "Web3 Workshop",
        "event_date": "2024-02-15",
        "short_description": "Learn the fundamentals of Web3 technology",
        "detailed_content": "<h1>Web3 Workshop</h1>...",
        "created_at": "2024-01-10T10:00:00.000Z",
        "updated_at": "2024-01-10T10:00:00.000Z",
        "deleted_at": null
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

### Get Event by ID

**Endpoint:** `GET /api/admin/events/:id`

### Create Event

**Endpoint:** `POST /api/admin/events`

**Request Body:**

```json
{
  "event_name": "Web3 Workshop",
  "event_date": "2024-02-15",
  "short_description": "Learn the fundamentals of Web3 technology",
  "detailed_content": "<h1>Web3 Workshop</h1><p>Join us...</p>"
}
```

### Update Event

**Endpoint:** `PUT /api/admin/events/:id`

**Request Body:** Same as create

### Delete Event

**Endpoint:** `DELETE /api/admin/events/:id`

**Note:** Soft delete (sets `deleted_at` timestamp)

---

## Talent Pool Management

### Get Talent Pool Registrations

**Endpoint:** `GET /api/admin/talent-pool`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 50) |
| `status` | string | No | Filter by status (pending/approved/rejected) |

**Response:**

```json
{
  "success": true,
  "data": {
    "registrations": [
      {
        "id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "status": "pending",
        "created_at": "2024-01-01T10:00:00Z"
      }
    ],
    "total": 250,
    "page": 1,
    "limit": 50
  }
}
```

### Get Talent Pool Statistics

**Endpoint:** `GET /api/admin/talent-pool/stats`

**Response:**

```json
{
  "success": true,
  "data": {
    "total_registrations": 250,
    "pending": 45,
    "approved": 180,
    "rejected": 25,
    "new_today": 2
  }
}
```

### Update Talent Pool Status

**Endpoint:** `PATCH /api/admin/talent-pool/:id/status`

**Request Body:**

```json
{
  "status": "approved",
  "notes": "Approved for talent pool"
}
```

---

## Contest Management

### Get All Contests

**Endpoint:** `GET /api/admin/contests`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Web3 Innovation Contest",
      "description": "Contest description",
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-12-31T23:59:59Z",
      "is_active": true,
      "registration_count": 45
    }
  ]
}
```

### Get Contest Details

**Endpoint:** `GET /api/admin/contests/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "contest": {
      "id": 1,
      "title": "Web3 Innovation Contest",
      "description": "Contest description",
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-12-31T23:59:59Z",
      "is_active": true
    },
    "registrations": [
      {
        "id": 1,
        "customer_id": 123,
        "registered_at": "2024-01-15T10:00:00Z"
      }
    ],
    "statistics": {
      "total_registrations": 45,
      "unique_participants": 40
    }
  }
}
```

---

## Analytics

### Get Analytics

**Endpoint:** `GET /api/admin/analytics`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string | No | Start date (ISO 8601) |
| `end_date` | string | No | End date (ISO 8601) |
| `group_by` | string | No | Group by (day/week/month) |

**Response:**

```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    },
    "metrics": {
      "customer_growth": [
        { "date": "2024-01-01", "count": 100 },
        { "date": "2024-01-02", "count": 105 }
      ],
      "revenue_trends": [
        { "date": "2024-01-01", "amount": 5000 },
        { "date": "2024-01-02", "amount": 5200 }
      ],
      "course_completions": [
        { "date": "2024-01-01", "count": 10 },
        { "date": "2024-01-02", "count": 12 }
      ]
    }
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "success": false,
  "error": "Validation error message",
  "code": "VALIDATION_ERROR"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "FORBIDDEN"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

---

## Authentication

All admin endpoints require:

1. **Bearer Token** in the `Authorization` header:
   ```
   Authorization: Bearer <your_token>
   ```

2. **Developer Role**: The authenticated user must have the `developer` role.

---

## Rate Limiting

Admin endpoints may be subject to rate limiting. Check response headers for rate limit information:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

---

## Pagination

Endpoints that return lists support pagination:

- `page`: Page number (default: 1)
- `limit`: Items per page (default varies by endpoint)

Response includes:
- `total`: Total number of items
- `page`: Current page number
- `limit`: Items per page
- `total_pages`: Total number of pages

---

## Support

For API support or questions, contact: info@hive888.org
