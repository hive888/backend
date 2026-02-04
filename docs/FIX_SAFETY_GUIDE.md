# Fix Endpoint Safety Guide

## What Gets Fixed

### ✅ Safe to Fix Automatically

**sort_order values** - Display order only
- **What it does:** Reorders subsections to have sequential sort_order (1, 2, 3...) within each section
- **Why it's safe:**
  - Quizzes are linked by `subsection_id`, not `sort_order`
  - Progress tracking uses `subsection_id`, not `sort_order`
  - Navigation uses `id` comparison, not `sort_order`
  - Changing `sort_order` only affects how subsections are displayed/ordered in lists

### ❌ Cannot Be Fixed Automatically

**Navigation Issues (Broken Chains)**
- **Why:** Navigation uses `getNextIdInSection()` which finds next subsection by `id > currentId`
- **Issue:** If there's a gap in IDs (e.g., subsection 100 → 105, missing 101-104), navigation will skip
- **Fix requires:** Manual intervention - either create missing subsections or adjust IDs (risky!)

**Missing Quizzes**
- **Why:** Requires creating quiz questions and options, which needs content
- **Fix requires:** Manual creation via quiz endpoints

**ID Gaps**
- **Why:** IDs are usually auto-incremented and changing them is dangerous
- **Impact:** Usually informational only - doesn't break anything if navigation still works

---

## What We Change

When you run the fix endpoint, **ONLY** `sort_order` values are modified:

```sql
-- Example: If subsection 125 has sort_order = 5 but should be 3
UPDATE subsections 
SET sort_order = 3  -- Only this field changes
WHERE id = 125;     -- ID stays the same

-- Everything else stays the same:
-- - id: 125 (unchanged)
-- - section_id: 15 (unchanged)
-- - title: "Introduction" (unchanged)
-- - content_html: "..." (unchanged)
-- - quiz_required: 1 (unchanged)
```

---

## What Stays The Same

✅ **Subsection ID** - Never changed (primary key, used everywhere)
✅ **Quiz Links** - Quizzes linked by `subsection_id`, so they remain linked
✅ **Progress Tracking** - Tracks by `subsection_id`, so progress preserved
✅ **Navigation** - Uses `id` comparison, so navigation unaffected
✅ **Content** - All content remains unchanged
✅ **Section Assignment** - Subsection stays in same section

---

## Verification After Fix

After running a fix, you can verify:

```sql
-- Check sort_order was updated
SELECT id, title, section_id, sort_order 
FROM subsections 
WHERE section_id = 15
ORDER BY id;

-- Verify quizzes still linked
SELECT subsection_id, COUNT(*) as question_count
FROM subsection_quiz_questions
WHERE subsection_id IN (125, 126, 127)
GROUP BY subsection_id;

-- Check progress still tracked
SELECT subsection_id, COUNT(*) as completions
FROM customer_subsection_progress
WHERE subsection_id IN (125, 126, 127)
GROUP BY subsection_id;
```

---

## Common Concerns

### "Will it break my quizzes?"
❌ **No.** Quizzes are linked by `subsection_id`, which never changes.

### "Will users lose progress?"
❌ **No.** Progress is tracked by `subsection_id`, which never changes.

### "Will navigation break?"
❌ **No.** Navigation uses `id > currentId`, so changing `sort_order` has no effect.

### "What if I run it twice?"
✅ **Safe.** The fix is idempotent - running it multiple times produces the same result.

### "Can I undo changes?"
⚠️ **Not automatically.** But since only `sort_order` changes, you could restore from a backup or manually set `sort_order` values back.

---

## Example: Before and After

### Before Fix
```
Section 15 subsections:
- ID: 125, sort_order: 5, title: "Lesson 1"
- ID: 126, sort_order: 2, title: "Lesson 2"  
- ID: 127, sort_order: 8, title: "Lesson 3"
- ID: 128, sort_order: 2, title: "Lesson 4"  (duplicate!)
```

### After Fix
```
Section 15 subsections:
- ID: 125, sort_order: 1, title: "Lesson 1"  (was 5)
- ID: 126, sort_order: 2, title: "Lesson 2"  (was 2, unchanged)
- ID: 127, sort_order: 3, title: "Lesson 3"  (was 8)
- ID: 128, sort_order: 4, title: "Lesson 4"  (was 2, duplicate fixed)
```

**What changed:**
- ✅ sort_order values (sequential now)
- ❌ IDs (same: 125, 126, 127, 128)
- ❌ Quiz links (still linked to same subsection_ids)
- ❌ Progress (still tracked by same subsection_ids)
- ❌ Navigation (still: 125 → 126 → 127 → 128 by ID)

---

## Dry Run Recommendation

**Always use dry_run first:**

```bash
# Step 1: See what would change
POST /api/audit/subsection-navigation/fix
{"fix_type": "all", "dry_run": true}

# Review the fixes array to see what would change

# Step 2: If OK, apply for real
POST /api/audit/subsection-navigation/fix
{"fix_type": "all", "dry_run": false}
```

---

## When NOT to Use Fix

❌ Don't use if:
- You want to fix navigation chains (won't work - requires manual intervention)
- You want to create missing quizzes (won't work - requires manual creation)
- You have custom sort_order logic that depends on non-sequential values
- You're unsure - always use `dry_run: true` first!

✅ Safe to use when:
- You have duplicate sort_order values
- sort_order doesn't match ID order
- You want consistent sequential ordering within sections
- You've reviewed the dry_run output and it looks correct

