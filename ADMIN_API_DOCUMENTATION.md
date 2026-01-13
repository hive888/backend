# Admin Dashboard API Documentation

Complete API documentation for course content management, quiz management, and user learning status tracking.

**Base URL:** `/api`  
**Authentication:** All endpoints require Bearer token with `developer` role  
**Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Course Management](#course-management)
3. [Content Management](#content-management)
   - [Chapters](#chapters)
   - [Sections](#sections)
   - [Subsections](#subsections)
4. [Quiz Management](#quiz-management)
5. [User Learning Status & Progress](#user-learning-status--progress)
6. [Access Code Management](#access-code-management)
7. [User Management](#user-management)

---

## Authentication

All admin endpoints require:
- **Header:** `Authorization: Bearer <access_token>`
- **Role:** `developer` role is required

---

## Course Management

### Create Course
**POST** `/api/academy/courses`

Create a new course in the catalog.

**Request Body:**
```json
{
  "slug": "blockchain-fundamentals",
  "title": "Blockchain Fundamentals",
  "short_description": "Introduction to blockchain technology",
  "detailed_description": "Comprehensive course covering blockchain basics, cryptography, and applications",
  "thumbnail_url": "https://example.com/thumbnail.jpg",
  "is_active": true
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "id": 3,
    "slug": "blockchain-fundamentals",
    "title": "Blockchain Fundamentals",
    "short_description": "Introduction to blockchain technology",
    "detailed_description": "Comprehensive course covering blockchain basics...",
    "thumbnail_url": "https://example.com/thumbnail.jpg",
    "is_active": 1
  }
}
```

---

## Content Management

### Chapters

#### List All Chapters
**GET** `/api/chapters`

Get all chapters with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 300)
- `sortBy` (optional): Sort field (default: `sort_order`)
- `order` (optional): Sort order - `ASC` or `DESC` (default: `ASC`)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "chapters": [
      {
        "id": 11,
        "title": "Blockchain Ecosystem",
        "description": null,
        "sort_order": 1,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 300
  }
}
```

#### Get Chapter by ID
**GET** `/api/chapters/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 11,
    "title": "Blockchain Ecosystem",
    "description": null,
    "sort_order": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Create Chapter
**POST** `/api/chapters`

**Request Body:**
```json
{
  "title": "New Chapter",
  "description": "Chapter description (optional)",
  "sort_order": 1
}
```

#### Update Chapter
**PUT** `/api/chapters/:id`

**Request Body:**
```json
{
  "title": "Updated Chapter Title",
  "description": "Updated description",
  "sort_order": 2
}
```

#### Delete Chapter
**DELETE** `/api/chapters/:id`

---

### Sections

#### List All Sections
**GET** `/api/sections`

**Query Parameters:** Same as chapters (page, limit, sortBy, order)

#### Get Sections by Chapter
**GET** `/api/sections/chapter/:chapterId`

Get all sections for a specific chapter.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": 11,
        "chapter_id": 11,
        "title": "Entry into blockchain technology",
        "subtitle": "Entry into blockchain technology",
        "sort_order": 1,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 2
  }
}
```

#### Get Section by ID
**GET** `/api/sections/:id`

#### Create Section
**POST** `/api/sections`

**Request Body:**
```json
{
  "chapter_id": 11,
  "title": "New Section",
  "subtitle": "Section subtitle (optional)",
  "sort_order": 1
}
```

#### Update Section
**PUT** `/api/sections/:id`

#### Delete Section
**DELETE** `/api/sections/:id`

---

### Subsections

#### List All Subsections
**GET** `/api/subsections`

**Query Parameters:** Same as chapters

#### Get Subsections by Section
**GET** `/api/subsections/section/:sectionId`

Get all subsections for a specific section.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subsections": [
      {
        "id": 20,
        "section_id": 11,
        "title": "The birth of Bitcoin",
        "content_html": "<p>Content here...</p>",
        "duration": 0,
        "quiz_required": 0,
        "quiz_pass_score": 70,
        "sort_order": 1,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 5
  }
}
```

#### Get Subsection by ID
**GET** `/api/subsections/:id`

#### Create Subsection
**POST** `/api/subsections`

**Request Body:**
```json
{
  "section_id": 11,
  "title": "New Subsection",
  "content_html": "<p>Content here...</p>",
  "duration": 15,
  "quiz_required": 1,
  "quiz_pass_score": 70,
  "sort_order": 1
}
```

#### Update Subsection
**PUT** `/api/subsections/:id`

#### Delete Subsection
**DELETE** `/api/subsections/:id`

---

## Quiz Management

### Get Quiz (Admin View with Correct Answers)
**GET** `/api/academy/courses/:slug/sections/:id/quiz/admin`

Get quiz with correct answers marked (admin view).

**Note:** `:id` parameter is the `subsection_id`, not section_id.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subsection_id": 21,
    "quiz_required": true,
    "pass_score": 70,
    "questions": [
      {
        "question_id": 15,
        "prompt_html": "What makes blockchains resistant to manipulation?",
        "sort_order": 7,
        "options": [
          {
            "option_id": 49,
            "text_html": "Blocks are interlinked using cryptographic hashes...",
            "is_correct": 1,
            "sort_order": 3
          },
          {
            "option_id": 47,
            "text_html": "Each block is signed by an independent authority...",
            "is_correct": 0,
            "sort_order": 1
          }
        ]
      }
    ]
  }
}
```

### Create Quiz Questions
**POST** `/api/academy/courses/:slug/sections/:id/quiz`

Create quiz questions for a subsection.

**Note:** `:id` parameter is the `subsection_id`.

**Request Body:**
```json
{
  "questions": [
    {
      "prompt_html": "What is blockchain?",
      "sort_order": 1,
      "options": [
        {
          "text_html": "A distributed ledger",
          "is_correct": 1,
          "sort_order": 1
        },
        {
          "text_html": "A database",
          "is_correct": 0,
          "sort_order": 2
        },
        {
          "text_html": "A cryptocurrency",
          "is_correct": 0,
          "sort_order": 3
        },
        {
          "text_html": "A programming language",
          "is_correct": 0,
          "sort_order": 4
        }
      ]
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Created 1 question(s) with options.",
  "data": {
    "subsection_id": 21,
    "created": [
      {
        "question_id": 25,
        "option_ids": [100, 101, 102, 103]
      }
    ]
  }
}
```

### Alternative: Manage Quiz Questions Directly

#### List Quiz for Subsection
**GET** `/api/subsection-quizzes/:subsectionId`

Get all questions and options for a subsection.

#### Create Question
**POST** `/api/subsection-quizzes/:subsectionId/questions`

**Request Body:**
```json
{
  "prompt_html": "What is Bitcoin?",
  "sort_order": 1
}
```

#### Update Question
**PUT** `/api/subsection-quizzes/questions/:questionId`

**Request Body:**
```json
{
  "prompt_html": "Updated question text",
  "sort_order": 2
}
```

#### Delete Question
**DELETE** `/api/subsection-quizzes/questions/:questionId`

#### Create Option
**POST** `/api/subsection-quizzes/questions/:questionId/options`

**Request Body:**
```json
{
  "text_html": "A decentralized cryptocurrency",
  "is_correct": 1,
  "sort_order": 1
}
```

#### Update Option
**PUT** `/api/subsection-quizzes/options/:optionId`

#### Delete Option
**DELETE** `/api/subsection-quizzes/options/:optionId`

---

## User Learning Status & Progress

### Get User Course Progress
**GET** `/api/academy/courses/:slug/content`

Get full course content structure with user's progress.

**Response (200):**
```json
{
  "success": true,
  "decision": "SUBSCRIBED",
  "message": "You are subscribed.",
  "subscribed": true,
  "data": {
    "course": {
      "id": 2,
      "slug": "self-study",
      "title": "Self Study Program"
    },
    "customer_id": 101007,
    "status": "active",
    "expires_at": null,
    "access_code_id": 2
  },
  "content": {
    "data": [
      {
        "id": "11",
        "title": "Blockchain Ecosystem",
        "description": null,
        "locked": 0,
        "sections": [
          {
            "id": "11-11",
            "title": "Entry into blockchain technology",
            "description": "Entry into blockchain technology",
            "locked": 0,
            "subsections": [
              {
                "id": "20",
                "title": "The birth of Bitcoin",
                "description": null,
                "duration": 0,
                "completed": true,
                "locked": 0,
                "sequence": 1,
                "chapter": 11,
                "quiz_required": false,
                "quiz_status": "not_started"
              },
              {
                "id": "21",
                "title": "Breakthrough of epochal significance",
                "description": null,
                "duration": 0,
                "completed": false,
                "locked": 0,
                "sequence": 2,
                "chapter": 11,
                "quiz_required": true,
                "quiz_status": "not_started"
              }
            ],
            "meta": {
              "totalSubsections": 2,
              "completedSubsections": 1,
              "progress": 50,
              "duration": 0
            }
          }
        ],
        "chapterDuration": 0,
        "meta": {
          "totalSections": 1,
          "totalSubsections": 2,
          "completedSubsections": 1,
          "progress": 50,
          "duration": 0
        }
      }
    ],
    "meta": {
      "totalChapters": 1,
      "progress": 50
    }
  }
}
```

### Get User Quiz Status
**GET** `/api/academy/courses/:slug/sections/:id/quiz`

Get user's quiz status and questions (without correct answers).

**Note:** `:id` parameter is the `subsection_id`.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subsection_id": 21,
    "quiz_required": true,
    "pass_score": 70,
    "status": "passed",
    "attempts": 2,
    "score": 85,
    "last_attempt_at": "2024-01-15T10:30:00.000Z",
    "questions": [
      {
        "question_id": 15,
        "prompt_html": "What makes blockchains resistant to manipulation?",
        "sort_order": 7,
        "options": [
          {
            "option_id": 49,
            "text_html": "Blocks are interlinked using cryptographic hashes...",
            "sort_order": 3
          }
        ]
      }
    ]
  }
}
```

### Get All Customers with Course Access
**GET** `/api/admin/customers`

List all customers with pagination and filters.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search by name or email
- `customer_type` (optional): Filter by `individual` or `enterprise`
- `is_active` (optional): Filter by active status (0 or 1)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "customer_id": 101007,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "customer_type": "individual",
        "is_active": 1,
        "is_email_verified": 1,
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

### Get Customer Details (with Course Access)
**GET** `/api/admin/customers/:id`

Get detailed customer information including course access.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "customer_id": 101007,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "customer_type": "individual",
    "is_active": 1,
    "is_email_verified": 1,
    "is_phone_verified": 1,
    "is_kyc_verified": 0,
    "created_at": "2024-01-01T00:00:00.000Z",
    "course_access": [
      {
        "course_id": 2,
        "course_slug": "self-study",
        "course_title": "Self Study Program",
        "status": "active",
        "expires_at": null,
        "granted_via": "access_code",
        "access_code_id": 2
      }
    ]
  }
}
```

### Get Customer Progress (Custom Query)

To get detailed progress for a specific customer, you can:

1. **Get customer's completed subsections:**
   - Query the `customer_subsection_progress` table directly
   - Filter by `customer_id` and `status = 'completed'`

2. **Get customer's quiz results:**
   - Query the `customer_section_quiz_status` table
   - Note: `section_id` column stores `subsection_id`
   - Fields: `status`, `score`, `attempts`, `last_attempt_at`

3. **Get customer's course access:**
   - Query the `customer_course_access` table
   - Fields: `course_id`, `status`, `expires_at`, `granted_via`

**Example SQL Query:**
```sql
-- Get customer progress summary
SELECT 
  c.customer_id,
  c.first_name,
  c.last_name,
  c.email,
  cca.course_id,
  co.title as course_title,
  COUNT(DISTINCT csp.subsection_id) as completed_subsections,
  COUNT(DISTINCT csqs.section_id) as quizzes_attempted
FROM customers c
LEFT JOIN customer_course_access cca ON c.customer_id = cca.customer_id
LEFT JOIN courses co ON cca.course_id = co.id
LEFT JOIN customer_subsection_progress csp ON c.customer_id = csp.customer_id AND csp.status = 'completed'
LEFT JOIN customer_section_quiz_status csqs ON c.customer_id = csqs.customer_id
WHERE c.customer_id = ?
GROUP BY c.customer_id, cca.course_id;
```

---

## Access Code Management

### List Access Codes
**GET** `/api/admin/access-codes`

Get all access codes with filters.

**Query Parameters:**
- `course_id` (optional): Filter by course
- `is_active` (optional): Filter by active status
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_codes": [
      {
        "id": 2,
        "code": "PTGR2025",
        "course_id": 2,
        "course_title": "Self Study Program",
        "is_active": 1,
        "max_uses": 100,
        "used_count": 45,
        "expires_at": null,
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20
    }
  }
}
```

### Get Access Code Details
**GET** `/api/admin/access-codes/:id`

Get detailed access code information including usage statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "code": "PTGR2025",
    "course_id": 2,
    "course_title": "Self Study Program",
    "is_active": 1,
    "max_uses": 100,
    "used_count": 45,
    "remaining_uses": 55,
    "expires_at": null,
    "created_at": "2024-01-01T00:00:00.000Z",
    "usage_history": [
      {
        "customer_id": 101007,
        "customer_name": "John Doe",
        "customer_email": "user@example.com",
        "used_at": "2024-01-10T12:00:00.000Z"
      }
    ]
  }
}
```

### Create Access Code
**POST** `/api/admin/access-codes`

**Request Body:**
```json
{
  "code": "NEWCODE2025",
  "course_id": 2,
  "is_active": true,
  "max_uses": 50,
  "expires_at": "2025-12-31T23:59:59.000Z"
}
```

### Update Access Code
**PUT** `/api/admin/access-codes/:id`

**Request Body:**
```json
{
  "is_active": false,
  "max_uses": 100
}
```

---

## User Management

### Update Customer
**PUT** `/api/admin/customers/:id`

Update customer information (admin only).

**Request Body:**
```json
{
  "first_name": "Updated Name",
  "last_name": "Updated Lastname",
  "customer_type": "enterprise",
  "is_active": 1
}
```

### Delete Customer
**DELETE** `/api/admin/customers/:id`

Soft delete a customer (sets `deleted_at` timestamp).

---

## Dashboard Statistics

### Get Dashboard Stats
**GET** `/api/admin/dashboard`

Get comprehensive dashboard statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "customers": {
      "total_customers": 150,
      "active_customers": 145,
      "inactive_customers": 5,
      "email_verified": 140,
      "phone_verified": 130,
      "kyc_verified": 50,
      "individual": 120,
      "enterprise": 30,
      "new_today": 5,
      "new_this_week": 25,
      "new_this_month": 80
    },
    "users": {
      "total_users": 150,
      "users_with_customers": 150,
      "local_auth": 100,
      "google_auth": 50
    },
    "contests": {
      "total_contests": 5,
      "total_registrations": 200,
      "unique_participants": 150,
      "contests_created_today": 0
    },
    "talent_pool": {
      "total_registrations": 80,
      "pending": 20,
      "approved": 50,
      "rejected": 10,
      "new_today": 2
    },
    "recent_activity": [
      {
        "customer_id": 101007,
        "first_name": "John",
        "last_name": "Doe",
        "email": "user@example.com",
        "customer_type": "individual",
        "created_at": "2024-01-15T10:00:00.000Z"
      }
    ],
    "customer_trends": [
      {
        "date": "2024-01-15",
        "count": 5
      },
      {
        "date": "2024-01-14",
        "count": 3
      }
    ]
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "No token provided",
  "code": "NO_AUTH_TOKEN"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

**500 Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "SERVER_ERROR"
}
```

---

## Notes

1. **Quiz Management:** The route parameter `:id` in quiz endpoints refers to `subsection_id`, not `section_id`. This is kept for backward compatibility.

2. **Progress Tracking:** User progress is tracked in two tables:
   - `customer_subsection_progress` - Tracks completed subsections
   - `customer_section_quiz_status` - Tracks quiz attempts and scores (note: `section_id` column stores `subsection_id`)

3. **Course Access:** Course access is managed through the `customer_course_access` table, which links customers to courses via access codes.

4. **Content Hierarchy:** 
   - Courses → Chapters → Sections → Subsections
   - Each subsection can have a quiz
   - Progress is tracked at the subsection level

5. **Authentication:** All admin endpoints require the `developer` role. Regular users cannot access these endpoints.
