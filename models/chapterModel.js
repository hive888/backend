const db = require('../config/database');
const logger = require('../utils/logger');

class Chapter {
  async getAll({ page = 1, limit = 10, sortBy = 'sort_order', order = 'ASC' }) {
    try {
      const offset = (page - 1) * limit;
      
      const [chapters] = await db.query(
        `SELECT * FROM chapters 
         ORDER BY ${sortBy} ${order}
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const [count] = await db.query(
        `SELECT COUNT(*) as total FROM chapters`
      );

      return {
        chapters,
        total: count[0].total
      };
    } catch (err) {
      logger.error('Failed to get chapters:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  async getById(id) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM chapters WHERE id = ?`,
        [id]
      );
      return rows[0];
    } catch (err) {
      logger.error('Find chapter by ID failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }

  async create({ title, sort_order = 0 }) {
    try {
      const [result] = await db.query(
        `INSERT INTO chapters (title, sort_order) VALUES (?, ?)`,
        [title, sort_order]
      );
      return result.insertId;
    } catch (err) {
      logger.error('Chapter creation failed:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  async update(id, { title, sort_order }) {
    try {
      const [result] = await db.query(
        `UPDATE chapters SET title = ?, sort_order = ? WHERE id = ?`,
        [title, sort_order, id]
      );
      return result.affectedRows;
    } catch (err) {
      logger.error('Chapter update failed:', {
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
        `DELETE FROM chapters WHERE id = ?`,
        [id]
      );
      return result.affectedRows;
    } catch (err) {
      logger.error('Chapter deletion failed:', {
        error: err.message,
        stack: err.stack,
        id
      });
      throw err;
    }
  }
}

module.exports = new Chapter();