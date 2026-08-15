-- ============================================
-- RELIABLE METHOD: Copy 100 Random Questions to Subsection 259
-- ============================================
-- 
-- This version uses a stored procedure to ensure reliable copying
-- even if there are duplicate question texts
--
-- ============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS CopyRandomQuestionsTo259$$

CREATE PROCEDURE CopyRandomQuestionsTo259(IN num_questions INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_original_q_id BIGINT UNSIGNED;
    DECLARE v_prompt_html LONGTEXT;
    DECLARE v_new_q_id BIGINT UNSIGNED;
    DECLARE v_sort_order INT DEFAULT 0;
    DECLARE v_count INT DEFAULT 0;
    
    -- Cursor for random questions
    DECLARE question_cursor CURSOR FOR
        SELECT id, prompt_html
        FROM subsection_quiz_questions
        WHERE subsection_id != 259
        ORDER BY RAND()
        LIMIT num_questions;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Start transaction
    START TRANSACTION;
    
    OPEN question_cursor;
    
    question_loop: LOOP
        FETCH question_cursor INTO v_original_q_id, v_prompt_html;
        
        IF done THEN
            LEAVE question_loop;
        END IF;
        
        -- Increment sort order
        SET v_sort_order = v_sort_order + 1;
        SET v_count = v_count + 1;
        
        -- Insert question into subsection 259
        INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
        VALUES (259, v_prompt_html, v_sort_order);
        
        -- Get the new question ID
        SET v_new_q_id = LAST_INSERT_ID();
        
        -- Copy all options for this question
        INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
        SELECT 
            v_new_q_id,
            text_html,
            is_correct,
            sort_order
        FROM subsection_quiz_options
        WHERE question_id = v_original_q_id
        ORDER BY sort_order;
        
    END LOOP;
    
    CLOSE question_cursor;
    
    -- Commit transaction
    COMMIT;
    
    -- Return result
    SELECT CONCAT('Successfully copied ', v_count, ' questions to subsection 259') AS result;
    
END$$

DELIMITER ;

-- ============================================
-- EXECUTE THE PROCEDURE
-- ============================================

-- Check available questions first
SELECT 
    COUNT(*) AS available_questions,
    CASE 
        WHEN COUNT(*) >= 100 THEN 'Ready to copy 100 questions'
        ELSE CONCAT('Only ', COUNT(*), ' questions available. Cannot copy 100.')
    END AS status
FROM subsection_quiz_questions
WHERE subsection_id != 259;

-- Execute: Copy 100 random questions
CALL CopyRandomQuestionsTo259(100);

-- ============================================
-- VERIFICATION
-- ============================================

-- Count questions in subsection 259
SELECT 
    COUNT(*) AS total_questions,
    'questions in subsection 259' AS info
FROM subsection_quiz_questions
WHERE subsection_id = 259;

-- Count options
SELECT 
    COUNT(DISTINCT qq.id) AS total_questions,
    COUNT(qo.id) AS total_options,
    SUM(CASE WHEN qo.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259;

-- Show sample questions
SELECT 
    qq.id,
    qq.sort_order,
    LEFT(qq.prompt_html, 100) AS question_preview,
    COUNT(qo.id) AS option_count
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259
GROUP BY qq.id, qq.sort_order, qq.prompt_html
ORDER BY qq.sort_order
LIMIT 10;

-- Clean up: Drop the procedure
DROP PROCEDURE IF EXISTS CopyRandomQuestionsTo259;

