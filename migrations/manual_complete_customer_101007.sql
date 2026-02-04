-- Manual completion script for Customer ID 101007
-- Completes all subsections before subsection 259 (final quiz)
-- Marks all required quizzes as passed

-- Step 1: Mark all subsections (except 259) as completed
INSERT INTO customer_subsection_progress (customer_id, subsection_id, status, completed_at)
SELECT 
    101037 as customer_id,
    id as subsection_id,
    'completed' as status,
    NOW() as completed_at
FROM subsections
WHERE id != 259  -- ALL subsections EXCEPT 259 (final quiz)
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    completed_at = NOW();

-- Step 2: Mark all required quizzes as passed (for subsections with quiz_required = 1)
-- Note: customer_section_quiz_status table uses section_id column but stores subsection_id
INSERT INTO customer_section_quiz_status (
    customer_id, 
    section_id,  -- This is actually subsection_id
    status, 
    score, 
    attempts, 
    last_attempt_at
)
SELECT 
    101037 as customer_id,
    s.id as section_id,  
    'passed' as status,
    85 as score,  
    1 as attempts,
    NOW() as last_attempt_at
FROM subsections s
WHERE s.id != 259  -- ALL subsections EXCEPT 259 (final quiz)
  AND s.quiz_required = 1  -- Only subsections that require a quiz  
ON DUPLICATE KEY UPDATE
    status = VALUES(status),
    score = VALUES(score),
    attempts = attempts + 1,
    last_attempt_at = NOW();

-- Step 3: Verify completion (run these queries to check)
-- Check completed subsections count
SELECT COUNT(*) as completed_subsections
FROM customer_subsection_progress
WHERE customer_id = 101037 
  AND status = 'completed'
  AND subsection_id != 259;

-- Check passed quizzes count
SELECT COUNT(*) as passed_quizzes
FROM customer_section_quiz_status
WHERE customer_id = 101037 
  AND status = 'passed'
  AND section_id != 259;

-- Check which subsections are completed
SELECT 
    csp.subsection_id,
    s.title as subsection_title,
    s.quiz_required,
    CASE 
        WHEN sqs.status = 'passed' THEN 'Quiz Passed'
        WHEN s.quiz_required = 1 THEN 'Quiz Missing'
        ELSE 'No Quiz Required'
    END as quiz_status
FROM customer_subsection_progress csp
LEFT JOIN subsections s ON csp.subsection_id = s.id
LEFT JOIN customer_section_quiz_status sqs ON sqs.customer_id = csp.customer_id 
    AND sqs.section_id = csp.subsection_id
WHERE csp.customer_id = 101037 
  AND csp.status = 'completed'
  AND csp.subsection_id != 259
ORDER BY csp.subsection_id;

-- Verify subsection 259 is NOT completed
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM customer_subsection_progress 
            WHERE customer_id = 101037 AND subsection_id = 259
        ) THEN 'ERROR: Subsection 259 is completed!'
        ELSE 'OK: Subsection 259 is not completed'
    END as final_quiz_status;

