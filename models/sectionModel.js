const db = require('../config/database');
const logger = require('../utils/logger');

class Section {
  async getAll({ page = 1, limit = 10, sortBy = 'sort_order', order = 'ASC' }) {
    try {
      const offset = (page - 1) * limit;
      
      const [sections] = await db.query(
        `SELECT s.*, c.title as chapter_title 
         FROM sections s
         LEFT JOIN chapters c ON s.chapter_id = c.id
         ORDER BY s.${sortBy} ${order}
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const [count] = await db.query(
        `SELECT COUNT(*) as total FROM sections`
      );

      return {
        sections,
        total: count[0].total
      };
    } catch (err) {
      logger.error('Failed to get sections:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  async getByChapterId(chapterId, { page = 1, limit = 10, sortBy = 'sort_order', order = 'ASC' }) {
    try {
      const offset = (page - 1) * limit;
      
      const [sections] = await db.query(
        `SELECT s.*, c.title as chapter_title 
         FROM sections s
         LEFT JOIN chapters c ON s.chapter_id = c.id
         WHERE s.chapter_id = ?
         ORDER BY s.${sortBy} ${order}
         LIMIT ? OFFSET ?`,
        [chapterId, limit, offset]
      );

      const [count] = await db.query(
        `SELECT COUNT(*) as total FROM sections WHERE chapter_id = ?`,
        [chapterId]
      );

      return {
        sections,
        total: count[0].total
      };
    } catch (err) {
      logger.error('Failed to get sections by chapter:', {
        error: err.message,
        stack: err.stack,
        chapterId
      });
      throw err;
    }
  }

  async getById(id) {
    try {
      const [rows] = await db.query(
        `SELECT s.*, c.title as chapter_title 
         FROM sections s
         LEFT JOIN chapters c ON s.chapter_id = c.id
         WHERE s.id = ?`,
        [id]
      );
      return rows[0];
    } catch (err) {
      logger.error('Find section by ID failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }

  async create({ chapter_id, title, subtitle, sort_order = 0 }) {
    try {
      const [result] = await db.query(
        `INSERT INTO sections (chapter_id, title, subtitle, sort_order) VALUES (?, ?, ?, ?)`,
        [chapter_id, title, subtitle, sort_order]
      );
      return result.insertId;
    } catch (err) {
      logger.error('Section creation failed:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  async update(id, { chapter_id, title, subtitle, sort_order }) {
    try {
      const [result] = await db.query(
        `UPDATE sections SET chapter_id = ?, title = ?, subtitle = ?, sort_order = ? WHERE id = ?`,
        [chapter_id, title, subtitle, sort_order, id]
      );
      return result.affectedRows;
    } catch (err) {
      logger.error('Section update failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }

  async delete(id) {
    try {
      const [result] = await db.query(
        `DELETE FROM sections WHERE id = ?`,
        [id]
      );
      return result.affectedRows;
    } catch (err) {
      logger.error('Section deletion failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }
}

module.exports = new Section();