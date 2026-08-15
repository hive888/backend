-- Exit Exam Payment and University Certificate Stamping Migration
-- Adds exit exam fee, university association, and exit exam payment tracking

-- 1. Add exit_exam_fee and university_id to access_codes table
ALTER TABLE `access_codes`
ADD COLUMN `exit_exam_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `payment_currency`,
ADD COLUMN `university_id` BIGINT NULL AFTER `exit_exam_fee`,
ADD INDEX `idx_university_id` (`university_id`);

-- 2. Create universities table
CREATE TABLE IF NOT EXISTS `universities` (
  `university_id` BIGINT NOT NULL AUTO_INCREMENT,
  `university_name` VARCHAR(255) NOT NULL,
  `stamp_image_url` VARCHAR(500) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`university_id`),
  INDEX `idx_university_name` (`university_name`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create exit_exam_payments table
CREATE TABLE IF NOT EXISTS `exit_exam_payments` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT NOT NULL,
  `access_code_id` BIGINT NOT NULL,
  `registration_id` BIGINT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `payment_status` ENUM('pending','processing','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `transaction_id` VARCHAR(255) NULL,
  `payment_date` TIMESTAMP NULL DEFAULT NULL,
  `payment_details` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_customer_access_code` (`customer_id`, `access_code_id`),
  INDEX `idx_customer_id` (`customer_id`),
  INDEX `idx_access_code_id` (`access_code_id`),
  INDEX `idx_registration_id` (`registration_id`),
  INDEX `idx_payment_status` (`payment_status`),
  INDEX `idx_transaction_id` (`transaction_id`),
  CONSTRAINT `fk_exit_exam_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exit_exam_payments_access_code` FOREIGN KEY (`access_code_id`) REFERENCES `access_codes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exit_exam_payments_registration` FOREIGN KEY (`registration_id`) REFERENCES `selfstudy_registrations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Add foreign key constraint for university_id in access_codes
ALTER TABLE `access_codes`
ADD CONSTRAINT `fk_access_codes_university` FOREIGN KEY (`university_id`) REFERENCES `universities` (`university_id`) ON DELETE SET NULL;

