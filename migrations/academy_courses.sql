-- Academy / Multi-course migration (Option A)
-- Run in your MySQL DB (ptgr_db) once.

-- 1) Courses catalog
CREATE TABLE IF NOT EXISTS `courses` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(120) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `short_description` TEXT NULL,
  `detailed_description` LONGTEXT NULL,
  `thumbnail_url` VARCHAR(500) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_courses_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Customer access per course
CREATE TABLE IF NOT EXISTS `customer_course_access` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT NOT NULL,
  `course_id` BIGINT NOT NULL,
  `status` ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  `granted_via` ENUM('access_code','purchase','admin') NOT NULL DEFAULT 'access_code',
  `access_code_id` BIGINT NULL,
  `granted_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_customer_course` (`customer_id`,`course_id`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_customer_id` (`customer_id`),
  CONSTRAINT `fk_course_access_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_course_access_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_course_access_code` FOREIGN KEY (`access_code_id`) REFERENCES `access_codes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Link access codes to a course (optional but needed for per-course redeem)
-- If this column already exists, this will error; in that case skip it.
ALTER TABLE `access_codes`
  ADD COLUMN `course_id` BIGINT NULL AFTER `code`,
  ADD KEY `idx_access_codes_course_id` (`course_id`),
  ADD CONSTRAINT `fk_access_codes_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL;


