-- Adds optional extended profile fields for customers (1:1)
-- Fields:
-- - location (optional)
-- - bio (optional, short 3–6 lines max enforced at API layer)
-- - social_links (optional JSON object: { platform: url })

CREATE TABLE IF NOT EXISTS `customer_profile_details` (
  `profile_details_id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `location` varchar(120) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `social_links` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`profile_details_id`),
  UNIQUE KEY `uniq_customer_profile_details_customer_id` (`customer_id`),
  CONSTRAINT `fk_customer_profile_details_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


