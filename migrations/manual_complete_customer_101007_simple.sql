-- ============================================================
-- Manual Completion Script for Customer ID 101007
-- Completes all subsections before subsection 259 (final quiz)
-- ============================================================

-- STEP 1: Mark all subsections (except 259) as completed
-- This marks all subsections with ID < 259 as completed
INSERT INTO customer_subsection_progress (customer_id, subsection_id, status, completed_at)
SELECT 
    101007,
    id,
    'completed',
    NOW()
FROM subsections
WHERE id != 259  -- ALL subsections EXCEPT 259 (final quiz) - includes 260, 261, etc.
ON DUPLICATE KEY UPDATE
    status = 'completed',
    completed_at = NOW();

-- STEP 2: Mark all required quizzes as PASSED
-- For subsections that require a quiz (quiz_required = 1), mark them as passed
-- Note: customer_section_quiz_status.section_id actually stores subsection_id
INSERT INTO customer_section_quiz_status (
    customer_id, 
    section_id,  -- This column stores subsection_id
    status, 
    score, 
    attempts, 
    last_attempt_at
)
SELECT 
    101037,
    s.id,  -- subsection_id
    'passed',
    85,  -- Passing score (adjust if needed)
    1,
    NOW()
FROM subsections s
WHERE s.id != 259  -- ALL subsections EXCEPT 259 (final quiz) - includes 260, 261, etc.
  AND s.quiz_required = 1  -- Only subsections that require a quiz
ON DUPLICATE KEY UPDATE
    status = 'passed',
    score = 85,
    attempts = attempts + 1,
    last_attempt_at = NOW();

-- ============================================================
-- VERIFICATION QUERIES (Run these to verify completion)
-- ============================================================

-- Check total completed subsections
SELECT 
    COUNT(*) as total_completed,
    'Subsections completed (excluding 259)' as description
FROM customer_subsection_progress
WHERE customer_id = 101007 
  AND status = 'completed'
  AND subsection_id != 259;

-- Check total passed quizzes
SELECT 
    COUNT(*) as total_passed_quizzes,
    'Quizzes passed' as description
FROM customer_section_quiz_status
WHERE customer_id = 101007 
  AND status = 'passed'
  AND section_id != 259;

-- Verify subsection 259 is NOT completed
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM customer_subsection_progress 
            WHERE customer_id = 101007 AND subsection_id = 259 AND status = 'completed'
        ) THEN '❌ ERROR: Subsection 259 is completed!'
        ELSE '✅ OK: Subsection 259 is not completed (ready for exit exam)'
    END as final_quiz_status;

-- Show summary of completed subsections
SELECT 
    csp.subsection_id,
    s.title as subsection_title,
    s.quiz_required,
    CASE 
        WHEN sqs.status = 'passed' THEN '✅ Quiz Passed'
        WHEN s.quiz_required = 1 THEN '⚠️ Quiz Missing'
        ELSE 'ℹ️ No Quiz Required'
    END as quiz_status,
    csp.completed_at
FROM customer_subsection_progress csp
LEFT JOIN subsections s ON csp.subsection_id = s.id
LEFT JOIN customer_section_quiz_status sqs ON sqs.customer_id = csp.customer_id 
    AND sqs.section_id = csp.subsection_id
WHERE csp.customer_id = 101037 
  AND csp.status = 'completed'
  AND csp.subsection_id != 259
ORDER BY csp.subsection_id DESC
LIMIT 20;  -- Show last 20 completed subsections

