-- Follow-up sub-options shown after a user picks a top-level interest category
-- (see add_interests_prompted_and_seed_interests.sql for the 4 parent categories).
INSERT INTO interests (name, category)
SELECT * FROM (VALUES
  -- talent_pool_skill (parent: talent_pool) - mirrors Swafri's talent_type taxonomy
  ('Software Development', 'talent_pool_skill'),
  ('UI/UX Design', 'talent_pool_skill'),
  ('DevOps', 'talent_pool_skill'),
  ('Data & Analytics', 'talent_pool_skill'),
  ('Digital Marketing', 'talent_pool_skill'),
  ('Project Management', 'talent_pool_skill'),
  ('QA/Testing', 'talent_pool_skill'),
  ('Business Analysis', 'talent_pool_skill'),
  ('Other', 'talent_pool_skill'),

  -- project_pool_need (parent: project_pool) - mirrors project_applications role_types
  ('Funding / investment', 'project_pool_need'),
  ('Team members or co-founders', 'project_pool_need'),
  ('Mentorship & guidance', 'project_pool_need'),
  ('Just visibility & feedback', 'project_pool_need'),

  -- education_topic (parent: education) - note: interests.name is globally unique,
  -- so these are deliberately distinct from the pre-existing unrelated "DeFi"/"AI/ML"/
  -- "Cybersecurity" tag rows already in this table.
  ('Web3 Fundamentals', 'education_topic'),
  ('DeFi Basics', 'education_topic'),
  ('Smart Contract Development', 'education_topic'),
  ('Blockchain Basics', 'education_topic'),
  ('AI & Machine Learning', 'education_topic'),
  ('Cybersecurity Fundamentals', 'education_topic'),

  -- hiring_investing_looking_for (parent: hiring_investing)
  ('Hire talent', 'hiring_investing_looking_for'),
  ('Fund or support a project', 'hiring_investing_looking_for'),
  ('Both', 'hiring_investing_looking_for')
) AS seed(name, category)
WHERE NOT EXISTS (
  -- interests.name is globally unique, so the idempotency check must match that
  SELECT 1 FROM interests WHERE interests.name = seed.name
);
