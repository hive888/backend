const db = require('../config/database');
class PaymentScreenshot {
    static async create({ registrationId, fileUrl }) {
      try {
        const [result] = await db.query(
          `INSERT INTO payment_screenshots 
          (registration_id, file_url) 
          VALUES (?, ?)`,
          [registrationId, fileUrl]
        );
        return result.insertId;
      } catch (err) {
        console.log('Failed to create payment screenshot:', {
          error: err.message,
          registrationId
        });
        throw err;
      }
    }
  
    static async findByRegistrationId(registrationId) {
      try {
        const [rows] = await db.query(
          `SELECT * FROM payment_screenshots 
          WHERE registration_id = ?`,
          [registrationId]
        );
        return rows;
      } catch (err) {
        logger.error('Failed to find payment screenshot:', {
          error: err.message,
          registrationId
        });
        throw err;
      }
    }
  }
  
  module.exports = PaymentScreenshot;