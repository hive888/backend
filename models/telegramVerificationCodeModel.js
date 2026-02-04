const db = require('../config/database');
const logger = require('../utils/logger');

const TelegramVerificationCode = {
  /**
   * Generate and store a verification code for Telegram account linking
   */
  async create(telegramUserId, email, code, expiresInMinutes = 15) {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

      // Invalidate any existing codes for this telegram user
      await db.query(
        `UPDATE telegram_verification_codes 
         SET used = 1 
         WHERE telegram_user_id = ? AND used = 0`,
        [telegramUserId]
      );

      await db.query(
        `INSERT INTO telegram_verification_codes (telegram_user_id, email, code, expires_at)
         VALUES (?, ?, ?, ?)`,
        [telegramUserId, email, code, expiresAt]
      );

      return { expiresAt };
    } catch (err) {
      logger.error('TelegramVerificationCode.create error:', err);
      throw err;
    }
  },

  /**
   * Verify a code and mark it as used
   */
  async verifyAndUse(telegramUserId, code) {
    try {
      const [rows] = await db.query(
        `SELECT id, email, expires_at, used
         FROM telegram_verification_codes
         WHERE telegram_user_id = ? AND code = ? AND used = 0
         ORDER BY created_at DESC
         LIMIT 1`,
        [telegramUserId, code]
      );

      if (!rows[0]) {
        return { valid: false, email: null };
      }

      const verification = rows[0];
      const now = new Date();
      const expiresAt = new Date(verification.expires_at);

      if (expiresAt < now) {
        return { valid: false, email: null, reason: 'expired' };
      }

      // Mark as used
      await db.query(
        `UPDATE telegram_verification_codes SET used = 1 WHERE id = ?`,
        [verification.id]
      );

      return { valid: true, email: verification.email };
    } catch (err) {
      logger.error('TelegramVerificationCode.verifyAndUse error:', err);
      throw err;
    }
  },

  /**
   * Clean up expired codes (maintenance task)
   */
  async cleanupExpired() {
    try {
      const [result] = await db.query(
        `DELETE FROM telegram_verification_codes 
         WHERE expires_at < NOW() OR used = 1`
      );
      return result.affectedRows || 0;
    } catch (err) {
      logger.error('TelegramVerificationCode.cleanupExpired error:', err);
      throw err;
    }
  }
};

module.exports = TelegramVerificationCode;

