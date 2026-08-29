const db = require('../config/database');
const logger = require('../utils/logger');

const TalentRequest = {
  /**
   * Create a new talent request
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
        aboutYourself,
        talentNeeded,
        talentType,
        teamSize,
        budgetRange,
        timeline,
        workArrangement,
        experienceLevel,
        technologies,
        gdprConsent
      } = data;

      const [result] = await db.query(
        `INSERT INTO talent_requests (
          full_name, company_name, email, phone, job_title, company_size,
          about_yourself, talent_needed, talent_type, team_size, budget_range,
          timeline, work_arrangement, experience_level, technologies, gdpr_consent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullName,
          companyName,
          email,
          phone,
          jobTitle || null,
          companySize || null,
          aboutYourself,
          talentNeeded,
          talentType,
          teamSize || null,
          budgetRange,
          timeline,
          workArrangement || null,
          experienceLevel || null,
          technologies || null,
          gdprConsent ? 1 : 0
        ]
      );
      return result.insertId;
    } catch (err) {
      logger.error('TalentRequest.create error:', err);
      throw err;
    }
  },

  /**
   * Find talent request by ID
   */
  async findById(id) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM talent_requests WHERE id = ? LIMIT 1`,
        [id]
      );
      return rows[0] || null;
    } catch (err) {
      logger.error('TalentRequest.findById error:', err);
      throw err;
    }
  },

  /**
   * Get all talent requests with pagination and filtering
   */
  async getAll({ 
    page = 1, 
    limit = 100, 
    status = null, 
    talentType = null,
    budgetRange = null,
    timeline = null,
    search = null,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  }) {
    try {
      const offset = (page - 1) * limit;
      let query = `SELECT * FROM talent_requests`;
      const params = [];
      const conditions = [];

      if (status) {
        conditions.push(`status = ?`);
        params.push(status);
      }

      if (talentType) {
        conditions.push(`talent_type = ?`);
        params.push(talentType);
      }

      if (budgetRange) {
        conditions.push(`budget_range = ?`);
        params.push(budgetRange);
      }

      if (timeline) {
        conditions.push(`timeline = ?`);
        params.push(timeline);
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
      const allowedSortFields = ['created_at', 'updated_at', 'full_name', 'company_name', 'email', 'status', 'talent_type'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      query += ` ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await db.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM talent_requests`;
      const countParams = [];
      const countConditions = [];

      if (status) {
        countConditions.push(`status = ?`);
        countParams.push(status);
      }
      if (talentType) {
        countConditions.push(`talent_type = ?`);
        countParams.push(talentType);
      }
      if (budgetRange) {
        countConditions.push(`budget_range = ?`);
        countParams.push(budgetRange);
      }
      if (timeline) {
        countConditions.push(`timeline = ?`);
        countParams.push(timeline);
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
      logger.error('TalentRequest.getAll error:', err);
      throw err;
    }
  },

  /**
   * Update talent request status
   */
  async updateStatus(id, status) {
    try {
      const validStatuses = ['pending', 'reviewed', 'contacted', 'closed'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const [result] = await db.query(
        `UPDATE talent_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id]
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return await this.findById(id);
    } catch (err) {
      logger.error('TalentRequest.updateStatus error:', err);
      throw err;
    }
  },

  /**
   * Update talent request
   */
  async update(id, data) {
    try {
      const allowedFields = [
        'status', 'full_name', 'company_name', 'email', 'phone', 'job_title',
        'company_size', 'about_yourself', 'talent_needed', 'talent_type',
        'team_size', 'budget_range', 'timeline', 'work_arrangement',
        'experience_level', 'technologies'
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
        `UPDATE talent_requests SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return await this.findById(id);
    } catch (err) {
      logger.error('TalentRequest.update error:', err);
      throw err;
    }
  },

  /**
   * Delete talent request
   */
  async delete(id) {
    try {
      const [result] = await db.query(
        `DELETE FROM talent_requests WHERE id = ?`,
        [id]
      );
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('TalentRequest.delete error:', err);
      throw err;
    }
  },

  /**
   * Get statistics
   */
  async getStats() {
    try {
      const [total] = await db.query(`SELECT COUNT(*) as total FROM talent_requests`);
      const [byStatus] = await db.query(
        `SELECT status, COUNT(*) as count FROM talent_requests GROUP BY status`
      );
      const [byTalentType] = await db.query(
        `SELECT talent_type, COUNT(*) as count FROM talent_requests GROUP BY talent_type`
      );
      const [byBudgetRange] = await db.query(
        `SELECT budget_range, COUNT(*) as count FROM talent_requests GROUP BY budget_range`
      );
      const [recentCount] = await db.query(
        `SELECT COUNT(*) as count FROM talent_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      );
      const [monthlyCount] = await db.query(
        `SELECT COUNT(*) as count FROM talent_requests WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );

      return {
        total: total[0].total,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {}),
        byTalentType: byTalentType.reduce((acc, item) => {
          acc[item.talent_type] = item.count;
          return acc;
        }, {}),
        byBudgetRange: byBudgetRange.reduce((acc, item) => {
          acc[item.budget_range] = item.count;
          return acc;
        }, {}),
        recent: {
          last7Days: recentCount[0].count,
          last30Days: monthlyCount[0].count
        }
      };
    } catch (err) {
      logger.error('TalentRequest.getStats error:', err);
      throw err;
    }
  }
};

module.exports = TalentRequest;

