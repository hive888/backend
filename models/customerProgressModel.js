// models/customerProgressModel.js
const db = require('../config/database');
const logger = require('../utils/logger');

const CustomerProgress = {
  async getCompletedSubsectionIds(customer_id) {
    try {
      const [rows] = await db.query(
        `SELECT subsection_id
         FROM customer_subsection_progress
         WHERE customer_id = ? AND status = 'completed'`,
        [customer_id]
      );
      return rows.map(r => r.subsection_id);
    } catch (err) {
      logger.error('CustomerProgress.getCompletedSubsectionIds error:', err);
      throw err;
    }
  },

  async markSubsectionCompleted(customer_id, subsection_id) {
    try {
      const sql = `
        INSERT INTO customer_subsection_progress (customer_id, subsection_id, status, completed_at)
        VALUES (?, ?, 'completed', NOW())
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          completed_at = NOW()
      `;
      const [res] = await db.query(sql, [customer_id, subsection_id]);
      return res.affectedRows > 0;
    } catch (err) {
      logger.error('CustomerProgress.markSubsectionCompleted error:', err);
      throw err;
    }
  }
};

module.exports = CustomerProgress;
