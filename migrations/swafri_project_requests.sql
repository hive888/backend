-- SWAFRI Project Requests Table
-- Run this migration to create the project_requests table

CREATE TABLE IF NOT EXISTS `project_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(100) NOT NULL,
  `company_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `job_title` VARCHAR(100) NULL DEFAULT NULL,
  `company_size` VARCHAR(20) NULL DEFAULT NULL,
  `project_details` TEXT NOT NULL,
  `project_type` VARCHAR(50) NOT NULL,
  `project_budget` VARCHAR(30) NOT NULL,
  `project_timeline` VARCHAR(30) NOT NULL,
  `project_stage` VARCHAR(20) NULL DEFAULT NULL,
  `project_technologies` VARCHAR(500) NULL DEFAULT NULL,
  `gdpr_consent` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('pending', 'reviewed', 'contacted', 'closed') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_project_type` (`project_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

