// models/ExitExamPayment.js
const db = require('../config/database');
const logger = require('../utils/logger');

const ExitExamPayment = {
  /**
   * Create exit exam payment record
   */
  async create(conn, data) {
    try {
      const sql = `
        INSERT INTO exit_exam_payments (
          customer_id,
          access_code_id,
          registration_id,
          amount,
          currency,
          payment_status,
          transaction_id,
          payment_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await conn.query(sql, [
        data.customer_id,
        data.access_code_id,
        data.registration_id || null,
        data.amount || 0,
        data.currency || 'USD',
        data.payment_status || 'pending',
        data.transaction_id || null,
        data.payment_details ? JSON.stringify(data.payment_details) : null
      ]);
      
      return result.insertId;
    } catch (err) {
      logger.error('ExitExamPayment.create error:', err);
      throw err;
    }
  },

  /**
   * Get exit exam payment by customer and access code
   */
  async findByCustomerAndAccessCode(customerId, accessCodeId) {
    try {
      const sql = `
        SELECT *
        FROM exit_exam_payments
        WHERE customer_id = ? AND access_code_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const [rows] = await db.query(sql, [customerId, accessCodeId]);
      return rows[0] || null;
    } catch (err) {
      logger.error('ExitExamPayment.findByCustomerAndAccessCode error:', err);
      throw err;
    }
  },

  /**
   * Get exit exam payment by ID
   */
  async findById(paymentId) {
    try {
      const sql = `
        SELECT 
          eep.*,
          c.first_name,
          c.last_name,
          c.email,
          ac.code as access_code,
          ac.university_name
        FROM exit_exam_payments eep
        LEFT JOIN customers c ON eep.customer_id = c.customer_id
        LEFT JOIN access_codes ac ON eep.access_code_id = ac.id
        WHERE eep.id = ?
      `;
      
      const [rows] = await db.query(sql, [paymentId]);
      return rows[0] || null;
    } catch (err) {
      logger.error('ExitExamPayment.findById error:', err);
      throw err;
    }
  },

  /**
   * Get exit exam payment by Stripe session ID
   */
  async findByStripeSessionId(sessionId) {
    try {
      const sql = `
        SELECT *
        FROM exit_exam_payments
        WHERE transaction_id = ?
        OR (payment_details LIKE ?)
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const [rows] = await db.query(sql, [sessionId, `%${sessionId}%`]);
      return rows[0] || null;
    } catch (err) {
      logger.error('ExitExamPayment.findByStripeSessionId error:', err);
      throw err;
    }
  },

  /**
   * Update payment status
   */
  async updateStatus(conn, paymentId, status, transactionId = null, paymentDate = null, paymentDetails = null) {
    try {
      const updates = ['payment_status = ?'];
      const params = [status];
      
      if (transactionId) {
        updates.push('transaction_id = ?');
        params.push(transactionId);
      }
      
      if (paymentDate) {
        updates.push('payment_date = ?');
        params.push(paymentDate);
      } else if (status === 'completed' && !paymentDate) {
        updates.push('payment_date = CURRENT_TIMESTAMP');
      }
      
      if (paymentDetails) {
        const currentSql = `SELECT payment_details FROM exit_exam_payments WHERE id = ?`;
        const [currentRows] = await conn.query(currentSql, [paymentId]);
        let currentDetails = {};
        
        if (currentRows[0]?.payment_details) {
          try {
            currentDetails = JSON.parse(currentRows[0].payment_details);
          } catch (e) {
            logger.warn('Failed to parse existing payment_details:', e);
          }
        }
        
        const mergedDetails = { ...currentDetails, ...paymentDetails };
        updates.push('payment_details = ?');
        params.push(JSON.stringify(mergedDetails));
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(paymentId);
      
      const sql = `UPDATE exit_exam_payments SET ${updates.join(', ')} WHERE id = ?`;
      const [result] = await conn.query(sql, params);
      return result.affectedRows;
    } catch (err) {
      logger.error('ExitExamPayment.updateStatus error:', err);
      throw err;
    }
  },

  /**
   * Check if customer has completed exit exam payment
   */
  async hasCompletedPayment(customerId, accessCodeId) {
    try {
      const sql = `
        SELECT id, payment_status, payment_date
        FROM exit_exam_payments
        WHERE customer_id = ? 
        AND access_code_id = ?
        AND payment_status = 'completed'
      `;
      
      const [rows] = await db.query(sql, [customerId, accessCodeId]);
      return rows[0] || null;
    } catch (err) {
      logger.error('ExitExamPayment.hasCompletedPayment error:', err);
      throw err;
    }
  },

  /**
   * Get all exit exam payments with filters
   */
  async getAll(filters = {}) {
    try {
      let sql = `
        SELECT 
          eep.*,
          c.first_name,
          c.last_name,
          c.email,
          ac.code as access_code,
          ac.university_name
        FROM exit_exam_payments eep
        LEFT JOIN customers c ON eep.customer_id = c.customer_id
        LEFT JOIN access_codes ac ON eep.access_code_id = ac.id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (filters.customer_id) {
        sql += ` AND eep.customer_id = ?`;
        params.push(filters.customer_id);
      }
      
      if (filters.access_code_id) {
        sql += ` AND eep.access_code_id = ?`;
        params.push(filters.access_code_id);
      }
      
      if (filters.payment_status) {
        sql += ` AND eep.payment_status = ?`;
        params.push(filters.payment_status);
      }
      
      sql += ` ORDER BY eep.created_at DESC`;
      
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(filters.limit, offset);
      }
      
      const [rows] = await db.query(sql, params);
      
      // Get total count
      let countSql = `SELECT COUNT(*) as total FROM exit_exam_payments WHERE 1=1`;
      const countParams = [];
      
      if (filters.customer_id) {
        countSql += ` AND customer_id = ?`;
        countParams.push(filters.customer_id);
      }
      
      if (filters.access_code_id) {
        countSql += ` AND access_code_id = ?`;
        countParams.push(filters.access_code_id);
      }
      
      if (filters.payment_status) {
        countSql += ` AND payment_status = ?`;
        countParams.push(filters.payment_status);
      }
      
      const [countRows] = await db.query(countSql, countParams);
      const total = countRows[0]?.total || 0;
      
      return {
        payments: rows,
        total,
        page: filters.page || 1,
        limit: filters.limit || rows.length,
        total_pages: filters.limit ? Math.ceil(total / filters.limit) : 1
      };
    } catch (err) {
      logger.error('ExitExamPayment.getAll error:', err);
      throw err;
    }
  }
};

module.exports = ExitExamPayment;

