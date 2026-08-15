const db = require('../config/database');
const logger = require('../utils/logger');

class Chapter {
  async getAll({ page = 1, limit = 10, sortBy = 'sort_order', order = 'ASC', courseId = null }) {
    try {
      const offset = (page - 1) * limit;
      let queryStr = 'SELECT * FROM chapters';
      let countStr = 'SELECT COUNT(*) as total FROM chapters';
      const params = [];
      const countParams = [];

      if (courseId !== null) {
        queryStr += ' WHERE course_id = ?';
        countStr += ' WHERE course_id = ?';
        params.push(courseId);
        countParams.push(courseId);
      }

            const allowedSortFields = ['sort_order', 'id', 'title', 'created_at', 'updated_at'];
            const safeSort = allowedSortFields.includes(sortBy) ? sortBy : 'sort_order';
            const safeOrder = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

            queryStr += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [chapters] = await db.query(queryStr, params);
      const [count] = await db.query(countStr, countParams);

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

  async create({ title, sort_order = 0, course_id = null }) {
    try {
      const [result] = await db.query(
        `INSERT INTO chapters (title, sort_order, course_id) VALUES (?, ?, ?)`,
        [title, sort_order, course_id]
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

  async update(id, { title, sort_order, course_id }) {
    try {
      const fields = [];
      const params = [];
      if (title !== undefined) { fields.push('title = ?'); params.push(title); }
      if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order); }
      if (course_id !== undefined) { fields.push('course_id = ?'); params.push(course_id); }

      if (fields.length === 0) return 0;
      params.push(id);

      const [result] = await db.query(
        `UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`,
        params
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