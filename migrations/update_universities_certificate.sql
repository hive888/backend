-- Migration: Update universities table to use certificate_file_url instead of stamp_image_url
-- This changes from image stamps to PDF certificate templates

-- 1. Add certificate_file_url column
ALTER TABLE `universities`
ADD COLUMN `certificate_file_url` VARCHAR(500) NULL AFTER `stamp_image_url`;

-- 2. Migrate existing data (if any stamp_image_url exists, we'll keep it for reference but new uploads go to certificate_file_url)
-- Note: You may want to manually migrate existing stamp URLs to certificate URLs if applicable

-- 3. Optional: Remove stamp_image_url column after migration (uncomment if you want to remove it)
-- ALTER TABLE `universities` DROP COLUMN `stamp_image_url`;



