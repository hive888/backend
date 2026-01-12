// models/ContestRegistration.js
'use strict';

const db = require('../config/database');

const ContestRegistration = {
  async create(data) {
    const sql = `
      INSERT INTO contest_registrations
        (contest_id, customer_id, country,
         binance_api_key_cipher, binance_secret_cipher, api_key_last4,
         exchange_user_id, exchange_username, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;
    const params = [
      data.contest_id,
      data.customer_id,
      data.country,
      data.binance_api_key_cipher || null,
      data.binance_secret_cipher || null,
      data.api_key_last4 || null,
      data.exchange_user_id || null,
      data.exchange_username || null
    ];
    const [r] = await db.query(sql, params);
    return r.insertId;
  },

  async findById(id) {
    const sql = `
      SELECT r.*,
             c.slug AS contest_slug, c.description AS contest_description, c.type AS contest_type
      FROM contest_registrations r
      JOIN contests c ON c.id = r.contest_id
      WHERE r.id = ? LIMIT 1
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  async findByContestAndCustomer(contest_id, customer_id) {
    const [rows] = await db.query(
      `SELECT * FROM contest_registrations WHERE contest_id = ? AND customer_id = ? LIMIT 1`,
      [contest_id, customer_id]
    );
    return rows[0] || null;
  },

  async findByCustomer(customer_id) {
    const sql = `
      SELECT r.*,
             c.slug AS contest_slug, c.description AS contest_description, c.type AS contest_type
      FROM contest_registrations r
      JOIN contests c ON c.id = r.contest_id
      WHERE r.customer_id = ?
      ORDER BY r.registered_at DESC
    `;
    const [rows] = await db.query(sql, [customer_id]);
    return rows;
  },

  async listByContest(contest_id) {
    const sql = `
      SELECT r.*,
             m.total_wallet_balance, m.total_unrealized_profit, m.net_profit, m.trades_count, m.last_updated_utc,
             cu.first_name, cu.last_name, cu.email
      FROM contest_registrations r
      LEFT JOIN contest_metrics_current m ON m.registration_id = r.id
      LEFT JOIN customers cu ON cu.customer_id = r.customer_id
      WHERE r.contest_id = ?
      ORDER BY COALESCE(m.net_profit, 0) DESC,
               COALESCE(m.total_wallet_balance, 0) DESC,
               COALESCE(m.trades_count, 0) DESC,
               r.id ASC
    `;
    const [rows] = await db.query(sql, [contest_id]);
    return rows;
  },

  async updateExchangeIdentity(registration_id, { exchange_user_id, exchange_username }) {
    await db.query(
      `UPDATE contest_registrations
         SET exchange_user_id = ?, exchange_username = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [exchange_user_id || null, exchange_username || null, registration_id]
    );
  }
};

module.exports = ContestRegistration;
