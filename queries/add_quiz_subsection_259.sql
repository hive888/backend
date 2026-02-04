-- ============================================
-- MySQL Queries to Add Quiz for Subsection 259
-- ============================================
-- 
-- This file contains example queries to add quiz questions and options
-- for subsection ID 259 (Exit Exam Quiz)
--
-- Table Structure:
-- - subsection_quiz_questions: id, subsection_id, prompt_html, sort_order, created_at, updated_at
-- - subsection_quiz_options: id, question_id, text_html, is_correct, sort_order, created_at, updated_at
--
-- ============================================

-- ============================================
-- METHOD 1: Insert Questions First, Then Options
-- ============================================

-- Step 1: Insert Questions (one at a time to get the question_id)
-- Replace the prompt_html with your actual question text

INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is the primary purpose of technical analysis in trading?</p>', 1);

-- Note: After inserting, note the LAST_INSERT_ID() or query for the question_id
-- Example: SELECT LAST_INSERT_ID() AS question_id;

-- Step 2: Insert Options for Question 1 (replace question_id with actual ID from Step 1)
-- Set is_correct = 1 for the correct answer, 0 for incorrect answers

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>To predict future price movements based on historical patterns</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>To analyze company financial statements</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>To determine the intrinsic value of an asset</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>To manage portfolio risk through diversification</p>', 0, 4);

-- ============================================
-- METHOD 2: Insert Multiple Questions with Options (Using Variables)
-- ============================================

-- Question 2
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>Which of the following is a key principle of risk management?</p>', 2);

SET @question_id_2 = LAST_INSERT_ID();

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (@question_id_2, '<p>Never risk more than 2% of your account on a single trade</p>', 1, 1),
  (@question_id_2, '<p>Always use maximum leverage available</p>', 0, 2),
  (@question_id_2, '<p>Invest all capital in one high-probability trade</p>', 0, 3),
  (@question_id_2, '<p>Ignore stop-loss orders to maximize profits</p>', 0, 4);

-- Question 3
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What does a candlestick chart show?</p>', 3);

SET @question_id_3 = LAST_INSERT_ID();

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (@question_id_3, '<p>Open, High, Low, and Close prices for a time period</p>', 1, 1),
  (@question_id_3, '<p>Only closing prices</p>', 0, 2),
  (@question_id_3, '<p>Volume and price correlation</p>', 0, 3),
  (@question_id_3, '<p>Fundamental analysis metrics</p>', 0, 4);

-- ============================================
-- METHOD 3: Bulk Insert with Known Question IDs
-- ============================================
-- Use this if you know the question IDs in advance

-- Insert Question 4
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is the difference between a market order and a limit order?</p>', 4);

-- Get the question_id (replace 1000 with actual ID after insert)
SET @question_id_4 = LAST_INSERT_ID();

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (@question_id_4, '<p>Market order executes immediately at current price; limit order executes only at specified price or better</p>', 1, 1),
  (@question_id_4, '<p>Market order is for stocks only; limit order is for forex only</p>', 0, 2),
  (@question_id_4, '<p>Market order requires margin; limit order does not</p>', 0, 3),
  (@question_id_4, '<p>There is no difference</p>', 0, 4);

-- ============================================
-- METHOD 4: Complete Quiz Example (5 Questions)
-- ============================================

-- Question 5: Support and Resistance
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is a support level in technical analysis?</p>', 5);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
SELECT LAST_INSERT_ID(), '<p>A price level where buying interest is strong enough to prevent further decline</p>', 1, 1
UNION ALL SELECT LAST_INSERT_ID(), '<p>A price level where selling pressure is strongest</p>', 0, 2
UNION ALL SELECT LAST_INSERT_ID(), '<p>The highest price ever reached by an asset</p>', 0, 3
UNION ALL SELECT LAST_INSERT_ID(), '<p>A moving average crossover point</p>', 0, 4;

-- Question 6: Trading Psychology
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>Which emotional state is most dangerous for traders?</p>', 6);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
SELECT LAST_INSERT_ID(), '<p>FOMO (Fear of Missing Out) leading to impulsive trades</p>', 1, 1
UNION ALL SELECT LAST_INSERT_ID(), '<p>Calm and patient decision-making</p>', 0, 2
UNION ALL SELECT LAST_INSERT_ID(), '<p>Following a trading plan consistently</p>', 0, 3
UNION ALL SELECT LAST_INSERT_ID(), '<p>Accepting losses as part of trading</p>', 0, 4;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all questions for subsection 259
SELECT id, subsection_id, prompt_html, sort_order, created_at
FROM subsection_quiz_questions
WHERE subsection_id = 259
ORDER BY sort_order ASC, id ASC;

-- Check all options for subsection 259 questions
SELECT 
    qo.id AS option_id,
    qo.question_id,
    qq.prompt_html AS question,
    qo.text_html AS option_text,
    qo.is_correct,
    qo.sort_order
FROM subsection_quiz_options qo
INNER JOIN subsection_quiz_questions qq ON qo.question_id = qq.id
WHERE qq.subsection_id = 259
ORDER BY qq.sort_order ASC, qo.sort_order ASC;

-- Count questions and options
SELECT 
    COUNT(DISTINCT qq.id) AS total_questions,
    COUNT(qo.id) AS total_options,
    SUM(CASE WHEN qo.is_correct = 1 THEN 1 ELSE 0 END) AS total_correct_answers
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259;

-- ============================================
-- UPDATE EXISTING QUESTIONS/OPTIONS
-- ============================================

-- Update a question
-- UPDATE subsection_quiz_questions 
-- SET prompt_html = '<p>Updated question text</p>'
-- WHERE id = <question_id>;

-- Update an option
-- UPDATE subsection_quiz_options 
-- SET text_html = '<p>Updated option text</p>', is_correct = 1
-- WHERE id = <option_id>;

-- ============================================
-- DELETE QUIZ DATA (Use with caution!)
-- ============================================

-- Delete all options for a question (options will cascade delete)
-- DELETE FROM subsection_quiz_options WHERE question_id = <question_id>;

-- Delete a question (will cascade delete all its options)
-- DELETE FROM subsection_quiz_questions WHERE id = <question_id>;

-- Delete all quiz data for subsection 259 (DANGEROUS - use with caution!)
-- DELETE FROM subsection_quiz_questions WHERE subsection_id = 259;

-- ============================================
-- TEMPLATE FOR ADDING MORE QUESTIONS
-- ============================================

/*
-- Template: Copy and modify this for each new question

INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>YOUR QUESTION TEXT HERE</p>', <NEXT_SORT_ORDER>);

SET @q_id = LAST_INSERT_ID();

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (@q_id, '<p>OPTION 1 TEXT</p>', 1, 1),  -- Set is_correct = 1 for correct answer
  (@q_id, '<p>OPTION 2 TEXT</p>', 0, 2),
  (@q_id, '<p>OPTION 3 TEXT</p>', 0, 3),
  (@q_id, '<p>OPTION 4 TEXT</p>', 0, 4);  -- Add more options as needed
*/

