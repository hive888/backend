const db = require('../config/database');
const logger = require('../utils/logger');

const QUESTIONNAIRE_CATEGORIES = [
  'talent_pool', 'project_pool', 'education', 'hiring_investing',
  'talent_pool_skill', 'project_pool_need', 'education_topic', 'hiring_investing_looking_for'
];

const Interest = {
  async getAll() {
    try {
      const placeholders = QUESTIONNAIRE_CATEGORIES.map(() => '?').join(', ');
      const [rows] = await db.query(
        `SELECT id, name, category FROM interests WHERE category IN (${placeholders}) ORDER BY id`,
        QUESTIONNAIRE_CATEGORIES
      );
      return rows;
    } catch (err) {
      logger.error('Interest.getAll error:', err);
      throw err;
    }
  },

  async getForCustomer(customerId) {
    try {
      const [rows] = await db.query(
        `SELECT i.id, i.name, i.category
         FROM user_interests ui
         JOIN interests i ON ui.tag_id = i.id
         WHERE ui.customer_id = ?
         ORDER BY i.id`,
        [customerId]
      );
      return rows;
    } catch (err) {
      logger.error('Interest.getForCustomer error:', err);
      throw err;
    }
  },

  async getPromptedAt(customerId) {
    try {
      const [rows] = await db.query(
        `SELECT interests_prompted_at FROM customers WHERE customer_id = ?`,
        [customerId]
      );
      return rows[0]?.interests_prompted_at || null;
    } catch (err) {
      logger.error('Interest.getPromptedAt error:', err);
      throw err;
    }
  },

  async setForCustomer(customerId, interestIds = []) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(`DELETE FROM user_interests WHERE customer_id = ?`, [customerId]);

      for (const tagId of interestIds) {
        await conn.query(
          `INSERT INTO user_interests (customer_id, tag_id) VALUES (?, ?)`,
          [customerId, tagId]
        );
      }

      await conn.query(
        `UPDATE customers SET interests_prompted_at = CURRENT_TIMESTAMP WHERE customer_id = ?`,
        [customerId]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      logger.error('Interest.setForCustomer error:', err);
      throw err;
    } finally {
      conn.release();
    }
  }
};

module.exports = Interest;
