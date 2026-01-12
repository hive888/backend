// models/Contest.js
'use strict';

const db = require('../config/database');

const Contest = {
  async create({ slug, description, type }) {
    const sql = `INSERT INTO contests (slug, description, type) VALUES (?, ?, ?)`;
    const [r] = await db.query(sql, [String(slug).trim(), description, type]);
    return r.insertId;
  },

  async listAll() {
    const [rows] = await db.query(`SELECT * FROM contests ORDER BY created_at DESC`);
    return rows;
  },

  async findBySlug(slug) {
    const [rows] = await db.query(
      `SELECT * FROM contests WHERE slug = ? LIMIT 1`,
      [String(slug || '').trim()]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query(`SELECT * FROM contests WHERE id = ?`, [id]);
    return rows[0] || null;
  },

  async updateById(id, { description, type }) {
    const sets = [];
    const params = [];
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (type !== undefined)        { sets.push('type = ?');        params.push(type); }
    if (!sets.length) return true;
    params.push(id);
    const sql = `UPDATE contests SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await db.query(sql, params);
    return true;
  },

  async deleteById(id) {
    await db.query(`DELETE FROM contests WHERE id = ?`, [id]);
  }
};

module.exports = Contest;
