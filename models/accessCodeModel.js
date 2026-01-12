// models/accessCodeModel.js
const db = require('../config/database');
const logger = require('../utils/logger');

function formatMySQLDateTime(value) {
  if (value === null || value === undefined || value === '') return null;

  // If already a Date
  if (value instanceof Date) {
    const iso = value.toISOString(); // UTC
    return iso.slice(0, 19).replace('T', ' '); // YYYY-MM-DD HH:mm:ss
  }

  // If date-only string
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return null;

    // Already MySQL datetime?
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(v)) return v;

    // Date only -> treat as start of day
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v} 00:00:00`;

    // ISO string -> convert
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19).replace('T', ' ');
    }
    return v; // let DB validate
  }

  // numeric timestamps
  if (typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  return value;
}

const AccessCode = {
  async findActiveByCode(code) {
    try {
      const trimmed = String(code || '').trim();
      if (!trimmed) return null;

      const sql = `
        SELECT *
        FROM access_codes
        WHERE UPPER(code) = UPPER(?)
          AND is_active = 1
          AND (expires_at IS NULL OR expires_at >= NOW())
        LIMIT 1
      `;
      const [rows] = await db.query(sql, [trimmed]);
      return rows[0] || null;
    } catch (err) {
      logger.error('AccessCode.findActiveByCode error:', err);
      throw err;
    }
  },

  async findByIdForUpdate(conn, id) {
    const sql = `SELECT * FROM access_codes WHERE id = ? FOR UPDATE`;
    const [rows] = await conn.query(sql, [id]);
    return rows[0] || null;
  },

  async incrementUsage(conn, id) {
    const sql = `UPDATE access_codes SET used_count = used_count + 1 WHERE id = ?`;
    await conn.query(sql, [id]);
  },

  async hasUsageByCustomer(conn, access_code_id, customer_id) {
    const sql = `
      SELECT id
      FROM access_code_usages
      WHERE access_code_id = ? AND customer_id = ?
      LIMIT 1
    `;
    const [rows] = await conn.query(sql, [access_code_id, customer_id]);
    return !!rows[0];
  },

  async recordUsage(conn, access_code_id, customer_id) {
    const sql = `
      INSERT INTO access_code_usages (access_code_id, customer_id)
      VALUES (?, ?)
    `;
    await conn.query(sql, [access_code_id, customer_id]);
  },

  // ========== ACCESS CODE CRUD METHODS ==========

  async getAll(filters = {}) {
    try {
      let sql = `
        SELECT 
          id, 
          code,
          course_id,
          university_name,
          total_students,
          max_uses,
          used_count,
          is_active,
          created_at,
          expires_at,
          notes,
          created_by,
          payment_amount,
          payment_currency
        FROM access_codes
        WHERE 1=1
      `;
      const params = [];

      if (filters.search) {
        sql += ` AND (
          code LIKE ? OR 
          university_name LIKE ? OR 
          notes LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (filters.is_active !== undefined) {
        sql += ` AND is_active = ?`;
        params.push(filters.is_active ? 1 : 0);
      }

      if (filters.university_name) {
        sql += ` AND university_name = ?`;
        params.push(filters.university_name);
      }

      // For pagination
      let countSql = `SELECT COUNT(*) as total FROM (${sql}) as count_table`;
      const [countRows] = await db.query(countSql, params);
      const total = countRows[0]?.total || 0;

      // Add ordering and pagination
      sql += ` ORDER BY created_at DESC`;
      
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(filters.limit, offset);
      }

      const [rows] = await db.query(sql, params);
      
      return {
        access_codes: rows,
        total,
        page: filters.page || 1,
        limit: filters.limit || rows.length,
        total_pages: filters.limit ? Math.ceil(total / filters.limit) : 1
      };
    } catch (err) {
      logger.error('AccessCode.getAll error:', err);
      throw err;
    }
  },

  async getById(id) {
    try {
      const sql = `
        SELECT 
          id, 
          code,
          course_id,
          university_name,
          total_students,
          max_uses,
          used_count,
          is_active,
          created_at,
          expires_at,
          notes,
          created_by,
          payment_amount,
          payment_currency
        FROM access_codes
        WHERE id = ?
      `;
      const [rows] = await db.query(sql, [id]);
      return rows[0] || null;
    } catch (err) {
      logger.error('AccessCode.getById error:', err);
      throw err;
    }
  },

  async create(data) {
    const sql = `
      INSERT INTO access_codes (
        code,
        course_id,
        university_name,
        total_students,
        max_uses,
        is_active,
        expires_at,
        notes,
        created_by,
        payment_amount,
        payment_currency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      data.code,
      data.course_id || null,
      data.university_name || null,
      data.total_students || null,
      data.max_uses || null,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      formatMySQLDateTime(data.expires_at),
      data.notes || null,
      data.created_by || null,
      data.payment_amount !== undefined ? data.payment_amount : 18.00,
      data.payment_currency || 'USD'
    ];

    try {
      const [result] = await db.query(sql, params);
      return result.insertId;
    } catch (err) {
      const msg = err?.sqlMessage || err?.message || '';
      const isCreatedByTruncation =
        (err?.code === 'WARN_DATA_TRUNCATED' || err?.errno === 1265) &&
        /Data truncated for column 'created_by'/i.test(msg);

      // Backward-compatible fallback: older DBs defined access_codes.created_by as BIGINT.
      // In that case, inserting UUIDs (req.user.user_id) will fail; retry with created_by = NULL.
      if (isCreatedByTruncation) {
        logger.warn('AccessCode.create: created_by column type mismatch; retrying with created_by = NULL. Run migration: migrations/access_codes_created_by_uuid.sql', {
          created_by: data.created_by
        });
        const retryParams = [...params];
        retryParams[8] = null; // created_by position
        const [result] = await db.query(sql, retryParams);
        return result.insertId;
      }

      logger.error('AccessCode.create error:', err);
      throw err;
    }
  },

  async update(id, data) {
    try {
      const allowedFields = [
        'code',
        'course_id',
        'university_name',
        'total_students',
        'max_uses',
        'is_active',
        'expires_at',
        'notes',
        'payment_amount',
        'payment_currency'
      ];
      
      const updates = [];
      const params = [];
      
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          
          if (field === 'is_active') {
            params.push(data[field] ? 1 : 0);
          } else if (field === 'expires_at') {
            params.push(formatMySQLDateTime(data[field]));
          } else {
            params.push(data[field]);
          }
        }
      });
      
      if (updates.length === 0) {
        return 0; // Nothing to update
      }
      
      params.push(id);
      
      const sql = `
        UPDATE access_codes 
        SET ${updates.join(', ')}
        WHERE id = ?
      `;
      
      const [result] = await db.query(sql, params);
      return result.affectedRows;
    } catch (err) {
      logger.error('AccessCode.update error:', err);
      throw err;
    }
  },

  async delete(id) {
    try {
      const sql = `DELETE FROM access_codes WHERE id = ?`;
      const [result] = await db.query(sql, [id]);
      return result.affectedRows;
    } catch (err) {
      logger.error('AccessCode.delete error:', err);
      throw err;
    }
  },

  async getUsageStats(id) {
    try {
      // Get basic code info
      const code = await this.getById(id);
      if (!code) return null;

      // Get usage details
      const usageSql = `
        SELECT 
          u.customer_id,
          c.first_name,
          c.last_name,
          c.email,
          c.phone,
          u.created_at as used_at,
          r.registered_at,
          r.status as registration_status,
          r.certificate_url
        FROM access_code_usages u
        LEFT JOIN customers c ON u.customer_id = c.customer_id
        LEFT JOIN selfstudy_registrations r ON u.customer_id = r.customer_id
        WHERE u.access_code_id = ?
        ORDER BY u.created_at DESC
      `;
      
      const [usageRows] = await db.query(usageSql, [id]);
      
      // Get completion stats
      const statsSql = `
        SELECT 
          COUNT(DISTINCT u.customer_id) as total_used,
          COUNT(DISTINCT r.id) as total_registered,
          COUNT(DISTINCT CASE WHEN r.certificate_url IS NOT NULL THEN r.customer_id END) as total_certified
        FROM access_code_usages u
        LEFT JOIN selfstudy_registrations r ON u.customer_id = r.customer_id AND r.status = 'active'
        WHERE u.access_code_id = ?
      `;
      
      const [statsRows] = await db.query(statsSql, [id]);
      
      return {
        code_info: code,
        usage_stats: statsRows[0] || {},
        usage_details: usageRows
      };
    } catch (err) {
      logger.error('AccessCode.getUsageStats error:', err);
      throw err;
    }
  },

  // ========== USER MANAGEMENT METHODS ==========

  async addUsers(access_code_id, users = []) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const addedUsers = [];
      const errors = [];

      for (const user of users) {
        try {
          const sql = `
            INSERT INTO access_code_users 
            (access_code_id, first_name, last_name, email, phone, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
            ON DUPLICATE KEY UPDATE 
              updated_at = CURRENT_TIMESTAMP,
              status = IF(status = 'cancelled', 'pending', status)
          `;
          
          const [result] = await conn.query(sql, [
            access_code_id,
            user.first_name,
            user.last_name,
            user.email || null,
            user.phone || null
          ]);

          if (result.affectedRows > 0) {
            addedUsers.push({
              id: result.insertId || 'existing',
              first_name: user.first_name,
              last_name: user.last_name
            });
          }
        } catch (err) {
          errors.push(`Failed to add user ${user.first_name} ${user.last_name}: ${err.message}`);
        }
      }

      await conn.commit();
      
      return {
        success: addedUsers.length > 0,
        added: addedUsers.length,
        users: addedUsers,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (err) {
      await conn.rollback();
      logger.error('AccessCode.addUsers error:', err);
      throw err;
    } finally {
      conn.release();
    }
  },

  async getUsers(access_code_id, filters = {}) {
    try {
      let sql = `
        SELECT 
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          registered_at,
          created_at,
          updated_at
        FROM access_code_users
        WHERE access_code_id = ?
      `;
      
      const params = [access_code_id];
      
      // Apply filters
      if (filters.status) {
        sql += ` AND status = ?`;
        params.push(filters.status);
      }
      
      if (filters.search) {
        sql += ` AND (
          first_name LIKE ? OR 
          last_name LIKE ? OR 
          email LIKE ? OR 
          phone LIKE ?
        )`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      // Ordering
      sql += ` ORDER BY `;
      if (filters.sortBy === 'name') {
        sql += `last_name, first_name`;
      } else if (filters.sortBy === 'registered_at') {
        sql += `registered_at DESC`;
      } else {
        sql += `created_at DESC`;
      }
      
      // Pagination
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(filters.limit, offset);
      }
      
      const [rows] = await db.query(sql, params);
      
      // Get count for pagination
      let countSql = `SELECT COUNT(*) as total FROM access_code_users WHERE access_code_id = ?`;
      const countParams = [access_code_id];
      
      if (filters.status) {
        countSql += ` AND status = ?`;
        countParams.push(filters.status);
      }
      
      const [countRows] = await db.query(countSql, countParams);
      const total = countRows[0]?.total || 0;
      
      return {
        users: rows,
        total,
        page: filters.page || 1,
        limit: filters.limit || rows.length,
        total_pages: filters.limit ? Math.ceil(total / filters.limit) : 1
      };
    } catch (err) {
      logger.error('AccessCode.getUsers error:', err);
      throw err;
    }
  },

  async updateUserStatus(user_id, status) {
    try {
      const validStatuses = ['pending', 'registered', 'completed', 'cancelled'];
      
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      
      const sql = `
        UPDATE access_code_users 
        SET status = ?, 
            registered_at = IF(status = 'registered' AND ? = 'registered', registered_at, 
                          IF(? = 'registered', CURRENT_TIMESTAMP, registered_at)),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      const [result] = await db.query(sql, [status, status, status, user_id]);
      return result.affectedRows;
    } catch (err) {
      logger.error('AccessCode.updateUserStatus error:', err);
      throw err;
    }
  },

  async removeUser(user_id) {
    try {
      const sql = `DELETE FROM access_code_users WHERE id = ?`;
      const [result] = await db.query(sql, [user_id]);
      return result.affectedRows;
    } catch (err) {
      logger.error('AccessCode.removeUser error:', err);
      throw err;
    }
  },

  async importUsers(access_code_id, users, options = {}) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const results = {
        total: users.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };

      for (const user of users) {
        try {
          // Validate required fields
          if (!user.first_name || !user.last_name) {
            results.errors.push(`Missing name for user: ${JSON.stringify(user)}`);
            results.skipped++;
            continue;
          }

          const sql = `
            INSERT INTO access_code_users 
            (access_code_id, first_name, last_name, email, phone, status)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
              email = COALESCE(VALUES(email), email),
              phone = COALESCE(VALUES(phone), phone),
              status = IF(VALUES(status) = 'pending' AND status != 'cancelled', status, VALUES(status)),
              updated_at = CURRENT_TIMESTAMP
          `;
          
          const [result] = await conn.query(sql, [
            access_code_id,
            user.first_name.trim(),
            user.last_name.trim(),
            user.email ? user.email.trim() : null,
            user.phone ? user.phone.trim() : null,
            user.status || 'pending'
          ]);

          if (result.affectedRows === 1) {
            if (result.insertId) {
              results.inserted++;
            } else {
              results.updated++;
            }
          }
        } catch (err) {
          results.errors.push(`Failed to import ${user.first_name} ${user.last_name}: ${err.message}`);
          results.skipped++;
        }
      }

      await conn.commit();
      return results;
    } catch (err) {
      await conn.rollback();
      logger.error('AccessCode.importUsers error:', err);
      throw err;
    } finally {
      conn.release();
    }
  },

  async canUserUseCode(access_code_id, first_name, last_name, email = null) {
    try {
      let sql = `
        SELECT id, status
        FROM access_code_users
        WHERE access_code_id = ? 
          AND first_name = ? 
          AND last_name = ?
      `;
      
      const params = [access_code_id, first_name.trim(), last_name.trim()];
      
      if (email) {
        sql += ` AND (email IS NULL OR email = ?)`;
        params.push(email.trim());
      }
      
      sql += ` LIMIT 1`;
      
      const [rows] = await db.query(sql, params);
      
      if (rows.length === 0) {
        return { allowed: false, reason: 'User not in access code list' };
      }
      
      const user = rows[0];
      
      if (user.status === 'cancelled') {
        return { allowed: false, reason: 'User access cancelled' };
      }
      
      if (user.status === 'registered') {
        return { allowed: false, reason: 'User already registered' };
      }
      
      return { 
        allowed: true, 
        user_id: user.id,
        status: user.status 
      };
    } catch (err) {
      logger.error('AccessCode.canUserUseCode error:', err);
      throw err;
    }
  },

  async getUserStats(access_code_id) {
    try {
      const sql = `
        SELECT 
          status,
          COUNT(*) as count,
          COUNT(CASE WHEN registered_at IS NOT NULL THEN 1 END) as registered_count,
          MIN(created_at) as first_added,
          MAX(created_at) as last_added
        FROM access_code_users
        WHERE access_code_id = ?
        GROUP BY status
      `;
      
      const [rows] = await db.query(sql, [access_code_id]);
      
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      const registered = rows.find(row => row.status === 'registered')?.count || 0;
      const pending = rows.find(row => row.status === 'pending')?.count || 0;
      const completed = rows.find(row => row.status === 'completed')?.count || 0;
      const cancelled = rows.find(row => row.status === 'cancelled')?.count || 0;
      
      return {
        total,
        by_status: rows,
        summary: {
          registered,
          pending,
          completed,
          cancelled
        },
        registration_rate: total > 0 ? Math.round((registered / total) * 100) : 0
      };
    } catch (err) {
      logger.error('AccessCode.getUserStats error:', err);
      throw err;
    }
  }
};

module.exports = AccessCode;