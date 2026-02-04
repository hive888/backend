-- ============================================
-- COPY 100 RANDOM QUESTIONS FROM OTHER SUBSECTIONS TO SUBSECTION 259
-- ============================================
-- 
-- This script randomly selects 100 questions from all other subsections
-- and copies them (with all their options) to subsection 259
--
-- USAGE: Just run this entire script in MySQL
-- ============================================

-- Step 1: Check how many questions are available
SELECT 
    'Available questions from other subsections:' AS info,
    COUNT(*) AS total_available
FROM subsection_quiz_questions
WHERE subsection_id != 259;

-- Step 2: Check current questions in subsection 259 (if any)
SELECT 
    'Current questions in subsection 259:' AS info,
    COUNT(*) AS current_count
FROM subsection_quiz_questions
WHERE subsection_id = 259;

-- ============================================
-- MAIN COPY OPERATION
-- ============================================

START TRANSACTION;

-- Step 1: Create temporary table with 100 random question IDs
CREATE TEMPORARY TABLE temp_selected_questions AS
SELECT 
    id AS original_question_id,
    prompt_html,
    ROW_NUMBER() OVER (ORDER BY RAND()) AS new_sort_order
FROM subsection_quiz_questions
WHERE subsection_id != 259
ORDER BY RAND()
LIMIT 100;

-- Step 2: Insert the selected questions into subsection 259
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
SELECT 
    259 AS subsection_id,
    prompt_html,
    new_sort_order AS sort_order
FROM temp_selected_questions
ORDER BY new_sort_order;

-- Step 3: Create mapping table to link old question IDs to new question IDs
-- We match by prompt_html and the fact that they were just inserted
CREATE TEMPORARY TABLE temp_question_mapping AS
SELECT 
    ts.original_question_id,
    qq_new.id AS new_question_id
FROM temp_selected_questions ts
INNER JOIN subsection_quiz_questions qq_new 
    ON qq_new.subsection_id = 259 
    AND qq_new.prompt_html = ts.prompt_html
    AND qq_new.sort_order = ts.new_sort_order
    AND qq_new.created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
ORDER BY ts.new_sort_order;

-- Step 4: Copy all options for the selected questions
INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
SELECT 
    tqm.new_question_id AS question_id,
    qo.text_html,
    qo.is_correct,
    qo.sort_order
FROM temp_question_mapping tqm
INNER JOIN subsection_quiz_options qo ON qo.question_id = tqm.original_question_id
ORDER BY tqm.new_question_id, qo.sort_order;

-- Clean up temporary tables
DROP TEMPORARY TABLE IF EXISTS temp_selected_questions;
DROP TEMPORARY TABLE IF EXISTS temp_question_mapping;

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify the copy operation
SELECT 
    'Verification Results:' AS info,
    COUNT(DISTINCT qq.id) AS total_questions_copied,
    COUNT(qo.id) AS total_options_copied,
    SUM(CASE WHEN qo.is_correct = 1 THEN 1 ELSE 0 END) AS total_correct_answers
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259;

-- Show sample of copied questions
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

-- Show detailed view of first 3 questions with options
SELECT 
    qq.id AS question_id,
    qq.sort_order AS q_order,
    LEFT(qq.prompt_html, 80) AS question,
    qo.id AS option_id,
    qo.sort_order AS o_order,
    LEFT(qo.text_html, 60) AS option_text,
    qo.is_correct
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259
ORDER BY qq.sort_order ASC, qo.sort_order ASC
LIMIT 15;

SELECT 'SUCCESS: 100 random questions copied to subsection 259!' AS result;

