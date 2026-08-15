const db = require('../config/database');
const logger = require('../utils/logger');

const Course = {
  async create({ slug, title, short_description = null, detailed_description = null, thumbnail_url = null, is_active = 1, price = 0.00, currency = 'USD' }) {
    try {
      const [result] = await db.query(
        `INSERT INTO courses (slug, title, short_description, detailed_description, thumbnail_url, is_active, price, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(slug).trim(), title, short_description, detailed_description, thumbnail_url, is_active ? 1 : 0, price, currency]
      );
      const [rows] = await db.query(
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, price, currency, created_at, updated_at
         FROM courses
         WHERE id = ?
         LIMIT 1`,
         [result.insertId]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('Course.create error:', err);
      throw err;
    }
  },

  async listActive() {
    try {
      const [rows] = await db.query(
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, price, currency, created_at, updated_at
         FROM courses
         WHERE is_active = 1
         ORDER BY created_at DESC`
      );
      return rows;
    } catch (err) {
      logger.error('Course.listActive error:', err);
      throw err;
    }
  },

  async listAll() {
    try {
      const [rows] = await db.query(
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, price, currency, created_at, updated_at
         FROM courses
         ORDER BY created_at DESC`
      );
      return rows;
    } catch (err) {
      logger.error('Course.listAll error:', err);
      throw err;
    }
  },

  async getById(id) {
    try {
      const [rows] = await db.query(
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, price, currency, created_at, updated_at
         FROM courses
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('Course.getById error:', err);
      throw err;
    }
  },

  async findBySlug(slug) {
    try {
      const s = String(slug || '').trim();
      if (!s) return null;
      const [rows] = await db.query(
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, price, currency, created_at, updated_at
         FROM courses
         WHERE slug = ?
         LIMIT 1`,
        [s]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('Course.findBySlug error:', err);
      throw err;
    }
  },

  async update(id, { slug, title, short_description, detailed_description, thumbnail_url, is_active, price, currency }) {
    try {
      const fields = [];
      const params = [];

      if (slug !== undefined) { fields.push('slug = ?'); params.push(slug); }
      if (title !== undefined) { fields.push('title = ?'); params.push(title); }
      if (short_description !== undefined) { fields.push('short_description = ?'); params.push(short_description); }
      if (detailed_description !== undefined) { fields.push('detailed_description = ?'); params.push(detailed_description); }
      if (thumbnail_url !== undefined) { fields.push('thumbnail_url = ?'); params.push(thumbnail_url); }
      if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
      if (price !== undefined) { fields.push('price = ?'); params.push(price); }
      if (currency !== undefined) { fields.push('currency = ?'); params.push(currency); }

      if (fields.length === 0) return 0;

      const queryStr = `UPDATE courses SET ${fields.join(', ')} WHERE id = ?`;
      params.push(id);

      const [result] = await db.query(queryStr, params);
      return result.affectedRows;
    } catch (err) {
      logger.error('Course.update error:', err);
      throw err;
    }
  },

  async delete(id) {
    try {
      const [result] = await db.query(
        `DELETE FROM courses WHERE id = ?`,
        [id]
      );
      return result.affectedRows;
    } catch (err) {
      logger.error('Course.delete error:', err);
      throw err;
    }
  }
};

module.exports = Course;


