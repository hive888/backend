-- Telegram Integration Migration
-- Adds Telegram user linking to customers table
-- Run this migration to enable Telegram bot integration

-- Add Telegram fields to customers table
ALTER TABLE `customers` 
ADD COLUMN `telegram_user_id` BIGINT NULL UNIQUE AFTER `customer_id`,
ADD COLUMN `telegram_username` VARCHAR(255) NULL AFTER `telegram_user_id`,
ADD INDEX `idx_telegram_user_id` (`telegram_user_id`);

-- Optional: Track Telegram verification codes for account linking
CREATE TABLE IF NOT EXISTS `telegram_verification_codes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `telegram_user_id` BIGINT NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_telegram_user_id` (`telegram_user_id`),
  INDEX `idx_email` (`email`),
  INDEX `idx_code` (`code`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Track Telegram group and topic IDs for community management
CREATE TABLE IF NOT EXISTS `telegram_topics` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `group_id` BIGINT NOT NULL,
  `topic_id` INT NOT NULL,
  `topic_name` VARCHAR(255) NULL,
  `topic_type` ENUM('private_list', 'public_list') NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_group_topic` (`group_id`, `topic_id`),
  INDEX `idx_group_id` (`group_id`),
  INDEX `idx_topic_type` (`topic_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

