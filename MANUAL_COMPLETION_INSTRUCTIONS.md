# Manual Completion Instructions for Customer 101007

This guide helps you manually complete all subsections (except the final quiz) for customer ID 101007 to test the exit exam payment flow.

## Quick Run

Execute the SQL script:

```bash
mysql -u your_user -p your_database < migrations/manual_complete_customer_101007_simple.sql
```

## Step-by-Step Manual Execution

### Step 1: Connect to Database

```bash
mysql -u your_user -p your_database
```

### Step 2: Mark All Subsections as Completed (except 259)

```sql
INSERT INTO customer_subsection_progress (customer_id, subsection_id, status, completed_at)
SELECT 
    101007,
    id,
    'completed',
    NOW()
FROM subsections
WHERE id < 259
ON DUPLICATE KEY UPDATE
    status = 'completed',
    completed_at = NOW();
```

### Step 3: Mark All Required Quizzes as Passed

```sql
INSERT INTO customer_section_quiz_status (
    customer_id, 
    section_id,
    status, 
    score, 
    attempts, 
    last_attempt_at
)
SELECT 
    101007,
    s.id,
    'passed',
    85,
    1,
    NOW()
FROM subsections s
WHERE s.id < 259
  AND s.quiz_required = 1
ON DUPLICATE KEY UPDATE
    status = 'passed',
    score = 85,
    attempts = attempts + 1,
    last_attempt_at = NOW();
```

### Step 4: Verify Completion

```sql
-- Check completed subsections count
SELECT COUNT(*) as completed_subsections
FROM customer_subsection_progress
WHERE customer_id = 101007 
  AND status = 'completed'
  AND subsection_id < 259;

-- Check passed quizzes count
SELECT COUNT(*) as passed_quizzes
FROM customer_section_quiz_status
WHERE customer_id = 101007 
  AND status = 'passed'
  AND section_id < 259;

-- Verify subsection 259 is NOT completed
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM customer_subsection_progress 
            WHERE customer_id = 101007 AND subsection_id = 259
        ) THEN 'ERROR: Subsection 259 is completed!'
        ELSE 'OK: Subsection 259 is not completed'
    END as final_quiz_status;
```

## What This Does

1. **Marks all subsections < 259 as completed** in `customer_subsection_progress` table
2. **Marks all required quizzes as passed** in `customer_section_quiz_status` table
3. **Leaves subsection 259 untouched** so the customer can test the exit exam payment flow

## Expected Result

After running the script:
- ✅ Customer 101007 has completed all subsections before the final quiz
- ✅ All required quizzes are marked as passed
- ✅ Subsection 259 (final quiz) is NOT completed
- ✅ Customer can now test the exit exam payment flow

## Testing the Exit Exam Payment Flow

After completion, test:

1. **Check exit exam payment status:**
   ```bash
   curl -X GET http://localhost:3000/api/course-access/exit-exam/payment/status \
     -H "Authorization: Bearer CUSTOMER_TOKEN"
   ```

2. **Complete the last subsection before 259** (should trigger exit exam payment prompt)

3. **Try to access final quiz** (should be blocked if payment not completed)

4. **Create exit exam payment** and complete it

5. **Access final quiz** (should work after payment)

## Troubleshooting

### If subsection 259 is already completed:

```sql
-- Remove completion for subsection 259
DELETE FROM customer_subsection_progress
WHERE customer_id = 101007 AND subsection_id = 259;

-- Remove quiz status for subsection 259
DELETE FROM customer_section_quiz_status
WHERE customer_id = 101007 AND section_id = 259;
```

### If you need to reset everything:

```sql
-- Remove all progress for customer 101007
DELETE FROM customer_subsection_progress WHERE customer_id = 101007;
DELETE FROM customer_section_quiz_status WHERE customer_id = 101007;

-- Then run the completion script again
```

### Check current progress:

```sql
-- See what's completed
SELECT 
    csp.subsection_id,
    s.title,
    csp.status,
    csp.completed_at
FROM customer_subsection_progress csp
LEFT JOIN subsections s ON csp.subsection_id = s.id
WHERE csp.customer_id = 101007
ORDER BY csp.subsection_id;
```

## Notes

- The script uses `ON DUPLICATE KEY UPDATE` so it's safe to run multiple times
- Quiz scores are set to 85 (passing score)
- All timestamps are set to current time
- Subsection 259 is explicitly excluded from completion

