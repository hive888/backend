-- Adds the extended listing fields that projectPoolModel.js / projectPoolController.js
-- and the customer-dashboard project-pool wizard already read and write, but which were
-- never added to project_pool via a tracked migration (create_project_pool_tables.sql is
-- MySQL-syntax and predates the Postgres migration; it was never runnable as-is).
ALTER TABLE project_pool
  ADD COLUMN IF NOT EXISTS tagline VARCHAR(255),
  ADD COLUMN IF NOT EXISTS project_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS project_stage VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS pitch_video_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS deck_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS competitive_advantage TEXT,
  ADD COLUMN IF NOT EXISTS blockchains VARCHAR(255),
  ADD COLUMN IF NOT EXISTS github_link VARCHAR(512),
  ADD COLUMN IF NOT EXISTS twitter_link VARCHAR(512),
  ADD COLUMN IF NOT EXISTS discord_link VARCHAR(512),
  ADD COLUMN IF NOT EXISTS extra_details JSONB;
