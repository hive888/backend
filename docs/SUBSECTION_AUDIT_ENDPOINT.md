# Subsection Navigation Audit Endpoint

## Overview
This endpoint audits subsection navigation to identify broken chains, missing quizzes, and ordering issues. Use this to proactively identify problems before users encounter them.

## Endpoints

### 1. Full Audit
**GET** `/api/audit/subsection-navigation`

Audits all subsections in the system and reports:
- Navigation chain issues
- Missing quizzes (where required)
- Ordering problems
- Section-level analysis
- ID gaps

**Authentication:** Required (Bearer token)

**Response Example:**
```json
{
  "success": true,
  "health_status": "HEALTHY",
  "audit_timestamp": "2025-01-15T10:30:00.000Z",
  "summary": {
    "total_subsections": 250,
    "subsections_with_issues": 3,
    "broken_navigation_chains": 1,
    "missing_quizzes": 1,
    "ordering_issues": 1
  },
  "issues": [
    {
      "subsection_id": 125,
      "subsection_title": "Introduction to Trading",
      "section_id": 15,
      "issues": [
        {
          "type": "BROKEN_NAVIGATION",
          "severity": "HIGH",
          "message": "No next subsection found."
        }
      ]
    }
  ],
  "navigation_map": [...],
  "section_analysis": [...]
}
```

**Health Status Values:**
- `HEALTHY` - No critical issues found
- `NEEDS_ATTENTION` - Some ordering issues but navigation works
- `UNHEALTHY` - Critical issues (broken navigation or missing quizzes)

---

### 2. Single Subsection Audit
**GET** `/api/audit/subsection-navigation/:subsectionId`

Audits navigation for a specific subsection.

**Example:**
```
GET /api/audit/subsection-navigation/259
```

**Response Example:**
```json
{
  "success": true,
  "subsection": {
    "id": 259,
    "title": "Final Exam",
    "section_id": 25,
    "section_title": "Final Assessment",
    "chapter_title": "Completion",
    "sort_order": 100,
    "quiz_required": 1
  },
  "navigation": {
    "next_subsection_id": null,
    "next_subsection": null
  },
  "issues": [],
  "health_status": "HEALTHY"
}
```

---

## Issue Types

