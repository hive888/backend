# Event Management API Documentation

## Overview

The Event Management module allows admins to create, update, delete, and manage events, and allows clients to view events in a clean, structured format with the ability to search events by month.

**Base URL:** `/api/events` (Client) | `/api/admin/events` (Admin)

---

## Table of Contents

1. [Client Endpoints](#client-endpoints)
2. [Admin Endpoints](#admin-endpoints)
3. [Data Models](#data-models)
4. [Error Responses](#error-responses)

---

## Client Endpoints

All client endpoints are **public** (no authentication required).

### Get All Events

Get a list of all active events with optional filtering by month/year.

**Endpoint:** `GET /api/events`

**Authentication:** Not required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `month` | integer | No | Filter by month (1-12) |
| `year` | integer | No | Filter by year (2000-2100) |
| `start_date` | string | No | Filter events from this date (ISO 8601) |
| `end_date` | string | No | Filter events until this date (ISO 8601) |

**Example Request:**

```bash
# Get all events
GET /api/events

# Get events for January 2024
GET /api/events?month=1&year=2024

# Get events with pagination
GET /api/events?page=1&limit=10

# Get events in date range
GET /api/events?start_date=2024-01-01&end_date=2024-12-31
```

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
        "created_at": "2024-01-10T10:00:00.000Z",
        "updated_at": "2024-01-10T10:00:00.000Z"
      },
      {
        "event_id": 2,
        "event_name": "Blockchain Summit",
        "event_date": "2024-03-20",
        "short_description": "Annual blockchain technology summit",
        "created_at": "2024-01-15T14:30:00.000Z",
        "updated_at": "2024-01-15T14:30:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Notes:**
- Events are ordered by date (latest/upcoming first)
- Deleted events are automatically excluded
- Only active events are returned

---

### Get Event by ID

Get detailed information about a specific event.

**Endpoint:** `GET /api/events/:id`

**Authentication:** Not required

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Event ID |

**Example Request:**

```bash
GET /api/events/1
```

**Response:**

```json
{
  "success": true,
  "data": {
    "event_id": 1,
    "event_name": "Web3 Workshop",
    "event_date": "2024-02-15",
    "short_description": "Learn the fundamentals of Web3 technology",
    "detailed_content": "<h1>Web3 Workshop</h1><p>Join us for an intensive workshop on Web3 technology...</p><h2>Agenda</h2><ul><li>Introduction to Web3</li><li>Blockchain Basics</li><li>Smart Contracts</li><li>Hands-on Practice</li></ul><h2>Date & Time</h2><p>February 15, 2024<br>10:00 AM - 4:00 PM</p><h2>Location</h2><p>Hive888 Headquarters<br>123 Tech Street</p>",
    "created_at": "2024-01-10T10:00:00.000Z",
    "updated_at": "2024-01-10T10:00:00.000Z"
  }
}
```

**Error Responses:**

- `404 Not Found` - Event doesn't exist or has been deleted
- `400 Bad Request` - Invalid event ID format

---

## Admin Endpoints

All admin endpoints require **authentication** and the **`developer` role**.

### Get All Events (Admin)

Get all events including deleted ones (for admin management).

**Endpoint:** `GET /api/admin/events`

**Authentication:** Required (developer role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `search` | string | No | Search in event name or description |
| `start_date` | string | No | Filter events from this date (ISO 8601) |
| `end_date` | string | No | Filter events until this date (ISO 8601) |

**Example Request:**

```bash
GET /api/admin/events?page=1&limit=20&search=workshop
```

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

---

### Get Event by ID (Admin)

Get event details including deleted events.

**Endpoint:** `GET /api/admin/events/:id`

**Authentication:** Required (developer role)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Event ID |

**Response:**

```json
{
  "success": true,
  "data": {
    "event_id": 1,
    "event_name": "Web3 Workshop",
    "event_date": "2024-02-15",
    "short_description": "Learn the fundamentals of Web3 technology",
    "detailed_content": "<h1>Web3 Workshop</h1>...",
    "created_at": "2024-01-10T10:00:00.000Z",
    "updated_at": "2024-01-10T10:00:00.000Z",
    "deleted_at": null
  }
}
```

---

### Create Event

Create a new event.

**Endpoint:** `POST /api/admin/events`

**Authentication:** Required (developer role)

**Request Body:**

```json
{
  "event_name": "Web3 Workshop",
  "event_date": "2024-02-15",
  "short_description": "Learn the fundamentals of Web3 technology",
  "detailed_content": "<h1>Web3 Workshop</h1><p>Join us for an intensive workshop...</p>"
}
```

**Field Requirements:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_name` | string | Yes | Event name (1-255 characters) |
| `event_date` | string | Yes | Event date in ISO 8601 format (YYYY-MM-DD) |
| `short_description` | string | Yes | Short description (1-1000 characters) |
| `detailed_content` | string | Yes | Full event details (HTML supported) |

**Example Request:**

```bash
POST /api/admin/events
Content-Type: application/json

{
  "event_name": "Blockchain Summit 2024",
  "event_date": "2024-03-20",
  "short_description": "Annual blockchain technology summit featuring industry leaders",
  "detailed_content": "<h1>Blockchain Summit 2024</h1><h2>Overview</h2><p>Join us for the annual blockchain summit...</p><h2>Speakers</h2><ul><li>John Doe - CEO, Blockchain Corp</li><li>Jane Smith - CTO, Crypto Inc</li></ul>"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "event_id": 3,
    "event_name": "Blockchain Summit 2024",
    "event_date": "2024-03-20",
    "short_description": "Annual blockchain technology summit featuring industry leaders",
    "detailed_content": "<h1>Blockchain Summit 2024</h1>...",
    "created_at": "2024-01-20T12:00:00.000Z",
    "updated_at": "2024-01-20T12:00:00.000Z"
  }
}
```

**Notes:**
- `event_id` is auto-generated
- `created_at` and `updated_at` are automatically set
- HTML content in `detailed_content` is stored as-is (sanitization recommended on frontend)

---

### Update Event

Update an existing event.

**Endpoint:** `PUT /api/admin/events/:id`

**Authentication:** Required (developer role)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Event ID |

**Request Body:**

```json
{
  "event_name": "Updated Web3 Workshop",
  "event_date": "2024-02-20",
  "short_description": "Updated description",
  "detailed_content": "<h1>Updated Content</h1>..."
}
```

**Example Request:**

```bash
PUT /api/admin/events/1
Content-Type: application/json

{
  "event_name": "Advanced Web3 Workshop",
  "event_date": "2024-02-20",
  "short_description": "Advanced workshop on Web3 technology and DeFi",
  "detailed_content": "<h1>Advanced Web3 Workshop</h1>..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Event updated successfully",
  "data": {
    "event_id": 1,
    "event_name": "Advanced Web3 Workshop",
    "event_date": "2024-02-20",
    "short_description": "Advanced workshop on Web3 technology and DeFi",
    "detailed_content": "<h1>Advanced Web3 Workshop</h1>...",
    "created_at": "2024-01-10T10:00:00.000Z",
    "updated_at": "2024-01-20T15:30:00.000Z"
  }
}
```

**Notes:**
- `event_id` remains the same
- `updated_at` is automatically updated
- Cannot update deleted events

---

### Delete Event

Soft delete an event (marks as deleted but doesn't remove from database).

**Endpoint:** `DELETE /api/admin/events/:id`

**Authentication:** Required (developer role)

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Event ID |

**Example Request:**

```bash
DELETE /api/admin/events/1
```

**Response:**

```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

**Notes:**
- Event is soft-deleted (sets `deleted_at` timestamp)
- Deleted events won't appear in client endpoints
- Deleted events can still be viewed in admin endpoints
- Event can be restored by updating `deleted_at` to NULL (future feature)

---

## Data Models

### Event Object

```typescript
interface Event {
  event_id: number;              // Auto-generated unique identifier
  event_name: string;            // Event name (1-255 characters)
  event_date: string;            // Event date (YYYY-MM-DD format)
  short_description: string;      // Short description (1-1000 characters)
  detailed_content: string;      // Full event details (HTML supported)
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
  deleted_at?: string | null;    // ISO 8601 timestamp (admin only)
}
```

### Event List Response

```typescript
interface EventListResponse {
  success: boolean;
  data: {
    events: Event[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "All fields are required: event_name, event_date, short_description, detailed_content",
  "code": "MISSING_FIELDS"
}
```

```json
{
  "success": false,
  "error": "Invalid date format. Use YYYY-MM-DD",
  "code": "INVALID_DATE_FORMAT"
}
```

```json
{
  "success": false,
  "error": "Valid event ID is required",
  "code": "INVALID_EVENT_ID"
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
  "error": "Event not found",
  "code": "EVENT_NOT_FOUND"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to fetch events",
  "code": "SERVER_ERROR"
}
```

---

## Usage Examples

### Client: Get Events for Current Month

```javascript
// Get events for January 2024
const response = await fetch('/api/events?month=1&year=2024');
const data = await response.json();

// Display events
data.data.events.forEach(event => {
  console.log(`${event.event_name} - ${event.event_date}`);
});
```

### Client: Search Events by Date Range

```javascript
// Get events between two dates
const startDate = '2024-01-01';
const endDate = '2024-03-31';

const response = await fetch(
  `/api/events?start_date=${startDate}&end_date=${endDate}`
);
const data = await response.json();
```

### Admin: Create Event

```javascript
const eventData = {
  event_name: "Web3 Workshop",
  event_date: "2024-02-15",
  short_description: "Learn Web3 fundamentals",
  detailed_content: "<h1>Web3 Workshop</h1><p>Join us...</p>"
};

const response = await fetch('/api/admin/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(eventData)
});

const result = await response.json();
console.log('Event created:', result.data.event_id);
```

### Admin: Update Event

```javascript
const eventId = 1;
const updatedData = {
  event_name: "Updated Event Name",
  event_date: "2024-02-20",
  short_description: "Updated description",
  detailed_content: "<h1>Updated Content</h1>..."
};

const response = await fetch(`/api/admin/events/${eventId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(updatedData)
});
```

### Admin: Delete Event

```javascript
const eventId = 1;

const response = await fetch(`/api/admin/events/${eventId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
```

---

## Database Setup

Run the migration to create the events table:

```bash
mysql -u your_user -p your_database < migrations/events.sql
```

Or manually:

```sql
CREATE TABLE IF NOT EXISTS `events` (
  `event_id` BIGINT NOT NULL AUTO_INCREMENT,
  `event_name` VARCHAR(255) NOT NULL,
  `event_date` DATE NOT NULL,
  `short_description` TEXT NOT NULL,
  `detailed_content` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  INDEX `idx_event_date` (`event_date`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Security Notes

1. **HTML Content**: The `detailed_content` field accepts HTML. It's recommended to sanitize HTML on the frontend before displaying to prevent XSS attacks.

2. **Soft Delete**: Events are soft-deleted (not permanently removed) to maintain data integrity and allow for potential restoration.

3. **Date Validation**: All dates must be in ISO 8601 format (YYYY-MM-DD). Invalid dates will return a 400 error.

4. **Content Length**: 
   - `event_name`: Maximum 255 characters
   - `short_description`: Maximum 1000 characters
   - `detailed_content`: No limit (LONGTEXT)

---

## Future Extensions

The system is designed to support future extensions:

- Event images
- Event tags/categories
- Event registration
- Ticketing system
- Notifications
- Comments/likes
- Event location/venue
- Event capacity/attendance tracking

---

## Support

For API support or questions, contact: info@hive888.org


