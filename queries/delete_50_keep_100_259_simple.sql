-- ============================================
-- SIMPLE VERSION: Delete 50 Questions, Keep 100
-- ============================================
-- 
-- Quick delete: removes the 50 questions with highest sort_order
-- Keeps the first 100 questions by sort_order
-- ============================================

-- Preview what will be deleted
SELECT 
    id,
    sort_order,
    LEFT(prompt_html, 60) AS question_preview
FROM subsection_quiz_questions
WHERE subsection_id = 259
ORDER BY sort_order DESC
LIMIT 50;

-- Delete operation
START TRANSACTION;

DELETE FROM subsection_quiz_questions
WHERE subsection_id = 259
AND sort_order > (
    SELECT sort_order FROM (
        SELECT sort_order
        FROM subsection_quiz_questions
        WHERE subsection_id = 259
        ORDER BY sort_order ASC
        LIMIT 1 OFFSET 99  -- Skip first 100, get sort_order of 100th question
    ) AS temp
);

-- Alternative method if above doesn't work:
-- DELETE FROM subsection_quiz_questions
-- WHERE subsection_id = 259
-- AND id IN (
--     SELECT id FROM (
--         SELECT id 
--         FROM subsection_quiz_questions
--         WHERE subsection_id = 259
--         ORDER BY sort_order DESC
--         LIMIT 50
--     ) AS temp
-- );

COMMIT;

-- Verify
SELECT COUNT(*) AS remaining_questions 
FROM subsection_quiz_questions 
WHERE subsection_id = 259;

