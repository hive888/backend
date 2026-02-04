# API Endpoints Documentation

## Multi-Course Academy Endpoints (`/api/academy`)

### Course Catalog
- `GET /api/academy/courses` - List all active courses (public)
- `GET /api/academy/courses/me` - List courses with access status (authenticated)
- `GET /api/academy/courses/:slug` - Get course details by slug (public)
- `POST /api/academy/courses` - Create course (developer only)

### Course Access
- `GET /api/academy/courses/:slug/access` - Check if user has access to course
- `POST /api/academy/courses/:slug/redeem` - Redeem access code for course
- `GET /api/academy/courses/:slug/content` - Get full course content structure (chapters, sections, subsections) with progress

### Subsection Content
- `GET /api/academy/courses/:slug/subsections/:id` - Get subsection content (requires access + prerequisites)
- `POST /api/academy/courses/:slug/subsections/:id/complete` - Mark subsection as completed

### Quiz Endpoints
- `GET /api/academy/courses/:slug/sections/:id/quiz` - Get quiz info for subsection (note: `:id` is subsection_id)
- `POST /api/academy/courses/:slug/sections/:id/quiz/submit` - Submit quiz answers
- `POST /api/academy/courses/:slug/sections/:id/quiz` - Create quiz questions (developer only)
- `GET /api/academy/courses/:slug/sections/:id/quiz/admin` - Get admin view of quiz with correct answers (developer only)

---

## Legacy Course Access Endpoints (`/api/course-access`)

**⚠️ These endpoints are hardcoded to the self-study course and are kept for backward compatibility.**

- `POST /api/course-access/register` - Register for self-study course
- `GET /api/course-access` - Get subscription status and full content (self-study only)
- `GET /api/course-access/subsections/:id` - Get subsection content (self-study only)
- `POST /api/course-access/subsections/:id/complete` - Mark subsection complete (self-study only)
- `GET /api/course-access/sections/:id/quiz` - Get quiz info (self-study only, note: `:id` is subsection_id)
- `POST /api/course-access/sections/:id/quiz/submit` - Submit quiz (self-study only)
- `POST /api/course-access/sections/:id/quiz` - Create quiz (self-study only, developer)
- `GET /api/course-access/sections/:id/quiz/admin` - Get admin quiz view (self-study only, developer)

---

## Usage Examples

### Multi-Course (Recommended)
```bash
# Get course content for any course
GET /api/academy/courses/self-study/content
GET /api/academy/courses/tet/content

# Get subsection content
GET /api/academy/courses/self-study/subsections/20

# Complete subsection
POST /api/academy/courses/self-study/subsections/20/complete

# Get quiz
GET /api/academy/courses/self-study/sections/20/quiz

# Submit quiz
POST /api/academy/courses/self-study/sections/20/quiz/submit
Body: { "answers": [{ "question_id": 1, "option_id": 2 }] }
```

### Legacy (Self-Study Only)
```bash
# Get content (hardcoded to self-study)
GET /api/course-access

# Get subsection (hardcoded to self-study)
GET /api/course-access/subsections/20
```

---

## Key Differences

| Feature | Multi-Course (`/api/academy`) | Legacy (`/api/course-access`) |
|---------|-------------------------------|-------------------------------|
| Course Selection | Dynamic via `:slug` parameter | Hardcoded to self-study |
| Access Check | Uses `CustomerCourseAccess` table | Uses `SelfStudyRegistration` table |
| Flexibility | Works for any course | Self-study only |
| Recommended | ✅ Yes | ⚠️ Legacy/backward compatibility |

