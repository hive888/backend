-- Event Management Module Migration
-- Creates events table for managing platform events

CREATE TABLE IF NOT EXISTS `events` (
  `event_id` BIGINT NOT NULL AUTO_INCREMENT,
  `event_name` VARCHAR(255) NOT NULL,
  `event_date` DATE NOT NULL,
  `short_description` TEXT NOT NULL,
  `detailed_content` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  INDEX `idx_event_date` (`event_date`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


