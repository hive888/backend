const db = require('../config/database');
const logger = require('../utils/logger');

const CustomerCourseAccess = {
  async findByCustomerAndCourse(customer_id, course_id) {
    try {
      const [rows] = await db.query(
        `SELECT *
         FROM customer_course_access
         WHERE customer_id = ? AND course_id = ?
         LIMIT 1`,
        [customer_id, course_id]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('CustomerCourseAccess.findByCustomerAndCourse error:', err);
      throw err;
    }
  },

  async upsertActive(conn, { customer_id, course_id, granted_via = 'access_code', access_code_id = null, expires_at = null }) {
    const sql = `
      INSERT INTO customer_course_access
        (customer_id, course_id, status, granted_via, access_code_id, expires_at)
      VALUES (?, ?, 'active', ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = 'active',
        granted_via = VALUES(granted_via),
        access_code_id = VALUES(access_code_id),
        expires_at = VALUES(expires_at)
    `;
    await conn.query(sql, [customer_id, course_id, granted_via, access_code_id, expires_at]);
  }
};

module.exports = CustomerCourseAccess;



