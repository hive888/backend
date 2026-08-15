const db = require('../config/database');
const logger = require('../utils/logger');

const ProjectRequest = {
  /**
   * Create a new project request
   */
  async create(data) {
    try {
      const {
        fullName,
        companyName,
        email,
        phone,
        jobTitle,
        companySize,
        projectDetails,
        projectType,
        projectBudget,
        projectTimeline,
        projectStage,
        projectTechnologies,
        gdprConsent
      } = data;

      const [result] = await db.query(
        `INSERT INTO project_requests (
          full_name, company_name, email, phone, job_title, company_size,
          project_details, project_type, project_budget, project_timeline,
          project_stage, project_technologies, gdpr_consent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullName,
          companyName,
          email,
          phone,
          jobTitle || null,
          companySize || null,
          projectDetails,
          projectType,
          projectBudget,
          projectTimeline,
          projectStage || null,
          projectTechnologies || null,
          gdprConsent
        ]
      );
      return result.insertId;
    } catch (err) {
      logger.error('ProjectRequest.create error:', err);
      throw err;
    }
  },

  /**
   * Find project request by ID
   */
  async findById(id) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM project_requests WHERE id = ? LIMIT 1`,
        [id]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('ProjectRequest.findById error:', err);
      throw err;
    }
  },

  /**
   * Get all project requests with pagination and filtering
   */
  async getAll({ 
    page = 1, 
    limit = 100, 
    status = null, 
    projectType = null,
    projectBudget = null,
    projectTimeline = null,
    search = null,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  }) {
    try {
      const offset = (page - 1) * limit;
      let query = `SELECT * FROM project_requests`;
      const params = [];
      const conditions = [];

      if (status) {
        conditions.push(`status = ?`);
        params.push(status);
      }

      if (projectType) {
        conditions.push(`project_type = ?`);
        params.push(projectType);
      }

      if (projectBudget) {
        conditions.push(`project_budget = ?`);
        params.push(projectBudget);
      }

      if (projectTimeline) {
        conditions.push(`project_timeline = ?`);
        params.push(projectTimeline);
      }

      if (search) {
        conditions.push(`(
          full_name LIKE ? OR 
          company_name LIKE ? OR 
          email LIKE ? OR 
          phone LIKE ?
        )`);
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // Validate sortBy to prevent SQL injection
      const allowedSortFields = ['created_at', 'updated_at', 'full_name', 'company_name', 'email', 'status', 'project_type'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      query += ` ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM project_requests`;
      const countParams = [];
      const countConditions = [];

      if (status) {
        countConditions.push(`status = ?`);
        countParams.push(status);
      }
      if (projectType) {
        countConditions.push(`project_type = ?`);
        countParams.push(projectType);
      }
      if (projectBudget) {
        countConditions.push(`project_budget = ?`);
        countParams.push(projectBudget);
      }
      if (projectTimeline) {
        countConditions.push(`project_timeline = ?`);
        countParams.push(projectTimeline);
      }
      if (search) {
        countConditions.push(`(
          full_name LIKE ? OR 
          company_name LIKE ? OR 
          email LIKE ? OR 
          phone LIKE ?
        )`);
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (countConditions.length > 0) {
        countQuery += ` WHERE ${countConditions.join(' AND ')}`;
      }

      const [count] = await db.query(countQuery, countParams);

      return {
        requests: rows,
        total: count[0].total,
        page,
        limit,
        totalPages: Math.ceil(count[0].total / limit)
      };
    } catch (err) {
      logger.error('ProjectRequest.getAll error:', err);
      throw err;
    }
  },

  /**
   * Update project request status
   */
  async updateStatus(id, status) {
    try {
      const validStatuses = ['pending', 'reviewed', 'contacted', 'closed'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const [result] = await db.query(
        `UPDATE project_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return await this.findById(id);
    } catch (err) {
      logger.error('ProjectRequest.updateStatus error:', err);
      throw err;
    }
  },

  /**
   * Update project request
   */
  async update(id, data) {
    try {
      const allowedFields = [
        'status', 'full_name', 'company_name', 'email', 'phone', 'job_title',
        'company_size', 'project_details', 'project_type', 'project_budget',
        'project_timeline', 'project_stage', 'project_technologies'
      ];

      const updates = [];
      const params = [];

      for (const [key, value] of Object.entries(data)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(dbKey) && value !== undefined) {
          updates.push(`${dbKey} = ?`);
          params.push(value);
        }
      }

      if (updates.length === 0) {
        return await this.findById(id);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const [result] = await db.query(
        `UPDATE project_requests SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return await this.findById(id);
    } catch (err) {
      logger.error('ProjectRequest.update error:', err);
      throw err;
    }
  },

  /**
   * Delete project request
   */
  async delete(id) {
    try {
      const [result] = await db.query(
        `DELETE FROM project_requests WHERE id = ?`,
        [id]
      );
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('ProjectRequest.delete error:', err);
      throw err;
    }
  },

  /**
   * Get statistics
   */
  async getStats() {
    try {
      const [total] = await db.query(`SELECT COUNT(*) as total FROM project_requests`);
      const [byStatus] = await db.query(
        `SELECT status, COUNT(*) as count FROM project_requests GROUP BY status`
      );
      const [byProjectType] = await db.query(
        `SELECT project_type, COUNT(*) as count FROM project_requests GROUP BY project_type`
      );
      const [byBudget] = await db.query(
        `SELECT project_budget, COUNT(*) as count FROM project_requests GROUP BY project_budget`
      );
      const [recentCount] = await db.query(
        `SELECT COUNT(*) as count FROM project_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      );
      const [monthlyCount] = await db.query(
        `SELECT COUNT(*) as count FROM project_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );

      return {
        total: total[0].total,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        byProjectType: byProjectType.reduce((acc, item) => {
          acc[item.project_type] = item.count;
          return acc;
        }, {}),
        byBudget: byBudget.reduce((acc, item) => {
          acc[item.project_budget] = item.count;
          return acc;
        }, {}),
        recent: {
          last7Days: recentCount[0].count,
          last30Days: monthlyCount[0].count
        }
      };
    } catch (err) {
      logger.error('ProjectRequest.getStats error:', err);
      throw err;
    }
  }
};

module.exports = ProjectRequest;

