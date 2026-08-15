# Subsection Navigation Audit & Fix - Quick Guide

## Complete Workflow

### 1. Run Full Audit
```bash
GET /api/audit/subsection-navigation
```
**Purpose:** Identify all navigation and ordering issues

**Response:** Health status, list of issues, and detailed analysis

---

### 2. Preview Fixes (Dry Run)
```bash
POST /api/audit/subsection-navigation/fix
Content-Type: application/json

{
  "fix_type": "all",
  "dry_run": true
}
```
**Purpose:** See what would be fixed without making changes

---

### 3. Apply Fixes
```bash
POST /api/audit/subsection-navigation/fix
Content-Type: application/json

{
  "fix_type": "all",
  "dry_run": false
}
```
**Purpose:** Actually fix the issues

**What it fixes:**
- ✅ Duplicate sort_order values
- ✅ Sort_order mismatches (reorders by ID)
- ✅ Incorrect ordering within sections

---

### 4. Verify Fixes
```bash
GET /api/audit/subsection-navigation
```
**Purpose:** Confirm all issues are resolved

---

## Fix Specific Section

```bash
POST /api/audit/subsection-navigation/fix-section/15
Content-Type: application/json

{
  "dry_run": false
}
```
**Purpose:** Fix ordering issues in section 15 only

---

## Fix Single Subsection

```bash
POST /api/audit/subsection-navigation/fix/125
Content-Type: application/json

{
  "fix_type": "sort_order",
  "sort_order": 3,
  "dry_run": false
}
```
**Purpose:** Fix sort_order for subsection 125

---

## Common Scenarios

### Scenario 1: After Bulk Updates
```bash
# 1. Audit
GET /api/audit/subsection-navigation

# 2. Preview fixes
POST /api/audit/subsection-navigation/fix
{"dry_run": true}

# 3. Apply fixes
POST /api/audit/subsection-navigation/fix
{"dry_run": false}

# 4. Verify
GET /api/audit/subsection-navigation
```

### Scenario 2: Fix Single Section
```bash
# 1. Check section
GET /api/audit/subsection-navigation
# Look for issues in section_analysis

# 2. Fix that section
POST /api/audit/subsection-navigation/fix-section/15
{"dry_run": false}
```

### Scenario 3: Daily Health Check
```bash
# Monitor health status
GET /api/audit/subsection-navigation
# Check health_status field

# If UNHEALTHY or NEEDS_ATTENTION:
POST /api/audit/subsection-navigation/fix
{"fix_type": "all", "dry_run": false}
```

---

## Response Codes

| Code | Meaning |
|------|---------|
| `HEALTHY` | No issues found |
| `NEEDS_ATTENTION` | Minor ordering issues (can be auto-fixed) |
| `UNHEALTHY` | Critical issues (broken navigation, missing quizzes) |

---

## Important Notes

⚠️ **Always use `dry_run: true` first** to preview changes  
✅ Fixes use transactions - all or nothing  
🔒 All endpoints require authentication  
📝 Check logs for detailed fix information

---

## cURL Examples

### Full Audit
```bash
curl -X GET http://localhost:3000/api/audit/subsection-navigation \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Preview Fixes
```bash
curl -X POST http://localhost:3000/api/audit/subsection-navigation/fix \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fix_type": "all", "dry_run": true}'
```

### Apply Fixes
```bash
curl -X POST http://localhost:3000/api/audit/subsection-navigation/fix \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fix_type": "all", "dry_run": false}'
```

### Fix Section
```bash
curl -X POST http://localhost:3000/api/audit/subsection-navigation/fix-section/15 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

