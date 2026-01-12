// models/paymentTrackingModel.js
const db = require('../config/database');
const logger = require('../utils/logger');

const PaymentTracking = {
  /**
   * Create a new payment record
   */
  async create(conn, data) {
    try {
      const sql = `
        INSERT INTO payment_tracking (
          customer_id,
          access_code_id,
          registration_id,
          amount,
          currency,
          payment_method,
          payment_status,
          transaction_id,
          payment_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await conn.query(sql, [
        data.customer_id,
        data.access_code_id,
        data.registration_id || null,
        data.amount || 18.00,
        data.currency || 'USD',
        data.payment_method || 'stripe',
        data.payment_status || 'pending',
        data.transaction_id || null,
        data.payment_details ? JSON.stringify(data.payment_details) : null
      ]);
      
      return result.insertId;
    } catch (err) {
      logger.error('PaymentTracking.create error:', err);
      throw err;
    }
  },

  /**
   * Get payment by ID
   */
  async getById(id) {
    try {
      const sql = `
        SELECT 
          pt.*,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          ac.code as access_code,
          ac.university_name,
          sr.status as registration_status
        FROM payment_tracking pt
        LEFT JOIN customers c ON pt.customer_id = c.customer_id
        LEFT JOIN access_codes ac ON pt.access_code_id = ac.id
        LEFT JOIN selfstudy_registrations sr ON pt.registration_id = sr.id
        WHERE pt.id = ?
      `;
      
      const [rows] = await db.query(sql, [id]);
      return rows[0] || null;
    } catch (err) {
      logger.error('PaymentTracking.getById error:', err);
      throw err;
    }
  },

  /**
   * Get payment by customer and access code
   */
  async getByCustomerAndAccessCode(customer_id, access_code_id) {
    try {
      const sql = `
        SELECT * 
        FROM payment_tracking 
        WHERE customer_id = ? AND access_code_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const [rows] = await db.query(sql, [customer_id, access_code_id]);
      return rows[0] || null;
    } catch (err) {
      logger.error('PaymentTracking.getByCustomerAndAccessCode error:', err);
      throw err;
    }
  },

  /**
   * Update payment status
   */
  async updateStatus(conn, payment_id, status, transaction_id = null, payment_date = null, payment_details = null) {
    try {
      const updates = ['payment_status = ?'];
      const params = [status];
      
      if (transaction_id) {
        updates.push('transaction_id = ?');
        params.push(transaction_id);
      }
      
      if (payment_date) {
        updates.push('payment_date = ?');
        params.push(payment_date);
      } else if (status === 'completed' && !payment_date) {
        updates.push('payment_date = CURRENT_TIMESTAMP');
      }
      
      if (payment_details) {
        // Merge with existing payment_details
        const currentSql = `SELECT payment_details FROM payment_tracking WHERE id = ?`;
        const [currentRows] = await conn.query(currentSql, [payment_id]);
        let currentDetails = {};
        
        if (currentRows[0]?.payment_details) {
          try {
            currentDetails = JSON.parse(currentRows[0].payment_details);
          } catch (e) {
            logger.warn('Failed to parse existing payment_details:', e);
          }
        }
        
        const mergedDetails = { ...currentDetails, ...payment_details };
        updates.push('payment_details = ?');
        params.push(JSON.stringify(mergedDetails));
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(payment_id);
      
      const sql = `UPDATE payment_tracking SET ${updates.join(', ')} WHERE id = ?`;
      const [result] = await conn.query(sql, params);
      return result.affectedRows;
    } catch (err) {
      logger.error('PaymentTracking.updateStatus error:', err);
      throw err;
    }
  },

  /**
   * Get payment by Stripe session ID
   */
  async getByStripeSessionId(session_id) {
    try {
      const sql = `
        SELECT *
        FROM payment_tracking 
        WHERE transaction_id = ?
        OR (payment_details LIKE ?)
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const [rows] = await db.query(sql, [session_id, `%${session_id}%`]);
      return rows[0] || null;
    } catch (err) {
      logger.error('PaymentTracking.getByStripeSessionId error:', err);
      throw err;
    }
  },

  /**
   * Get payment by payment reference
   */
  async getByPaymentReference(payment_reference) {
    try {
      const sql = `
        SELECT *
        FROM payment_tracking 
        WHERE payment_details LIKE ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const [rows] = await db.query(sql, [`%${payment_reference}%`]);
      return rows[0] || null;
    } catch (err) {
      logger.error('PaymentTracking.getByPaymentReference error:', err);
      throw err;
    }
  },

  /**
   * Get all payments with filters
   */
  async getAll(filters = {}) {
    try {
      let sql = `
        SELECT 
          pt.*,
          c.first_name,
          c.last_name,
          c.email,
          ac.code as access_code,
          ac.university_name,
          sr.status as registration_status
        FROM payment_tracking pt
        LEFT JOIN customers c ON pt.customer_id = c.customer_id
        LEFT JOIN access_codes ac ON pt.access_code_id = ac.id
        LEFT JOIN selfstudy_registrations sr ON pt.registration_id = sr.id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (filters.customer_id) {
        sql += ` AND pt.customer_id = ?`;
        params.push(filters.customer_id);
      }
      
      if (filters.access_code_id) {
        sql += ` AND pt.access_code_id = ?`;
        params.push(filters.access_code_id);
      }
      
      if (filters.payment_status) {
        sql += ` AND pt.payment_status = ?`;
        params.push(filters.payment_status);
      }
      
      if (filters.payment_method) {
        sql += ` AND pt.payment_method = ?`;
        params.push(filters.payment_method);
      }
      
      if (filters.transaction_id) {
        sql += ` AND pt.transaction_id = ?`;
        params.push(filters.transaction_id);
      }
      
      if (filters.start_date) {
        sql += ` AND DATE(pt.created_at) >= ?`;
        params.push(filters.start_date);
      }
      
      if (filters.end_date) {
        sql += ` AND DATE(pt.created_at) <= ?`;
        params.push(filters.end_date);
      }
      
      if (filters.search) {
        sql += ` AND (
          c.first_name LIKE ? OR 
          c.last_name LIKE ? OR 
          c.email LIKE ? OR 
          ac.code LIKE ? OR 
          ac.university_name LIKE ? OR
          pt.transaction_id LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      // For pagination
      let countSql = `SELECT COUNT(*) as total FROM (${sql}) as count_table`;
      const [countRows] = await db.query(countSql, params);
      const total = countRows[0]?.total || 0;
      
      // Add ordering and pagination
      sql += ` ORDER BY pt.created_at DESC`;
      
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(filters.limit, offset);
      }
      
      const [rows] = await db.query(sql, params);
      
      return {
        payments: rows,
        total,
        page: filters.page || 1,
        limit: filters.limit || rows.length,
        total_pages: filters.limit ? Math.ceil(total / filters.limit) : 1
      };
    } catch (err) {
      logger.error('PaymentTracking.getAll error:', err);
      throw err;
    }
  },

  /**
   * Get payment statistics
   */
  async getStats(filters = {}) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_payments,
          SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
          SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
          SUM(CASE WHEN payment_status = 'processing' THEN 1 ELSE 0 END) as processing_payments,
          SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
          SUM(CASE WHEN payment_status = 'refunded' THEN 1 ELSE 0 END) as refunded_payments,
          SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as total_revenue,
          AVG(CASE WHEN payment_status = 'completed' THEN amount ELSE NULL END) as avg_payment_amount,
          MIN(created_at) as first_payment_date,
          MAX(created_at) as last_payment_date
        FROM payment_tracking
        WHERE 1=1
      `;
      
      const params = [];
      
      if (filters.start_date) {
        sql += ` AND DATE(created_at) >= ?`;
        params.push(filters.start_date);
      }
      
      if (filters.end_date) {
        sql += ` AND DATE(created_at) <= ?`;
        params.push(filters.end_date);
      }
      
      if (filters.payment_method) {
        sql += ` AND payment_method = ?`;
        params.push(filters.payment_method);
      }
      
      const [rows] = await db.query(sql, params);
      
      // Get daily revenue for the last 30 days
      const dailySql = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as payment_count,
          SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as daily_revenue
        FROM payment_tracking
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
      
      const [dailyRows] = await db.query(dailySql);
      
      // Get payment method distribution
      const methodSql = `
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as revenue
        FROM payment_tracking
        GROUP BY payment_method
        ORDER BY count DESC
      `;
      
      const [methodRows] = await db.query(methodSql);
      
      return {
        overview: rows[0] || {},
        daily_stats: dailyRows,
        method_distribution: methodRows
      };
    } catch (err) {
      logger.error('PaymentTracking.getStats error:', err);
      throw err;
    }
  },

  /**
   * Check if customer has completed payment for access code
   */
  async hasCompletedPayment(customer_id, access_code_id) {
    try {
      const sql = `
        SELECT id, payment_status, payment_date
        FROM payment_tracking
        WHERE customer_id = ? 
        AND access_code_id = ?
        AND payment_status = 'completed'
      `;
      
      const [rows] = await db.query(sql, [customer_id, access_code_id]);
      return rows[0] || null;
    } catch (err) {
      logger.error('PaymentTracking.hasCompletedPayment error:', err);
      throw err;
    }
  },

  /**
   * Get customer's payment history
   */
  async getCustomerPayments(customer_id, filters = {}) {
    try {
      let sql = `
        SELECT 
          pt.*,
          ac.code as access_code,
          ac.university_name,
          sr.status as registration_status,
          sr.registered_at
        FROM payment_tracking pt
        LEFT JOIN access_codes ac ON pt.access_code_id = ac.id
        LEFT JOIN selfstudy_registrations sr ON pt.registration_id = sr.id
        WHERE pt.customer_id = ?
      `;
      
      const params = [customer_id];
      
      if (filters.payment_status) {
        sql += ` AND pt.payment_status = ?`;
        params.push(filters.payment_status);
      }
      
      if (filters.start_date) {
        sql += ` AND DATE(pt.created_at) >= ?`;
        params.push(filters.start_date);
      }
      
      if (filters.end_date) {
        sql += ` AND DATE(pt.created_at) <= ?`;
        params.push(filters.end_date);
      }
      
      sql += ` ORDER BY pt.created_at DESC`;
      
      if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(filters.limit);
      }
      
      const [rows] = await db.query(sql, params);
      return rows;
    } catch (err) {
      logger.error('PaymentTracking.getCustomerPayments error:', err);
      throw err;
    }
  },

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(status, limit = 100) {
    try {
      const sql = `
        SELECT 
          pt.*,
          c.first_name,
          c.last_name,
          c.email,
          ac.code as access_code
        FROM payment_tracking pt
        LEFT JOIN customers c ON pt.customer_id = c.customer_id
        LEFT JOIN access_codes ac ON pt.access_code_id = ac.id
        WHERE pt.payment_status = ?
        ORDER BY pt.created_at DESC
        LIMIT ?
      `;
      
      const [rows] = await db.query(sql, [status, limit]);
      return rows;
    } catch (err) {
      logger.error('PaymentTracking.getPaymentsByStatus error:', err);
      throw err;
    }
  },

  /**
   * Update payment with registration ID
   */
  async updateRegistrationId(conn, payment_id, registration_id) {
    try {
      const sql = `
        UPDATE payment_tracking 
        SET registration_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      const [result] = await conn.query(sql, [registration_id, payment_id]);
      return result.affectedRows;
    } catch (err) {
      logger.error('PaymentTracking.updateRegistrationId error:', err);
      throw err;
    }
  }
};

module.exports = PaymentTracking;