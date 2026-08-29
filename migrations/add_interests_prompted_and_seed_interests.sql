-- Tracks whether a customer has been shown the signup interest questionnaire
-- (needed because "skip with nothing selected" is otherwise indistinguishable
-- from "never asked" when looking at user_interests alone).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS interests_prompted_at TIMESTAMP NULL;

-- Seed the fixed set of interest options the questionnaire offers.
INSERT INTO interests (name, category)
SELECT * FROM (VALUES
  ('I have skills to offer', 'talent_pool'),
  ('I have a project to build or fund', 'project_pool'),
  ('I want to learn / take courses', 'education'),
  ('I represent an organization looking to hire or invest', 'hiring_investing')
) AS seed(name, category)
WHERE NOT EXISTS (SELECT 1 FROM interests WHERE interests.category = seed.category);
