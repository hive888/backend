const db = require('../config/database');
const logger = require('../utils/logger');

const Course = {
  async create({ slug, title, short_description = null, detailed_description = null, thumbnail_url = null, is_active = 1 }) {
    try {
      const [result] = await db.query(
        `INSERT INTO courses (slug, title, short_description, detailed_description, thumbnail_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [String(slug).trim(), title, short_description, detailed_description, thumbnail_url, is_active ? 1 : 0]
      );
      const [rows] = await db.query(
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, created_at, updated_at
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
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, created_at, updated_at
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

  async findBySlug(slug) {
    try {
      const s = String(slug || '').trim();
      if (!s) return null;
      const [rows] = await db.query(
        `SELECT id, slug, title, short_description, detailed_description, thumbnail_url, is_active, created_at, updated_at
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
  }
};

module.exports = Course;


