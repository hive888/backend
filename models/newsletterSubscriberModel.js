const db = require('../config/database');
const logger = require('../utils/logger');

const NewsletterSubscriber = {
  /**
   * Create a new newsletter subscriber
   */
  async create(email) {
    try {
      const [result] = await db.query(
        `INSERT INTO newsletter_subscribers (email, subscribed_at, status)
         VALUES (?, NOW(), 'active')
         ON DUPLICATE KEY UPDATE 
           status = 'active',
           subscribed_at = NOW(),
           unsubscribed_at = NULL`,
        [email]
      );
      return result.insertId || result.affectedRows;
    } catch (err) {
      logger.error('NewsletterSubscriber.create error:', err);
      throw err;
    }
  },

  /**
   * Check if email exists
   */
  async findByEmail(email) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM newsletter_subscribers WHERE email = ? LIMIT 1`,
        [email]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('NewsletterSubscriber.findByEmail error:', err);
      throw err;
    }
  },

  /**
   * Unsubscribe an email
   */
  async unsubscribe(email) {
    try {
      const [result] = await db.query(
        `UPDATE newsletter_subscribers 
         SET status = 'unsubscribed', unsubscribed_at = NOW()
         WHERE email = ?`,
        [email]
      );
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('NewsletterSubscriber.unsubscribe error:', err);
      throw err;
    }
  },

  /**
   * Get all active subscribers
   */
  async getAllActive({ page = 1, limit = 100 }) {
    try {
      const offset = (page - 1) * limit;
      const [rows] = await db.query(
        `SELECT email, subscribed_at 
         FROM newsletter_subscribers 
         WHERE status = 'active'
         ORDER BY subscribed_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      
      const [count] = await db.query(
        `SELECT COUNT(*) as total FROM newsletter_subscribers WHERE status = 'active'`
      );

      return {
        subscribers: rows,
        total: count[0].total,
        page,
        limit
      };
    } catch (err) {
      logger.error('NewsletterSubscriber.getAllActive error:', err);
      throw err;
    }
  }
};

module.exports = NewsletterSubscriber;

