# Customers with Course Progress Endpoint

## Overview

This endpoint provides a list of all customers who have made progress on courses (i.e., have at least one completed subsection). It's designed for use in the admin dashboard to track customer engagement with course content.

## Endpoint

**GET** `/api/admin/customers/with-progress`

## Authentication

- **Required:** Yes
- **Role:** `developer`
- **Header:** `Authorization: Bearer <token>`

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 20 | Number of items per page |
| `search` | string | No | '' | Search by first name, last name, full name, or email |
| `sort_by` | string | No | `completed_at` | Sort field (see sort options below) |
| `sort_order` | string | No | `DESC` | Sort direction: `ASC` or `DESC` |

### Sort Options

The `sort_by` parameter accepts the following values:

- `completed_at` - Sort by most recent completion (default)
- `first_completed_at` - Sort by first completion date
- `last_completed_at` - Sort by last completion date
- `completed_subsections` - Sort by number of completed subsections
- `first_name` - Sort by first name alphabetically
- `last_name` - Sort by last name alphabetically
- `email` - Sort by email alphabetically
- `created_at` - Sort by account creation date

## Response Format

### Success Response (200 OK)

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

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `customer_id` | integer | Unique customer identifier |
| `first_name` | string | Customer's first name |
| `last_name` | string | Customer's last name |
| `full_name` | string | Concatenated full name (first_name + " " + last_name) |
| `email` | string | Customer's email address |
| `phone` | string | Customer's phone number |
| `profile_picture` | string\|null | URL to customer's profile picture, or null if not set |
| `access_code` | string\|null | Access code the customer used (if available) |
| `access_code_id` | integer\|null | Access code ID (if available) |
| `access_code_source` | string\|null | Where the access code was read from: `customer_course_access` or `selfstudy_registrations` |
| `completed_subsections` | integer | Total count of unique subsections completed by this customer |
| `first_completed_at` | string\|null | ISO 8601 timestamp of the first completed subsection |
| `last_completed_at` | string\|null | ISO 8601 timestamp of the most recent completed subsection |
| `created_at` | string | ISO 8601 timestamp of customer account creation |

## Example Requests

### Basic Request

```bash
curl -X GET "https://api.hive888.org/api/admin/customers/with-progress" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### With Pagination

```bash
curl -X GET "https://api.hive888.org/api/admin/customers/with-progress?page=2&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### With Search

```bash
curl -X GET "https://api.hive888.org/api/admin/customers/with-progress?search=john" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### With Sorting

```bash
curl -X GET "https://api.hive888.org/api/admin/customers/with-progress?sort_by=completed_subsections&sort_order=DESC" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Combined Parameters

```bash
curl -X GET "https://api.hive888.org/api/admin/customers/with-progress?page=1&limit=20&search=smith&sort_by=last_completed_at&sort_order=ASC" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Error Responses

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

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to retrieve customers with progress",
  "code": "SERVER_ERROR"
}
```

## Notes

1. **Filtering:** Only customers with at least one completed subsection are included in the results
2. **Progress Tracking:** The `completed_subsections` count represents unique subsections completed across all courses
3. **Search:** The search parameter searches across first name, last name, full name (concatenated), and email fields
4. **Performance:** The query uses `DISTINCT` and `GROUP BY` to ensure each customer appears only once, even if they have multiple progress records
5. **Default Sorting:** Results are sorted by most recent completion date (`last_completed_at`) in descending order by default

## Use Cases

- **Admin Dashboard:** Display a list of engaged customers
- **Analytics:** Track customer engagement metrics
- **Reporting:** Generate reports on course completion rates
- **Customer Support:** Quickly find customers who have made progress for support purposes

## Integration Example (JavaScript/React)

```javascript
async function fetchCustomersWithProgress(page = 1, limit = 20, search = '') {
  const token = localStorage.getItem('admin_token');
  
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search })
  });
  
  const response = await fetch(
    `https://api.hive888.org/api/admin/customers/with-progress?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch customers with progress');
  }
  
  return await response.json();
}

// Usage
const data = await fetchCustomersWithProgress(1, 20, 'john');
console.log(`Found ${data.data.pagination.total} customers with progress`);
data.data.customers.forEach(customer => {
  console.log(`${customer.full_name} - ${customer.completed_subsections} subsections completed`);
});
```

## Database Schema Reference

The endpoint queries the following tables:

- `customers` - Customer information
- `customer_subsection_progress` - Course progress tracking

The join condition:
```sql
customers.customer_id = customer_subsection_progress.customer_id
WHERE customer_subsection_progress.status = 'completed'
```

