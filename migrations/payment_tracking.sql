-- Payment tracking table (required for Stripe course access payments)
-- This matches the expectations in models/paymentTrackingModel.js

CREATE TABLE IF NOT EXISTS `payment_tracking` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT NOT NULL,
  `access_code_id` BIGINT NOT NULL,
  `registration_id` BIGINT NULL,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 18.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'stripe',
  `payment_status` ENUM('pending','processing','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `transaction_id` VARCHAR(255) NULL,
  `payment_date` TIMESTAMP NULL DEFAULT NULL,
  `payment_details` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_tracking_customer_id` (`customer_id`),
  KEY `idx_payment_tracking_access_code_id` (`access_code_id`),
  KEY `idx_payment_tracking_registration_id` (`registration_id`),
  KEY `idx_payment_tracking_transaction_id` (`transaction_id`),
  CONSTRAINT `fk_payment_tracking_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_tracking_access_code` FOREIGN KEY (`access_code_id`) REFERENCES `access_codes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_tracking_registration` FOREIGN KEY (`registration_id`) REFERENCES `selfstudy_registrations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


