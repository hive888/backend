-- SWAFRI Request Assignments Table
-- This table manages assignments of talents from the talent pool to client requests (both talent and project requests)
-- Run this migration to create the request_assignments table

CREATE TABLE IF NOT EXISTS `request_assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_type` ENUM('talent', 'project') NOT NULL COMMENT 'Type of request: talent_request or project_request',
  `request_id` BIGINT UNSIGNED NOT NULL COMMENT 'ID of the talent_request or project_request',
  `talent_pool_id` INT NOT NULL COMMENT 'ID from talent_pool_registration table',
  `assigned_by` VARCHAR(36) NULL DEFAULT NULL COMMENT 'UUID of admin user who made the assignment',
  `assignment_status` ENUM('pending', 'contacted', 'interviewed', 'accepted', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
  `notes` TEXT NULL DEFAULT NULL COMMENT 'Admin notes about the assignment',
  `client_feedback` TEXT NULL DEFAULT NULL COMMENT 'Feedback from the client about this talent',
  `talent_feedback` TEXT NULL DEFAULT NULL COMMENT 'Feedback from the talent about this assignment',
  `interview_date` DATETIME NULL DEFAULT NULL COMMENT 'Scheduled interview date/time',
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the assignment was created',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment` (`request_type`, `request_id`, `talent_pool_id`, `deleted_at`),
  KEY `idx_request` (`request_type`, `request_id`),
  KEY `idx_talent_pool` (`talent_pool_id`),
  KEY `idx_status` (`assignment_status`),
  KEY `idx_assigned_at` (`assigned_at`),
  KEY `idx_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_assignment_talent_pool` FOREIGN KEY (`talent_pool_id`) 
    REFERENCES `talent_pool_registration` (`id`) 
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE INDEX `idx_active_assignments` ON `request_assignments` (`request_type`, `request_id`, `assignment_status`, `deleted_at`);

