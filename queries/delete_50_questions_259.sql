-- ============================================
-- DELETE 50 QUESTIONS FROM SUBSECTION 259
-- Keep only 100 questions
-- ============================================

-- Check current count
SELECT COUNT(*) AS current_count FROM subsection_quiz_questions WHERE subsection_id = 259;

-- Delete 50 questions (keeps first 100 by sort_order)
-- Options will automatically be deleted due to CASCADE foreign key

START TRANSACTION;

DELETE qq FROM subsection_quiz_questions qq
INNER JOIN (
    SELECT id 
    FROM subsection_quiz_questions
    WHERE subsection_id = 259
    ORDER BY sort_order DESC
    LIMIT 50
) AS to_delete ON qq.id = to_delete.id
WHERE qq.subsection_id = 259;

COMMIT;

-- Verify final count (should be 100)
SELECT 
    COUNT(*) AS remaining_questions,
    CASE 
        WHEN COUNT(*) = 100 THEN '✓ SUCCESS: Exactly 100 questions'
        ELSE CONCAT('Current count: ', COUNT(*))
    END AS status
FROM subsection_quiz_questions
WHERE subsection_id = 259;

