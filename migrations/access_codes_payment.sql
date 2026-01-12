-- Access code payment configuration
-- If payment_amount = 0, the code is completely free (no Stripe required).

ALTER TABLE `access_codes`
  ADD COLUMN `payment_amount` DECIMAL(10,2) NOT NULL DEFAULT 18.00 AFTER `course_id`,
  ADD COLUMN `payment_currency` VARCHAR(10) NOT NULL DEFAULT 'USD' AFTER `payment_amount`;


