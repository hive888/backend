-- Migration: Add achievement certificate support to universities table
-- This adds support for two certificate types: completion and achievement

-- Add achievement_certificate_file_url column
ALTER TABLE `universities`
ADD COLUMN `achievement_certificate_file_url` VARCHAR(500) NULL AFTER `certificate_file_url`;

-- Note: 
-- - certificate_file_url: Used for completion certificates (when student passes the quiz)
-- - achievement_certificate_file_url: Used for achievement certificates (when student gets high score, typically 90%+)


