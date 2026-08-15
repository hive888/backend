// models/Event.js
const db = require('../config/database');
const logger = require('../utils/logger');

const Event = {
  /**
   * Create a new event
   */
  async create(data) {
    try {
      const sql = `
        INSERT INTO events (
          event_name,
          event_date,
          short_description,
          detailed_content
        ) VALUES (?, ?, ?, ?)
      `;
      
      const [result] = await db.query(sql, [
        data.event_name,
        data.event_date,
        data.short_description,
        data.detailed_content
      ]);
      
      return result.insertId;
    } catch (err) {
      logger.error('Event.create error:', err);
      throw err;
    }
  },

  /**
   * Get event by ID
   */
  async findById(eventId) {
    try {
      const sql = `
        SELECT 
          event_id,
          event_name,
          event_date,
          short_description,
          detailed_content,
          created_at,
          updated_at
        FROM events
        WHERE event_id = ? AND deleted_at IS NULL
      `;
      
      const [rows] = await db.query(sql, [eventId]);
      return rows[0] || null;
    } catch (err) {
      logger.error('Event.findById error:', err);
      throw err;
    }
  },

  /**
   * Get all events (admin - includes deleted)
   */
  async findAllAdmin(filters = {}) {
    try {
      let sql = `
        SELECT 
          event_id,
          event_name,
          event_date,
          short_description,
          detailed_content,
          created_at,
          updated_at,
          deleted_at
        FROM events
        WHERE 1=1
      `;
      
      const params = [];
      
      if (filters.search) {
        sql += ` AND (event_name LIKE ? OR short_description LIKE ?)`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }
      
      if (filters.start_date) {
        sql += ` AND event_date >= ?`;
        params.push(filters.start_date);
      }
      
      if (filters.end_date) {
        sql += ` AND event_date <= ?`;
        params.push(filters.end_date);
      }
      
      // Order by date (latest first)
      sql += ` ORDER BY event_date DESC, created_at DESC`;
      
      // Pagination
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(filters.limit, offset);
      }
      
      const [rows] = await db.query(sql, params);
      
      // Get total count
      let countSql = `SELECT COUNT(*) as total FROM events WHERE 1=1`;
      const countParams = [];
      
      if (filters.search) {
        countSql += ` AND (event_name LIKE ? OR short_description LIKE ?)`;
        const searchTerm = `%${filters.search}%`;
        countParams.push(searchTerm, searchTerm);
      }
      
      if (filters.start_date) {
        countSql += ` AND event_date >= ?`;
        countParams.push(filters.start_date);
      }
      
      if (filters.end_date) {
        countSql += ` AND event_date <= ?`;
        countParams.push(filters.end_date);
      }
      
      const [countRows] = await db.query(countSql, countParams);
      const total = countRows[0]?.total || 0;
      
      return {
        events: rows,
        total,
        page: filters.page || 1,
        limit: filters.limit || rows.length,
        total_pages: filters.limit ? Math.ceil(total / filters.limit) : 1
      };
    } catch (err) {
      logger.error('Event.findAllAdmin error:', err);
      throw err;
    }
  },

  /**
   * Get all active events (client - excludes deleted)
   */
  async findAll(filters = {}) {
    try {
      let sql = `
        SELECT 
          event_id,
          event_name,
          event_date,
          short_description,
          created_at,
          updated_at
        FROM events
        WHERE deleted_at IS NULL
      `;
      
      const params = [];
      
      if (filters.month) {
        sql += ` AND MONTH(event_date) = ?`;
        params.push(filters.month);
      }
      
      if (filters.year) {
        sql += ` AND YEAR(event_date) = ?`;
        params.push(filters.year);
      }
      
      if (filters.start_date) {
        sql += ` AND event_date >= ?`;
        params.push(filters.start_date);
      }
      
      if (filters.end_date) {
        sql += ` AND event_date <= ?`;
        params.push(filters.end_date);
      }
      
      // Order by date (latest/upcoming first)
      sql += ` ORDER BY event_date DESC, created_at DESC`;
      
      // Pagination
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(filters.limit, offset);
      }
      
      const [rows] = await db.query(sql, params);
      
      // Get total count
      let countSql = `SELECT COUNT(*) as total FROM events WHERE deleted_at IS NULL`;
      const countParams = [];
      
      if (filters.month) {
        countSql += ` AND MONTH(event_date) = ?`;
        countParams.push(filters.month);
      }
      
      if (filters.year) {
        countSql += ` AND YEAR(event_date) = ?`;
        countParams.push(filters.year);
      }
      
      if (filters.start_date) {
        countSql += ` AND event_date >= ?`;
        countParams.push(filters.start_date);
      }
      
      if (filters.end_date) {
        countSql += ` AND event_date <= ?`;
        countParams.push(filters.end_date);
      }
      
      const [countRows] = await db.query(countSql, countParams);
      const total = countRows[0]?.total || 0;
      
      return {
        events: rows,
        total,
        page: filters.page || 1,
        limit: filters.limit || rows.length,
        total_pages: filters.limit ? Math.ceil(total / filters.limit) : 1
      };
    } catch (err) {
      logger.error('Event.findAll error:', err);
      throw err;
    }
  },

  /**
   * Update event
   */
  async update(eventId, data) {
    try {
      const sql = `
        UPDATE events
        SET 
          event_name = ?,
          event_date = ?,
          short_description = ?,
          detailed_content = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE event_id = ? AND deleted_at IS NULL
      `;
      
      const [result] = await db.query(sql, [
        data.event_name,
        data.event_date,
        data.short_description,
        data.detailed_content,
        eventId
      ]);
      
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('Event.update error:', err);
      throw err;
    }
  },

  /**
   * Soft delete event
   */
  async delete(eventId) {
    try {
      const sql = `
        UPDATE events
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE event_id = ? AND deleted_at IS NULL
      `;
      
      const [result] = await db.query(sql, [eventId]);
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('Event.delete error:', err);
      throw err;
    }
  }
};

module.exports = Event;


