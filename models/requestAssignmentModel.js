const db = require('../config/database');
const logger = require('../utils/logger');

const RequestAssignment = {
  /**
   * Create a new assignment
   */
  async create(data) {
    try {
      const {
        requestType,
        requestId,
        talentPoolId,
        assignedBy = null,
        assignmentStatus = 'pending',
        notes = null,
        interviewDate = null
      } = data;

      // Validate request type
      if (!['talent', 'project'].includes(requestType)) {
        throw new Error('Invalid request type. Must be "talent" or "project"');
      }

      // Check if assignment already exists (non-deleted)
      const existing = await this.findByRequestAndTalent(requestType, requestId, talentPoolId);
      if (existing && !existing.deleted_at) {
        throw new Error('Assignment already exists for this request and talent');
      }

      const [result] = await db.query(
        `INSERT INTO request_assignments (
          request_type, request_id, talent_pool_id, assigned_by,
          assignment_status, notes, interview_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [requestType, requestId, talentPoolId, assignedBy, assignmentStatus, notes, interviewDate]
      );

      return await this.findById(result.insertId);
    } catch (err) {
      logger.error('RequestAssignment.create error:', err);
      throw err;
    }
  },

  /**
   * Find assignment by ID
   */
  async findById(id) {
    try {
      const [rows] = await db.query(
        `SELECT 
          ra.*,
          tpr.full_name as talent_name,
          tpr.email as talent_email,
          tpr.phone_number as talent_phone,
          tpr.skills as talent_skills,
          tpr.cv_file_path as talent_cv,
          tpr.years_experience as talent_experience,
          tpr.education_level as talent_education
        FROM request_assignments ra
        LEFT JOIN talent_pool_registration tpr ON ra.talent_pool_id = tpr.id
        WHERE ra.id = ? AND ra.deleted_at IS NULL
        LIMIT 1`,
        [id]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('RequestAssignment.findById error:', err);
      throw err;
    }
  },

  /**
   * Find assignment by request and talent
   */
  async findByRequestAndTalent(requestType, requestId, talentPoolId) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM request_assignments 
        WHERE request_type = ? AND request_id = ? AND talent_pool_id = ?
        ORDER BY assigned_at DESC
        LIMIT 1`,
        [requestType, requestId, talentPoolId]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('RequestAssignment.findByRequestAndTalent error:', err);
      throw err;
    }
  },

  /**
   * Get all assignments for a specific request
   */
  async getByRequest(requestType, requestId, options = {}) {
    try {
      const {
        status = null,
        includeDeleted = false
      } = options;

      let query = `
        SELECT 
          ra.*,
          tpr.full_name as talent_name,
          tpr.email as talent_email,
          tpr.phone_number as talent_phone,
          tpr.skills as talent_skills,
          tpr.cv_file_path as talent_cv,
          tpr.years_experience as talent_experience,
          tpr.education_level as talent_education,
          tpr.country as talent_country,
          tpr.city as talent_city
        FROM request_assignments ra
        LEFT JOIN talent_pool_registration tpr ON ra.talent_pool_id = tpr.id
        WHERE ra.request_type = ? AND ra.request_id = ?
      `;

      const params = [requestType, requestId];

      if (!includeDeleted) {
        query += ` AND ra.deleted_at IS NULL`;
      }

      if (status) {
        query += ` AND ra.assignment_status = ?`;
        params.push(status);
      }

      query += ` ORDER BY ra.assigned_at DESC`;

      const [rows] = await db.query(query, params);
      return rows;
    } catch (err) {
      logger.error('RequestAssignment.getByRequest error:', err);
      throw err;
    }
  },

  /**
   * Get all assignments for a specific talent
   */
  async getByTalent(talentPoolId, options = {}) {
    try {
      const {
        status = null,
        requestType = null,
        includeDeleted = false
      } = options;

      let query = `
        SELECT 
          ra.*,
          CASE 
            WHEN ra.request_type = 'talent' THEN tr.full_name
            WHEN ra.request_type = 'project' THEN pr.full_name
          END as client_name,
          CASE 
            WHEN ra.request_type = 'talent' THEN tr.company_name
            WHEN ra.request_type = 'project' THEN pr.company_name
          END as client_company,
          CASE 
            WHEN ra.request_type = 'talent' THEN tr.talent_type
            WHEN ra.request_type = 'project' THEN pr.project_type
          END as request_type_detail
        FROM request_assignments ra
        LEFT JOIN talent_requests tr ON ra.request_type = 'talent' AND ra.request_id = tr.id
        LEFT JOIN project_requests pr ON ra.request_type = 'project' AND ra.request_id = pr.id
        WHERE ra.talent_pool_id = ?
      `;

      const params = [talentPoolId];

      if (!includeDeleted) {
        query += ` AND ra.deleted_at IS NULL`;
      }

      if (status) {
        query += ` AND ra.assignment_status = ?`;
        params.push(status);
      }

      if (requestType) {
        query += ` AND ra.request_type = ?`;
        params.push(requestType);
      }

      query += ` ORDER BY ra.assigned_at DESC`;

      const [rows] = await db.query(query, params);
      return rows;
    } catch (err) {
      logger.error('RequestAssignment.getByTalent error:', err);
      throw err;
    }
  },

  /**
   * Get all assignments with pagination and filtering
   */
  async getAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        requestType = null,
        requestId = null,
        talentPoolId = null,
        status = null,
        assignedBy = null,
        search = null,
        sortBy = 'assigned_at',
        sortOrder = 'DESC',
        includeDeleted = false
      } = options;

      const offset = (page - 1) * limit;
      let query = `
        SELECT 
          ra.*,
          tpr.full_name as talent_name,
          tpr.email as talent_email,
          tpr.phone_number as talent_phone,
          tpr.skills as talent_skills,
          tpr.cv_file_path as talent_cv,
          CASE 
            WHEN ra.request_type = 'talent' THEN tr.full_name
            WHEN ra.request_type = 'project' THEN pr.full_name
          END as client_name,
          CASE 
            WHEN ra.request_type = 'talent' THEN tr.company_name
            WHEN ra.request_type = 'project' THEN pr.company_name
          END as client_company
        FROM request_assignments ra
        LEFT JOIN talent_pool_registration tpr ON ra.talent_pool_id = tpr.id
        LEFT JOIN talent_requests tr ON ra.request_type = 'talent' AND ra.request_id = tr.id
        LEFT JOIN project_requests pr ON ra.request_type = 'project' AND ra.request_id = pr.id
        WHERE 1=1
      `;

      const params = [];

      if (!includeDeleted) {
        query += ` AND ra.deleted_at IS NULL`;
      }

      if (requestType) {
        query += ` AND ra.request_type = ?`;
        params.push(requestType);
      }

      if (requestId) {
        query += ` AND ra.request_id = ?`;
        params.push(requestId);
      }

      if (talentPoolId) {
        query += ` AND ra.talent_pool_id = ?`;
        params.push(talentPoolId);
      }

      if (status) {
        query += ` AND ra.assignment_status = ?`;
        params.push(status);
      }

      if (assignedBy) {
        query += ` AND ra.assigned_by = ?`;
        params.push(assignedBy);
      }

      if (search) {
        query += ` AND (
          tpr.full_name LIKE ? OR 
          tpr.email LIKE ? OR
          tpr.phone_number LIKE ? OR
          COALESCE(tr.full_name, pr.full_name) LIKE ? OR
          COALESCE(tr.company_name, pr.company_name) LIKE ?
        )`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Validate sortBy to prevent SQL injection
      const allowedSortFields = ['assigned_at', 'updated_at', 'assignment_status', 'interview_date'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'assigned_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      query += ` ORDER BY ra.${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM request_assignments ra WHERE 1=1`;
      const countParams = [];

      if (!includeDeleted) {
        countQuery += ` AND ra.deleted_at IS NULL`;
      }

      if (requestType) {
        countQuery += ` AND ra.request_type = ?`;
        countParams.push(requestType);
      }
      if (requestId) {
        countQuery += ` AND ra.request_id = ?`;
        countParams.push(requestId);
      }
      if (talentPoolId) {
        countQuery += ` AND ra.talent_pool_id = ?`;
        countParams.push(talentPoolId);
      }
      if (status) {
        countQuery += ` AND ra.assignment_status = ?`;
        countParams.push(status);
      }
      if (assignedBy) {
        countQuery += ` AND ra.assigned_by = ?`;
        countParams.push(assignedBy);
      }
      if (search) {
        countQuery += ` AND (
          EXISTS (
            SELECT 1 FROM talent_pool_registration tpr 
            WHERE tpr.id = ra.talent_pool_id 
            AND (tpr.full_name LIKE ? OR tpr.email LIKE ? OR tpr.phone_number LIKE ?)
          ) OR
          EXISTS (
            SELECT 1 FROM talent_requests tr 
            WHERE tr.id = ra.request_id AND ra.request_type = 'talent'
            AND (tr.full_name LIKE ? OR tr.company_name LIKE ?)
          ) OR
          EXISTS (
            SELECT 1 FROM project_requests pr 
            WHERE pr.id = ra.request_id AND ra.request_type = 'project'
            AND (pr.full_name LIKE ? OR pr.company_name LIKE ?)
          )
        )`;
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const [count] = await db.query(countQuery, countParams);

      return {
        assignments: rows,
        total: count[0].total,
        page,
        limit,
        totalPages: Math.ceil(count[0].total / limit)
      };
    } catch (err) {
      logger.error('RequestAssignment.getAll error:', err);
      throw err;
    }
  },

  /**
   * Update assignment
   */
  async update(id, data) {
    try {
      const allowedFields = [
        'assignment_status',
        'notes',
        'client_feedback',
        'talent_feedback',
        'interview_date'
      ];

      const updates = [];
      const params = [];

      for (const [key, value] of Object.entries(data)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      }

      if (updates.length === 0) {
        return await this.findById(id);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const [result] = await db.query(
        `UPDATE request_assignments SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
        params
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return await this.findById(id);
    } catch (err) {
      logger.error('RequestAssignment.update error:', err);
      throw err;
    }
  },

  /**
   * Update assignment status
   */
  async updateStatus(id, status) {
    try {
      const validStatuses = ['pending', 'contacted', 'interviewed', 'accepted', 'rejected', 'withdrawn'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const [result] = await db.query(
        `UPDATE request_assignments 
        SET assignment_status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND deleted_at IS NULL`,
        [status, id]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return await this.findById(id);
    } catch (err) {
      logger.error('RequestAssignment.updateStatus error:', err);
      throw err;
    }
  },

  /**
   * Soft delete assignment
   */
  async delete(id) {
    try {
      const [result] = await db.query(
        `UPDATE request_assignments 
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND deleted_at IS NULL`,
        [id]
      );
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('RequestAssignment.delete error:', err);
      throw err;
    }
  },

  /**
   * Get statistics
   */
  async getStats(options = {}) {
    try {
      const {
        requestType = null,
        requestId = null
      } = options;

      let whereClause = 'WHERE deleted_at IS NULL';
      const params = [];

      if (requestType) {
        whereClause += ` AND request_type = ?`;
        params.push(requestType);
      }

      if (requestId) {
        whereClause += ` AND request_id = ?`;
        params.push(requestId);
      }

      const [total] = await db.query(
        `SELECT COUNT(*) as total FROM request_assignments ${whereClause}`,
        params
      );

      const [byStatus] = await db.query(
        `SELECT assignment_status, COUNT(*) as count 
        FROM request_assignments 
        ${whereClause}
        GROUP BY assignment_status`,
        params
      );

      const [byRequestType] = await db.query(
        `SELECT request_type, COUNT(*) as count 
        FROM request_assignments 
        ${whereClause}
        GROUP BY request_type`,
        params
      );

      const [recentCount] = await db.query(
        `SELECT COUNT(*) as count 
        FROM request_assignments 
        ${whereClause} AND assigned_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        params
      );

      const [monthlyCount] = await db.query(
        `SELECT COUNT(*) as count 
        FROM request_assignments 
        ${whereClause} AND assigned_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        params
      );

      return {
        total: total[0].total,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.assignment_status] = item.count;
          return acc;
        }, {}),
        byRequestType: byRequestType.reduce((acc, item) => {
          acc[item.request_type] = item.count;
          return acc;
        }, {}),
        recent: {
          last7Days: recentCount[0].count,
          last30Days: monthlyCount[0].count
        }
      };
    } catch (err) {
      logger.error('RequestAssignment.getStats error:', err);
      throw err;
    }
  }
};

module.exports = RequestAssignment;

