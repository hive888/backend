# Newsletter Subscription API Documentation

## Overview

The Newsletter Subscription API allows users to subscribe to the Hive888 newsletter by providing their email address. Upon successful subscription, users receive a thank you email following Hive888's email standard.

---

## Endpoints

### 1. Subscribe to Newsletter

**POST** `/api/newsletter/subscribe`

Subscribe an email address to the newsletter.

**Authentication:** Not required (Public endpoint)

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully subscribed to newsletter!",
  "data": {
    "email": "user@example.com",
    "subscribed": true
  }
}
```

**Resubscription Response (200):**
```json
{
  "success": true,
  "message": "Successfully resubscribed to newsletter!",
  "data": {
    "email": "user@example.com",
    "subscribed": true
  }
}
```

**Error Responses:**

```json
// Missing email
{
  "success": false,
  "code": "EMAIL_REQUIRED",
  "message": "Email is required"
}

// Invalid email format
{
  "success": false,
  "code": "INVALID_EMAIL",
  "message": "Please provide a valid email address"
}

// Server error
{
  "success": false,
  "code": "SUBSCRIPTION_ERROR",
  "message": "Failed to process newsletter subscription"
}
```

---

### 2. Unsubscribe from Newsletter

**POST** `/api/newsletter/unsubscribe`

Unsubscribe an email address from the newsletter.

**Authentication:** Not required (Public endpoint)

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully unsubscribed from newsletter",
  "data": {
    "email": "user@example.com",
    "subscribed": false
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "code": "SUBSCRIBER_NOT_FOUND",
  "message": "Email not found in newsletter subscribers"
}
```

---

### 3. Get All Subscribers (Admin Only)

**GET** `/api/newsletter/subscribers`

Get a list of all active newsletter subscribers.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 100) - Results per page

**Example:**
```
GET /api/newsletter/subscribers?page=1&limit=50
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "subscribers": [
      {
        "email": "user1@example.com",
        "subscribed_at": "2025-01-15T10:30:00.000Z"
      },
      {
        "email": "user2@example.com",
        "subscribed_at": "2025-01-14T15:20:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 50
  }
}
```

---

## Usage Examples

### cURL

#### Subscribe
```bash
curl -X POST http://localhost:3000/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

#### Unsubscribe
```bash
curl -X POST http://localhost:3000/api/newsletter/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

#### Get Subscribers (Admin)
```bash
curl -X GET http://localhost:3000/api/newsletter/subscribers?page=1&limit=100 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### JavaScript (Fetch)

#### Subscribe
```javascript
const response = await fetch('http://localhost:3000/api/newsletter/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});

const result = await response.json();
console.log(result);
```

#### Unsubscribe
```javascript
const response = await fetch('http://localhost:3000/api/newsletter/unsubscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});

const result = await response.json();
console.log(result);
```

---

### React/Next.js Example

```jsx
import { useState } from 'react';

function NewsletterSubscribe() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.success) {
        setStatus({ type: 'success', message: data.message });
        setEmail('');
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to subscribe. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubscribe}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Subscribing...' : 'Subscribe'}
      </button>
      {status && (
        <div className={status.type === 'success' ? 'success' : 'error'}>
          {status.message}
        </div>
      )}
    </form>
  );
}
```

---

## Email Confirmation

Upon successful subscription, users receive a thank you email that includes:

- ✅ Welcome message
- ✅ Information about what to expect from the newsletter
- ✅ Benefits of subscribing
- ✅ Hive888 branding and styling
- ✅ Contact information

The email follows Hive888's standard email template with:
- Dark header (#0b1b32) with logo
- Clean, modern design
- Responsive layout
- Professional footer with contact details

---

## Database Schema

### newsletter_subscribers Table

```sql
CREATE TABLE `newsletter_subscribers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `status` ENUM('active', 'unsubscribed') NOT NULL DEFAULT 'active',
  `subscribed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unsubscribed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`),
  KEY `idx_status` (`status`),
  KEY `idx_subscribed_at` (`subscribed_at`)
);
```

---

## Features

✅ **Email Validation** - Validates email format before subscription
✅ **Duplicate Handling** - Automatically handles duplicate subscriptions
✅ **Resubscription** - Allows previously unsubscribed users to resubscribe
✅ **Thank You Email** - Sends professional thank you email upon subscription
✅ **Unsubscribe Support** - Easy unsubscribe functionality
✅ **Admin Access** - Get list of all subscribers (requires authentication)

---

## Environment Variables Required

Make sure these are set in your `.env` file:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
BASE_URL=https://yourdomain.com
```

---

## Setup Instructions

### 1. Run Database Migration

```bash
mysql -u your_user -p ptgr_db < migrations/newsletter_subscribers.sql
```

### 2. Verify Routes

The routes are automatically registered in `app.js`. Verify they're working:

```bash
curl -X POST http://localhost:3000/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 3. Test Email Sending

Make sure your email configuration is correct and test sending:

```bash
# The thank you email should be sent automatically upon subscription
```

---

## Notes

- Email addresses are normalized (lowercased and trimmed) before storage
- If a user is already subscribed, the subscription is simply updated (not duplicated)
- Unsubscribed users can resubscribe by using the subscribe endpoint again
- Thank you emails are sent asynchronously - subscription will succeed even if email sending fails (error is logged)
- The admin endpoint requires authentication via Bearer token

---

## Support

For questions or issues, contact: **info@hive888.org**

