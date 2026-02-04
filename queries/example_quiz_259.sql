-- ============================================
-- READY-TO-USE QUIZ INSERTIONS FOR SUBSECTION 259
-- ============================================
-- 
-- Copy and execute these queries in your MySQL database
-- Make sure to replace the question and option texts with your actual content
--
-- ============================================

-- Question 1: Trading Basics
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is the primary purpose of technical analysis in trading?</p>', 1);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>To predict future price movements based on historical patterns</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>To analyze company financial statements</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>To determine the intrinsic value of an asset</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>To manage portfolio risk through diversification</p>', 0, 4);

-- Question 2: Risk Management
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>Which of the following is a key principle of risk management?</p>', 2);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>Never risk more than 2% of your account on a single trade</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>Always use maximum leverage available</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>Invest all capital in one high-probability trade</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>Ignore stop-loss orders to maximize profits</p>', 0, 4);

-- Question 3: Chart Analysis
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What does a candlestick chart show?</p>', 3);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>Open, High, Low, and Close prices for a time period</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>Only closing prices</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>Volume and price correlation</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>Fundamental analysis metrics</p>', 0, 4);

-- Question 4: Order Types
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is the difference between a market order and a limit order?</p>', 4);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>Market order executes immediately at current price; limit order executes only at specified price or better</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>Market order is for stocks only; limit order is for forex only</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>Market order requires margin; limit order does not</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>There is no difference</p>', 0, 4);

-- Question 5: Support and Resistance
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is a support level in technical analysis?</p>', 5);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>A price level where buying interest is strong enough to prevent further decline</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>A price level where selling pressure is strongest</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>The highest price ever reached by an asset</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>A moving average crossover point</p>', 0, 4);

-- Question 6: Trading Psychology
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>Which emotional state is most dangerous for traders?</p>', 6);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>FOMO (Fear of Missing Out) leading to impulsive trades</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>Calm and patient decision-making</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>Following a trading plan consistently</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>Accepting losses as part of trading</p>', 0, 4);

-- Question 7: Stop Loss
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is the purpose of a stop-loss order?</p>', 7);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>To limit potential losses by automatically closing a position at a predetermined price</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>To guarantee profits on every trade</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>To increase leverage on a position</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>To delay order execution</p>', 0, 4);

-- Question 8: Leverage
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What does leverage mean in trading?</p>', 8);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>Using borrowed capital to increase the potential return of an investment</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>Diversifying your portfolio across multiple assets</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>Holding positions for long periods</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>Using only your own capital</p>', 0, 4);

-- Question 9: Trend Analysis
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What is an uptrend in technical analysis?</p>', 9);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>A series of higher highs and higher lows</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>A series of lower highs and lower lows</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>When price moves sideways</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>When volume decreases</p>', 0, 4);

-- Question 10: Market Indicators
INSERT INTO subsection_quiz_questions (subsection_id, prompt_html, sort_order)
VALUES (259, '<p>What does RSI (Relative Strength Index) measure?</p>', 10);

INSERT INTO subsection_quiz_options (question_id, text_html, is_correct, sort_order)
VALUES 
  (LAST_INSERT_ID(), '<p>The momentum and speed of price changes</p>', 1, 1),
  (LAST_INSERT_ID(), '<p>The total volume of trades</p>', 0, 2),
  (LAST_INSERT_ID(), '<p>The number of active traders</p>', 0, 3),
  (LAST_INSERT_ID(), '<p>The interest rate on margin</p>', 0, 4);

-- ============================================
-- VERIFY YOUR INSERTIONS
-- ============================================

-- View all questions for subsection 259
SELECT id, subsection_id, prompt_html, sort_order, created_at
FROM subsection_quiz_questions
WHERE subsection_id = 259
ORDER BY sort_order ASC;

-- View all questions with their options
SELECT 
    qq.id AS question_id,
    qq.sort_order AS q_order,
    qq.prompt_html AS question,
    qo.id AS option_id,
    qo.sort_order AS o_order,
    qo.text_html AS option_text,
    qo.is_correct
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259
ORDER BY qq.sort_order ASC, qo.sort_order ASC;

-- Count summary
SELECT 
    COUNT(DISTINCT qq.id) AS total_questions,
    COUNT(qo.id) AS total_options,
    SUM(CASE WHEN qo.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers_count
FROM subsection_quiz_questions qq
LEFT JOIN subsection_quiz_options qo ON qq.id = qo.question_id
WHERE qq.subsection_id = 259;

