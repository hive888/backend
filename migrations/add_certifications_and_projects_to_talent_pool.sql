-- Add certifications and projects JSON fields to talent pool registration
ALTER TABLE talent_pool_registration
ADD COLUMN certifications JSON DEFAULT NULL COMMENT 'JSON array of certifications',
ADD COLUMN projects JSON DEFAULT NULL COMMENT 'JSON array of project participations';
