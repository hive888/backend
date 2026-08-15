-- ============================================
-- COPY RANDOM QUESTIONS FROM OTHER SUBSECTIONS TO SUBSECTION 259
-- ============================================
-- 
-- This script:
-- 1. Finds all questions from other subsections (excluding 259)
-- 2. Randomly selects 50 questions
-- 3. Copies them to subsection 259 with all their options
-- 4. Maintains correct question-option relationships
--
-- ============================================

-- Step 1: Check available questions from other subsections
-- Run this first to see how many questions are available
SELECT 
    subsection_id,
    COUNT(*) AS question_count
FROM subsection_quiz_questions
WHERE subsection_id != 259
GROUP BY subsection_id
ORDER BY question_count DESC;

-- Step 2: See total available questions
SELECT COUNT(*) AS total_available_questions
FROM subsection_quiz_questions
WHERE subsection_id != 259;

-- ============================================
-- METHOD 1: Copy Random Questions (Recommended)
-- ============================================
-- This will randomly select 50 questions from all other subsections
-- and copy them to subsection 259

-- Create temporary table to store selected question IDs
CREATE TEMPORARY TABLE IF NOT EXISTS temp_selected_questions AS
SELECT id AS original_question_id, subsection_id, prompt_html, sort_order
FROM subsection_quiz_questions
WHERE subsection_id != 259
ORDER BY RAND()
LIMIT 50;

-- Verify selected questions
SELECT COUNT(*) AS selected_count FROM temp_selected_questions;

-- Insert questions into subsection 259
-- Note: We'll use a new sort_order starting from 1
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
SELECT 
    259 AS subsection_id,
    prompt_html,
    ROW_NUMBER() OVER (ORDER BY original_question_id) AS sort_order
FROM temp_selected_questions;

-- Get the mapping of old question IDs to new question IDs
CREATE TEMPORARY TABLE IF NOT EXISTS temp_question_mapping AS
SELECT 
    ts.original_question_id,
    qq_new.id AS new_question_id,
    ROW_NUMBER() OVER (ORDER BY ts.original_question_id) AS row_num
FROM temp_selected_questions ts
INNER JOIN subsection_quiz_questions qq_new 
    ON qq_new.subsection_id = 259 
    AND qq_new.prompt_html = ts.prompt_html
    AND qq_new.created_at >= NOW() - INTERVAL 1 MINUTE  -- Match recently inserted
ORDER BY ts.original_question_id, qq_new.id
LIMIT 50;

-- Copy options for each question
INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
SELECT 
    tqm.new_question_id AS question_id,
    qo.text_html,
    qo.is_correct,
    qo.sort_order
FROM temp_question_mapping tqm
INNER JOIN subsection_quiz_options qo ON qo.question_id = tqm.original_question_id
ORDER BY tqm.row_num, qo.sort_order;

-- Clean up temporary tables
DROP TEMPORARY TABLE IF EXISTS temp_selected_questions;
DROP TEMPORARY TABLE IF EXISTS temp_question_mapping;

-- ============================================
-- METHOD 2: More Reliable Approach (Using Variables)
-- ============================================
-- This method is more reliable if you have duplicate question texts

-- First, let's delete any existing questions for subsection 259 (optional)
-- UNCOMMENT THE NEXT LINE IF YOU WANT TO START FRESH
-- DELETE FROM subsection_quiz_questions WHERE subsection_id = 259;

-- Create a stored procedure to copy questions
DELIMITER $$

DROP PROCEDURE IF EXISTS copy_random_questions_to_259$$

