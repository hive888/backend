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
        `SELECT customer_id, location, bio, position, organization, skills, experience, documents, social_links, created_at, updated_at
         FROM customer_profile_details
         WHERE customer_id = ?
         LIMIT 1`,
        [customerId]
      );

      const row = rows[0];
      if (!row) return null;

      return {
        ...row,
        skills: safeParseJson(row.skills) || [],
        documents: safeParseJson(row.documents) || [],
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

  async upsertByCustomerId(customerId, { location, bio, social_links, position, organization, skills, experience, documents }) {
    try {
      const socialLinksDbValue =
        social_links === null || social_links === undefined
          ? null
          : JSON.stringify(social_links);

      const skillsDbValue =
        skills === null || skills === undefined
          ? null
          : JSON.stringify(skills);

      const documentsDbValue =
        documents === null || documents === undefined
          ? null
          : JSON.stringify(documents);

      await db.query(
        `INSERT INTO customer_profile_details (customer_id, location, bio, position, organization, skills, experience, documents, social_links)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           location = VALUES(location),
           bio = VALUES(bio),
           position = VALUES(position),
           organization = VALUES(organization),
           skills = VALUES(skills),
           experience = VALUES(experience),
           documents = VALUES(documents),
           social_links = VALUES(social_links),
           updated_at = CURRENT_TIMESTAMP`,
        [
          customerId,
          location ?? null,
          bio ?? null,
          position ?? null,
          organization ?? null,
          skillsDbValue,
          experience ?? null,
          documentsDbValue,
          socialLinksDbValue
        ]
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


