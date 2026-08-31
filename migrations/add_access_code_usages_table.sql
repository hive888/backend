-- Tracks which customer redeemed which access code (distinct from access_code_users,
-- which is an admin-managed pre-registered roster with no customer_id/login concept).
-- Referenced by models/accessCodeModel.js (hasUsageByCustomer/recordUsage/getUsageStats)
-- and controllers/academyController.js's redeemAccessCode flow, but the table itself
-- was never created - every redemption attempt failed with "relation does not exist".
CREATE TABLE IF NOT EXISTS access_code_usages (
  id SERIAL PRIMARY KEY,
  access_code_id INTEGER NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(access_code_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_access_code_usages_access_code_id ON access_code_usages(access_code_id);
CREATE INDEX IF NOT EXISTS idx_access_code_usages_customer_id ON access_code_usages(customer_id);