CREATE PROCEDURE copy_random_questions_to_259(IN num_questions INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_original_q_id BIGINT UNSIGNED;
    DECLARE v_prompt_html LONGTEXT;
    DECLARE v_new_q_id BIGINT UNSIGNED;
    DECLARE v_sort_order INT DEFAULT 0;
    DECLARE v_option_id BIGINT UNSIGNED;
    DECLARE v_option_text LONGTEXT;
    DECLARE v_is_correct TINYINT;
    DECLARE v_option_sort INT;
    
    -- Cursor for random questions
    DECLARE question_cursor CURSOR FOR
        SELECT id, prompt_html
        FROM subsection_quiz_questions
        WHERE subsection_id != 259
        ORDER BY RAND()
        LIMIT num_questions;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN question_cursor;
    
    question_loop: LOOP
        FETCH question_cursor INTO v_original_q_id, v_prompt_html;
        
        IF done THEN
            LEAVE question_loop;
        END IF;
        
        -- Insert question
        SET v_sort_order = v_sort_order + 1;
        INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
        VALUES (259, v_prompt_html, v_sort_order);
        
        SET v_new_q_id = LAST_INSERT_ID();
        
        -- Copy all options for this question
        INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
        SELECT 
            v_new_q_id,
            text_html,
            is_correct,
            sort_order
        FROM subsection_quiz_options
        WHERE question_id = v_original_q_id;
        
    END LOOP;
    
    CLOSE question_cursor;
END$$

DELIMITER ;

-- Execute the procedure to copy 50 random questions
CALL copy_random_questions_to_259(50);

-- Drop the procedure after use
DROP PROCEDURE IF EXISTS copy_random_questions_to_259;

-- ============================================
-- METHOD 3: Simple Direct Copy (Easiest)
-- ============================================
-- This is the simplest approach - just copy 50 random questions directly

-- Step 1: Insert 50 random questions
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
SELECT 
    259 AS subsection_id,
    prompt_html,
    ROW_NUMBER() OVER (ORDER BY RAND()) AS sort_order
FROM (
    SELECT prompt_html
    FROM subsection_quiz_questions
    WHERE subsection_id != 259
    ORDER BY RAND()
    LIMIT 50
) AS random_questions;

-- Step 2: Copy options for the newly inserted questions
-- This matches questions by prompt_html and copies their options
INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
SELECT 
    new_q.id AS question_id,
    orig_o.text_html,
    orig_o.is_correct,
    orig_o.sort_order
FROM subsection_quiz_questions new_q
INNER JOIN subsection_quiz_questions orig_q ON orig_q.prompt_html = new_q.prompt_html AND orig_q.subsection_id != 259
INNER JOIN subsection_quiz_options orig_o ON orig_o.question_id = orig_q.id
WHERE new_q.subsection_id = 259
  AND new_q.created_at >= NOW() - INTERVAL 5 MINUTE  -- Only recently inserted questions
ORDER BY new_q.id, orig_o.sort_order;

-- ============================================
-- METHOD 4: Most Reliable - Using Transaction
-- ============================================
-- This ensures data integrity and handles duplicates properly

START TRANSACTION;

-- Create temporary table with random question IDs
CREATE TEMPORARY TABLE temp_random_questions AS
SELECT 
    qq.id AS original_question_id,
    qq.prompt_html,
    ROW_NUMBER() OVER (ORDER BY RAND()) AS selection_order
FROM subsection_quiz_questions qq
WHERE qq.subsection_id != 259
ORDER BY RAND()
LIMIT 50;

-- Insert questions one by one and track mappings
CREATE TEMPORARY TABLE temp_question_id_map (
    original_id BIGINT UNSIGNED,
    new_id BIGINT UNSIGNED,
    selection_order INT
);

-- Insert questions and track IDs
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
SELECT 
    259,
    prompt_html,
    selection_order
FROM temp_random_questions
ORDER BY selection_order;

-- Map old IDs to new IDs
INSERT INTO temp_question_id_map (original_id, new_id, selection_order)
SELECT 
    trq.original_question_id,
    qq_new.id,
    trq.selection_order
FROM temp_random_questions trq
INNER JOIN subsection_quiz_questions qq_new 
    ON qq_new.subsection_id = 259 
    AND qq_new.prompt_html = trq.prompt_html
    AND qq_new.sort_order = trq.selection_order
    AND qq_new.created_at >= NOW() - INTERVAL 1 MINUTE
ORDER BY trq.selection_order;

-- Copy all options
INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
SELECT 
    tqim.new_id AS question_id,
    qo.text_html,
    qo.is_correct,
    qo.sort_order
FROM temp_question_id_map tqim
INNER JOIN subsection_quiz_options qo ON qo.question_id = tqim.original_id
ORDER BY tqim.selection_order, qo.sort_order;

-- Clean up
DROP TEMPORARY TABLE IF EXISTS temp_random_questions;
DROP TEMPORARY TABLE IF EXISTS temp_question_id_map;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Count questions in subsection 259
SELECT COUNT(*) AS total_questions_259
FROM subsection_quiz_questions
WHERE subsection_id = 259;

-- Count options for subsection 259
SELECT 
    COUNT(DISTINCT qq.id) AS total_questions,
    COUNT(qo.id) AS total_options,
    SUM(CASE WHEN qo.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers_count
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259;

-- View sample questions with options
SELECT 
    qq.id AS question_id,
    qq.sort_order,
    qq.prompt_html AS question,
    qo.id AS option_id,
    qo.text_html AS option_text,
    qo.is_correct,
    qo.sort_order AS option_order
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259
ORDER BY qq.sort_order ASC, qo.sort_order ASC
LIMIT 20;

-- Check distribution of questions by original subsection (if you want to track)
-- This won't work after copy, but you can check before copying:
SELECT 
    subsection_id,
    COUNT(*) AS question_count
FROM subsection_quiz_questions
WHERE subsection_id != 259
GROUP BY subsection_id
ORDER BY question_count DESC;

