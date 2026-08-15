-- Migration to update customer_profile_details table schema
-- Adds position, organization, skills, experience, and documents columns

ALTER TABLE `customer_profile_details`
  ADD COLUMN `position` varchar(120) DEFAULT NULL AFTER `bio`,
  ADD COLUMN `organization` varchar(120) DEFAULT NULL AFTER `position`,
  ADD COLUMN `skills` json DEFAULT NULL AFTER `organization`,
  ADD COLUMN `experience` text DEFAULT NULL AFTER `skills`,
  ADD COLUMN `documents` json DEFAULT NULL AFTER `experience`;
