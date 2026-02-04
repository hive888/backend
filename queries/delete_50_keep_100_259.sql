-- ============================================
-- DELETE 50 QUESTIONS FROM SUBSECTION 259
-- Keep only 100 questions (by sort_order)
-- ============================================
-- 
-- This will delete 50 questions, keeping the first 100 by sort_order
-- Options will be automatically deleted due to CASCADE foreign key
--
-- ============================================

-- Step 1: Check current count
SELECT 
    COUNT(*) AS current_questions,
    'Current questions in subsection 259' AS info
FROM subsection_quiz_questions
WHERE subsection_id = 259;

-- Step 2: See which questions will be deleted (for safety check)
SELECT 
    id AS question_id,
    sort_order,
    LEFT(prompt_html, 80) AS question_preview,
    'Will be DELETED' AS status
FROM subsection_quiz_questions
WHERE subsection_id = 259
ORDER BY sort_order DESC
LIMIT 50;

-- Step 3: See which questions will be kept
SELECT 
    id AS question_id,
    sort_order,
    LEFT(prompt_html, 80) AS question_preview,
    'Will be KEPT' AS status
FROM subsection_quiz_questions
WHERE subsection_id = 259
ORDER BY sort_order ASC
LIMIT 100;

-- ============================================
-- DELETE OPERATION
-- ============================================

START TRANSACTION;

-- Delete 50 questions with highest sort_order (keeps first 100)
DELETE FROM subsection_quiz_questions
WHERE subsection_id = 259
AND id IN (
    SELECT id FROM (
        SELECT id 
        FROM subsection_quiz_questions
        WHERE subsection_id = 259
        ORDER BY sort_order DESC
        LIMIT 50
    ) AS temp
);

-- Note: Options are automatically deleted due to CASCADE foreign key constraint

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check final count (should be 100)
SELECT 
    COUNT(*) AS remaining_questions,
    CASE 
        WHEN COUNT(*) = 100 THEN 'SUCCESS: Exactly 100 questions remaining'
        WHEN COUNT(*) < 100 THEN CONCAT('WARNING: Only ', COUNT(*), ' questions remaining')
        ELSE CONCAT('INFO: ', COUNT(*), ' questions remaining')
    END AS status
FROM subsection_quiz_questions
WHERE subsection_id = 259;

-- Check options count
SELECT 
    COUNT(DISTINCT qq.id) AS total_questions,
    COUNT(qo.id) AS total_options
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259;

-- Show sample of remaining questions
SELECT 
    qq.id AS question_id,
    qq.sort_order,
    LEFT(qq.prompt_html, 100) AS question_preview,
    COUNT(qo.id) AS option_count
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259
GROUP BY qq.id, qq.sort_order, qq.prompt_html
ORDER BY qq.sort_order
LIMIT 10;

SELECT 'SUCCESS: Deleted 50 questions, 100 questions remaining in subsection 259!' AS result;

