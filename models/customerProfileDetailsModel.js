const db = require('../config/database');
const logger = require('../utils/logger');

function safeParseJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

const CustomerProfileDetails = {
  async findByCustomerId(customerId) {
    try {
      const [rows] = await db.query(
        `SELECT customer_id, location, bio, social_links, created_at, updated_at
         FROM customer_profile_details
         WHERE customer_id = ?
         LIMIT 1`,
        [customerId]
      );

      const row = rows[0];
      if (!row) return null;

      return {
        ...row,
        social_links: safeParseJson(row.social_links) || {}
      };
    } catch (err) {
      logger.error('CustomerProfileDetails.findByCustomerId failed', {
        customerId,
        error: err.message
      });
      throw err;
    }
  },

  async upsertByCustomerId(customerId, { location, bio, social_links }) {
    try {
      const socialLinksDbValue =
        social_links === null || social_links === undefined
          ? null
          : JSON.stringify(social_links);

      await db.query(
        `INSERT INTO customer_profile_details (customer_id, location, bio, social_links)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           location = VALUES(location),
           bio = VALUES(bio),
           social_links = VALUES(social_links),
           updated_at = CURRENT_TIMESTAMP`,
        [customerId, location ?? null, bio ?? null, socialLinksDbValue]
      );

      return await this.findByCustomerId(customerId);
    } catch (err) {
      logger.error('CustomerProfileDetails.upsertByCustomerId failed', {
        customerId,
        error: err.message
      });
      throw err;
    }
  }
};

module.exports = CustomerProfileDetails;


