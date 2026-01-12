# API Quick Reference Card

## Base URL
```
http://localhost:3000/api
```

## Authentication Header
```
Authorization: Bearer <access_token>
```

---

## 🔐 Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | ❌ | Login with username/password |
| POST | `/auth/google-login` | ❌ | Login with Google token |
| POST | `/auth/refresh` | ❌ | Refresh access token |
| POST | `/auth/logout` | ✅ | Logout and revoke tokens |

---

## 👤 Customers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/customers` | ❌ | Create customer |
| GET | `/customers` | ❌ | List customers |
| GET | `/customers/:id` | ✅ | Get customer by ID |
| PUT | `/customers/:id` | ✅ | Update customer |
| DELETE | `/customers/:id` | ✅ | Delete customer (dev only) |
| GET | `/customers/full-profile` | ✅ | Get full profile |
| PUT | `/customers/update/full-profile` | ✅ | Update full profile |
| POST | `/customers/phone/request-otp` | ❌ | Request phone OTP |
| POST | `/customers/phone/verify-otp` | ✅ | Verify phone OTP |
| POST | `/customers/send-verification-email` | ❌ | Send verification email |
| POST | `/customers/verify-email` | ❌ | Verify email |

---

## 👥 Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | ✅ | List users (dev only) |
| POST | `/users` | ❌ | Create user |
| GET | `/users/:id` | ✅ | Get user (dev only) |
| PUT | `/users/:id` | ✅ | Update user |
| POST | `/users/forgot-password` | ❌ | Request password reset |
| POST | `/users/reset-password` | ❌ | Reset password |
| GET | `/users/roles` | ✅ | Get roles (dev only) |
| POST | `/users/roles` | ✅ | Create role (dev only) |

---

## 📚 Course Access

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/course-access/register` | ✅ | Register for course |
| GET | `/course-access` | ✅ | Get subscription status |
| GET | `/course-access/subsections/:id` | ✅ | Get subsection content |
| POST | `/course-access/subsections/:id/complete` | ✅ | Complete subsection |
| GET | `/course-access/sections/:id/quiz` | ✅ | Get quiz info |
| POST | `/course-access/sections/:id/quiz/submit` | ✅ | Submit quiz |

---

## 🏆 Contests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/contest` | ❌ | List contests |
| GET | `/contest/:slug` | ❌ | Get contest by slug |
| POST | `/contest` | ✅ | Create contest |
| POST | `/contest/join` | ✅ | Join contest |
| GET | `/contest/check/me` | ✅ | Get my contest status |
| GET | `/contest/:slug/leaderboard` | ❌ | Get leaderboard |

---

## 💼 Talent Pool

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/talent-pool/register` | ❌ | Register for talent pool |
| GET | `/talent-pool/registrations` | ❌ | List registrations |
| GET | `/talent-pool/registrations/stats` | ❌ | Get statistics |
| GET | `/talent-pool/registrations/:id` | ❌ | Get registration |

---

## 📖 Course Structure

### Chapters
- `GET /chapters` - List chapters
- `GET /chapters/:id` - Get chapter
- `POST /chapters` - Create chapter
- `PUT /chapters/:id` - Update chapter
- `DELETE /chapters/:id` - Delete chapter

### Sections
- `GET /sections` - List sections
- `GET /sections/chapter/:chapterId` - Get by chapter
- `GET /sections/:id` - Get section
- `POST /sections` - Create section
- `PUT /sections/:id` - Update section
- `DELETE /sections/:id` - Delete section

### Subsections
- `GET /subsections` - List subsections
- `GET /subsections/section/:sectionId` - Get by section
- `GET /subsections/:id` - Get subsection
- `POST /subsections` - Create subsection
- `PUT /subsections/:id` - Update subsection
- `DELETE /subsections/:id` - Delete subsection

---

## 📝 Quizzes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/subsection-quizzes/:subsectionId` | ✅ | Get quiz |
| POST | `/subsection-quizzes/:subsectionId/questions` | ✅ | Create question |
| PUT | `/subsection-quizzes/questions/:questionId` | ✅ | Update question |
| DELETE | `/subsection-quizzes/questions/:questionId` | ✅ | Delete question |
| POST | `/subsection-quizzes/questions/:questionId/options` | ✅ | Create option |
| PUT | `/subsection-quizzes/options/:optionId` | ✅ | Update option |
| DELETE | `/subsection-quizzes/options/:optionId` | ✅ | Delete option |

---

## 🔔 Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhook/stripe-webhook` | ❌ | Stripe webhook handler |

---

## 🏥 Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Health check |

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## Common Request Examples

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"pass"}'
```

### Authenticated Request
```bash
curl -X GET http://localhost:3000/api/course-access \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### File Upload
```bash
curl -X POST http://localhost:3000/api/customers \
  -F "first_name=John" \
  -F "last_name=Doe" \
  -F "email=john@example.com" \
  -F "profile_picture=@/path/to/image.jpg"
```

---

**Legend:**
- ✅ = Requires authentication
- ❌ = Public endpoint

