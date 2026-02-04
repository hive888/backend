// models/University.js
const db = require('../config/database');
const logger = require('../utils/logger');

const University = {
  /**
   * Create a new university
   */
  async create(data) {
    try {
      const sql = `
        INSERT INTO universities (
          university_name,
          certificate_file_url,
          achievement_certificate_file_url,
          stamp_image_url,
          is_active
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      const [result] = await db.query(sql, [
        data.university_name,
        data.certificate_file_url || null,
        data.achievement_certificate_file_url || null,
        data.stamp_image_url || null, // Keep for backward compatibility
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
      ]);
      
      return result.insertId;
    } catch (err) {
      logger.error('University.create error:', err);
      throw err;
    }
  },

  /**
   * Get university by ID
   */
  async findById(universityId) {
    try {
      const sql = `
        SELECT 
          university_id,
          university_name,
          certificate_file_url,
          achievement_certificate_file_url,
          stamp_image_url,
          is_active,
          created_at,
          updated_at
        FROM universities
        WHERE university_id = ?
      `;
      
      const [rows] = await db.query(sql, [universityId]);
      return rows[0] || null;
    } catch (err) {
      logger.error('University.findById error:', err);
      throw err;
    }
  },

  /**
   * Get all universities
   */
  async findAll(filters = {}) {
    try {
      let sql = `
        SELECT 
          university_id,
          university_name,
          certificate_file_url,
          achievement_certificate_file_url,
          stamp_image_url,
          is_active,
          created_at,
          updated_at
        FROM universities
        WHERE 1=1
      `;
      
      const params = [];
      
      if (filters.is_active !== undefined) {
        sql += ` AND is_active = ?`;
        params.push(filters.is_active ? 1 : 0);
      }
      
      if (filters.search) {
        sql += ` AND university_name LIKE ?`;
        params.push(`%${filters.search}%`);
      }
      
      sql += ` ORDER BY university_name ASC`;
      
      const [rows] = await db.query(sql, params);
      return rows;
    } catch (err) {
      logger.error('University.findAll error:', err);
      throw err;
    }
  },

  /**
   * Update university
   */
  async update(universityId, data) {
    try {
      const updates = [];
      const params = [];
      
      if (data.university_name !== undefined) {
        updates.push('university_name = ?');
        params.push(data.university_name);
      }
      
      if (data.certificate_file_url !== undefined) {
        updates.push('certificate_file_url = ?');
        params.push(data.certificate_file_url);
      }
      
      if (data.achievement_certificate_file_url !== undefined) {
        updates.push('achievement_certificate_file_url = ?');
        params.push(data.achievement_certificate_file_url);
      }
      
      if (data.stamp_image_url !== undefined) {
        updates.push('stamp_image_url = ?');
        params.push(data.stamp_image_url);
      }
      
      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(data.is_active ? 1 : 0);
      }
      
      if (updates.length === 0) {
        return 0;
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(universityId);
      
      const sql = `
        UPDATE universities
        SET ${updates.join(', ')}
        WHERE university_id = ?
      `;
      
      const [result] = await db.query(sql, params);
      return result.affectedRows;
    } catch (err) {
      logger.error('University.update error:', err);
      throw err;
    }
  },

  /**
   * Delete university (soft delete by setting is_active = 0)
   */
  async delete(universityId) {
    try {
      const sql = `
        UPDATE universities
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE university_id = ?
      `;
      
      const [result] = await db.query(sql, [universityId]);
      return result.affectedRows;
    } catch (err) {
      logger.error('University.delete error:', err);
      throw err;
    }
  }
};

module.exports = University;

