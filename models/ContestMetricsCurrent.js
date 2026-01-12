// models/ContestMetricsCurrent.js
'use strict';

const db = require('../config/database');

const ContestMetricsCurrent = {
  async upsert({
    registration_id,
    total_wallet_balance,
    total_unrealized_profit,
    net_profit,
    trades_count,
    last_updated_utc
  }) {
    const sql = `
      INSERT INTO contest_metrics_current
        (registration_id, total_wallet_balance, total_unrealized_profit, net_profit, trades_count, last_updated_utc)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_wallet_balance = VALUES(total_wallet_balance),
        total_unrealized_profit = VALUES(total_unrealized_profit),
        net_profit = VALUES(net_profit),
        trades_count = VALUES(trades_count),
        last_updated_utc = VALUES(last_updated_utc),
        updated_at = CURRENT_TIMESTAMP
    `;
    const params = [
      registration_id,
      total_wallet_balance,
      total_unrealized_profit,
      net_profit,
      trades_count,
      last_updated_utc
    ];
    await db.query(sql, params);
  },

  async getByRegistrationId(registration_id) {
    const [rows] = await db.query(
      `SELECT * FROM contest_metrics_current WHERE registration_id = ? LIMIT 1`,
      [registration_id]
    );
    return rows[0] || null;
  },

  // MySQL 8+ (uses ROW_NUMBER). If you're on 5.7, replace with session variables ranking.
// models/ContestMetricsCurrent.js
async leaderboardForContest(contest_id, { limit = 100, country = null } = {}) {
  let sql = `
    SELECT
      r.id AS registration_id,
      r.customer_id,
      r.exchange_user_id,
      COALESCE(r.exchange_username, 'Name') AS exchange_username,
      r.country,
      m.total_wallet_balance,
      m.total_unrealized_profit,
      m.net_profit,
      m.trades_count,
      m.last_updated_utc,
      ROW_NUMBER() OVER (
        ORDER BY
          COALESCE(m.net_profit, 0) DESC,
          COALESCE(m.total_wallet_balance, 0) DESC,
          COALESCE(m.trades_count, 0) DESC,
          r.id ASC
      ) AS rank_position
    FROM contest_registrations r
    LEFT JOIN contest_metrics_current m
      ON m.registration_id = r.id
    WHERE r.contest_id = ?
  `;

  const params = [contest_id];

  // Optional case-insensitive country filter
  if (country && country.trim()) {
    sql += ` AND LOWER(r.country) = LOWER(?)`;
    params.push(country.trim());
  }

  sql += `
    ORDER BY
      COALESCE(m.net_profit, 0) DESC,
      COALESCE(m.total_wallet_balance, 0) DESC,
      COALESCE(m.trades_count, 0) DESC,
      r.id ASC
    LIMIT ?
  `;
  params.push(Number(limit));

  const [rows] = await db.query(sql, params);
  return rows;
}

};

module.exports = ContestMetricsCurrent;
