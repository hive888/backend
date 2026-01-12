-- Fix access_codes.created_by type mismatch:
-- Backend uses req.user.user_id (UUID string), but older schema used BIGINT.
-- This migration updates created_by to store UUIDs safely.

ALTER TABLE `access_codes`
  MODIFY COLUMN `created_by` VARCHAR(36) NULL;


