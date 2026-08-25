const db = require('../config/database');
const logger = require('../utils/logger');

function addMinutes(date, minutes) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function generateCode(length = 6) {
  const min = 10 ** (length - 1);
  const max = (10 ** length) - 1;
  return String(Math.floor(min + Math.random() * (max - min)));
}

const TelegramCommunityLink = {
  async findLinkByTelegramUserId(telegramUserId) {
    const [rows] = await db.query(
      `SELECT tl.*, c.first_name, c.last_name, c.email, c.deleted_at
       FROM telegram_links tl
       JOIN customers c ON c.customer_id = tl.customer_id
       WHERE tl.telegram_user_id = ? AND tl.unlinked_at IS NULL
       LIMIT 1`,
      [telegramUserId]
    );
    return rows[0] || null;
  },

  async findLinkByCustomerId(customerId) {
    const [rows] = await db.query(
      `SELECT tl.*, c.first_name, c.last_name, c.email, c.deleted_at
       FROM telegram_links tl
       JOIN customers c ON c.customer_id = tl.customer_id
       WHERE tl.customer_id = ? AND tl.unlinked_at IS NULL
       LIMIT 1`,
      [customerId]
    );
    return rows[0] || null;
  },

  async createLinkCode(telegramUserId, telegramUsername, expiresInMinutes = 15) {
    const expiresAt = addMinutes(new Date(), expiresInMinutes);
    let code = generateCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await db.query(
          `UPDATE link_codes
           SET used_at = NOW()
           WHERE telegram_user_id = ? AND used_at IS NULL`,
          [telegramUserId]
        );

        await db.query(
          `INSERT INTO link_codes SET ?`,
          [{
            code,
            telegram_user_id: telegramUserId,
            telegram_username: telegramUsername || null,
            expires_at: expiresAt,
          }]
        );

        return { code, expiresAt };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          code = generateCode();
          continue;
        }
        logger.error('Failed to create telegram link code', { telegramUserId, error: err.message });
        throw err;
      }
    }

    throw new Error('Could not generate a unique Telegram link code');
  },

  async consumeLinkCode(code) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT *
         FROM link_codes
         WHERE code = ? AND used_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [code]
      );

      const row = rows[0];
      if (!row) {
        await connection.rollback();
        return { ok: false, reason: 'invalid' };
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        await connection.query(
          `UPDATE link_codes SET used_at = NOW() WHERE id = ?`,
          [row.id]
        );
        await connection.commit();
        return { ok: false, reason: 'expired' };
      }

      await connection.query(
        `UPDATE link_codes SET used_at = NOW() WHERE id = ?`,
        [row.id]
      );
      await connection.commit();
      return { ok: true, row };
    } catch (err) {
      await connection.rollback();
      logger.error('Failed to consume Telegram link code', { code, error: err.message });
      throw err;
    } finally {
      connection.release();
    }
  },

  async upsertLink({ telegramUserId, telegramUsername, customerId }) {
    const existingForTelegram = await this.findLinkByTelegramUserId(telegramUserId);
    if (existingForTelegram && Number(existingForTelegram.customer_id) !== Number(customerId)) {
      const error = new Error('This Telegram account is already linked to another Hive888 account');
      error.code = 'LINK_CONFLICT';
      throw error;
    }

    const existingForCustomer = await this.findLinkByCustomerId(customerId);
    if (existingForCustomer && Number(existingForCustomer.telegram_user_id) !== Number(telegramUserId)) {
      const error = new Error('This Hive888 account is already linked to another Telegram account');
      error.code = 'LINK_CONFLICT';
      throw error;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE telegram_links
         SET unlinked_at = NOW()
         WHERE (telegram_user_id = ? OR customer_id = ?) AND unlinked_at IS NULL`,
        [telegramUserId, customerId]
      );

      await connection.query(
        `INSERT INTO telegram_links SET ?`,
        [{
          telegram_user_id: telegramUserId,
          telegram_username: telegramUsername || null,
          customer_id: customerId,
          linked_at: new Date(),
          unlinked_at: null,
        }]
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      logger.error('Failed to upsert Telegram link', { telegramUserId, customerId, error: err.message });
      throw err;
    } finally {
      connection.release();
    }
  },

  async unlinkByCustomerId(customerId) {
    const [result] = await db.query(
      `UPDATE telegram_links
       SET unlinked_at = NOW()
       WHERE customer_id = ? AND unlinked_at IS NULL`,
      [customerId]
    );
    return result;
  },

  async createOrRefreshJoinRequest(chatId, telegramUserId, telegramUsername) {
    const [existingRows] = await db.query(
      `SELECT id
       FROM telegram_join_requests
       WHERE chat_id = ? AND telegram_user_id = ? AND status = 'pending'
       ORDER BY requested_at DESC
       LIMIT 1`,
      [chatId, telegramUserId]
    );

    if (existingRows[0]) {
      await db.query(
        `UPDATE telegram_join_requests
         SET requested_at = NOW(), telegram_username = ?, resolved_at = NULL, resolution_reason = NULL
         WHERE id = ?`,
        [telegramUsername || null, existingRows[0].id]
      );
      return existingRows[0].id;
    }

    const [result] = await db.query(
      `INSERT INTO telegram_join_requests SET ?`,
      [{
        chat_id: chatId,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername || null,
        status: 'pending',
      }]
    );
    return result.insertId;
  },

  async getPendingJoinRequests(telegramUserId) {
    const [rows] = await db.query(
      `SELECT *
       FROM telegram_join_requests
       WHERE telegram_user_id = ? AND status = 'pending'
       ORDER BY requested_at ASC`,
      [telegramUserId]
    );
    return rows;
  },

  async resolveJoinRequest(id, status, reason = null) {
    await db.query(
      `UPDATE telegram_join_requests
       SET status = ?, resolved_at = NOW(), resolution_reason = ?
       WHERE id = ?`,
      [status, reason, id]
    );
  },
};

module.exports = TelegramCommunityLink;