### BROKEN_NAVIGATION
- **Severity:** HIGH
- **Meaning:** Subsection has no next subsection but should (unless it's subsection 259 - final exam)
- **Action:** Check if subsection is actually the last one, or if next subsection is missing

### MISSING_QUIZ
- **Severity:** HIGH
- **Meaning:** Subsection requires a quiz but no questions are configured
- **Action:** Add quiz questions for this subsection

### QUIZ_NO_OPTIONS
- **Severity:** HIGH
- **Meaning:** Quiz has questions but no answer options
- **Action:** Add answer options to quiz questions

### ORDERING_ISSUE
- **Severity:** MEDIUM
- **Meaning:** Next subsection appears before current in sequence
- **Action:** Review subsection ordering in the section

### CROSS_SECTION_NAVIGATION
- **Severity:** INFO
- **Meaning:** Next subsection is in a different section (may be intentional)
- **Action:** Verify if this is intended behavior

### ID_GAP
- **Severity:** INFO
- **Meaning:** Gaps in subsection ID sequence
- **Action:** Usually informational, but may indicate deleted subsections

---

## Usage Examples

### cURL
```bash
# Full audit
curl -X GET http://localhost:3000/api/audit/subsection-navigation \
  -H "Authorization: Bearer YOUR_TOKEN"

# Single subsection audit
curl -X GET http://localhost:3000/api/audit/subsection-navigation/259 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:3000/api/audit/subsection-navigation', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const audit = await response.json();
console.log('Health Status:', audit.health_status);
console.log('Issues Found:', audit.summary.subsections_with_issues);
```

### Postman
1. Create new GET request
2. URL: `http://localhost:3000/api/audit/subsection-navigation`
3. Headers: `Authorization: Bearer YOUR_TOKEN`
4. Send request

---

## Recommended Usage

### Daily Monitoring
Run the full audit daily to catch issues early:
```bash
# Add to cron job or monitoring script
curl -X GET http://localhost:3000/api/audit/subsection-navigation \
  -H "Authorization: Bearer $AUDIT_TOKEN" \
  | jq '.health_status, .summary'
```

### Before Deployments
Run audit before deploying changes to course content to ensure navigation integrity.

### After Bulk Updates
After adding/removing subsections in bulk, run audit to verify navigation chains.

### Troubleshooting
When users report "stuck" or missing navigation, audit the specific subsection:
```
GET /api/audit/subsection-navigation/{reported_subsection_id}
```

---

## Response Interpretation

### Healthy System
```json
{
  "health_status": "HEALTHY",
  "summary": {
    "subsections_with_issues": 0,
    "broken_navigation_chains": 0,
    "missing_quizzes": 0
  }
}
```

### System Needing Attention
```json
{
  "health_status": "NEEDS_ATTENTION",
  "summary": {
    "ordering_issues": 2,
    "broken_navigation_chains": 0
  }
}
```

### Critical Issues
```json
{
  "health_status": "UNHEALTHY",
  "summary": {
    "broken_navigation_chains": 1,
    "missing_quizzes": 1
  },
  "issues": [
    {
      "subsection_id": 125,
      "issues": [
        {"type": "BROKEN_NAVIGATION", "severity": "HIGH"}
      ]
    }
  ]
}
```

---

---

## Fix/Repair Endpoints

### 3. Fix All Issues
**POST** `/api/audit/subsection-navigation/fix`

Automatically fixes common ordering issues found in the audit.

**Request Body:**
```json
{
  "fix_type": "all",
  "section_id": 15,      // Optional: fix specific section only
  "dry_run": true        // Optional: preview changes without applying (default: false)
}
```

**fix_type options:**
- `all` - Fix all ordering issues (default)
- `ordering` - Fix ordering issues only
- `sort_order` - Fix sort_order mismatches
- `duplicate_sort_orders` - Fix duplicate sort_order values

**Response Example:**
```json
{
  "success": true,
  "dry_run": false,
  "fix_type": "all",
  "fixes_applied": 5,
  "fixes": [
    {
      "type": "SORT_ORDER_FIXED",
      "subsection_id": 125,
      "subsection_title": "Introduction",
      "section_id": 15,
      "old_sort_order": 5,
      "new_sort_order": 3,
      "dry_run": false
    }
  ],
  "message": "Successfully applied 5 fixes"
}
```

---

### 4. Fix Single Subsection
**POST** `/api/audit/subsection-navigation/fix/:subsectionId`

Fix issues for a specific subsection.

**Example:**
```
POST /api/audit/subsection-navigation/fix/125
```

**Request Body:**
```json
{
  "fix_type": "sort_order",
  "sort_order": 3,
  "dry_run": false
}
```

---

### 5. Fix Section Ordering
**POST** `/api/audit/subsection-navigation/fix-section/:sectionId`

Fix all ordering issues within a specific section. Automatically reorders subsections by ID within the section.

**Example:**
```
POST /api/audit/subsection-navigation/fix-section/15
```

**Request Body:**
```json
{
  "dry_run": false
}
```

**Response Example:**
```json
{
  "success": true,
  "dry_run": false,
  "section_id": 15,
  "total_subsections": 10,
  "fixes_applied": 3,
  "fixes": [
    {
      "type": "SORT_ORDER_FIXED",
      "subsection_id": 125,
      "subsection_title": "Introduction",
      "old_sort_order": 5,
      "new_sort_order": 1,
      "dry_run": false
    }
  ],
  "message": "Successfully applied 3 fixes to section 15"
}
```

---

## Fix Workflow

### Step 1: Run Audit
```bash
curl -X GET http://localhost:3000/api/audit/subsection-navigation \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 2: Preview Fixes (Dry Run)
```bash
curl -X POST http://localhost:3000/api/audit/subsection-navigation/fix \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fix_type": "all", "dry_run": true}'
```

### Step 3: Apply Fixes
```bash
curl -X POST http://localhost:3000/api/audit/subsection-navigation/fix \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fix_type": "all", "dry_run": false}'
```

### Step 4: Verify
```bash
# Run audit again to verify fixes
curl -X GET http://localhost:3000/api/audit/subsection-navigation \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## What Can Be Fixed Automatically

✅ **Fixed Automatically:**
- Duplicate `sort_order` values within a section
- `sort_order` mismatches (not matching ID order)
- Reordering subsections within a section based on ID

❌ **Requires Manual Intervention:**
- Broken navigation chains (missing next subsection)
- Missing quizzes (requires creating quiz questions)
- Cross-section navigation issues (may be intentional)
- ID gaps (usually informational only)

---

## Notes

- Subsection 259 (final exam) is expected to have `null` as next_subsection_id
- The audit uses the current `getNextIdInSection()` method which finds next by ID
- Section ordering issues don't break navigation but may indicate data inconsistencies
- Quiz checks verify questions exist but don't validate answer correctness
- **Always use `dry_run: true` first** to preview changes before applying them
- Fix endpoints use transactions - all changes are rolled back on error

