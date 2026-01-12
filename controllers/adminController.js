const db = require('../config/database');
const logger = require('../utils/logger');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Contest = require('../models/Contest');
const ContestRegistration = require('../models/ContestRegistration');
const TalentPoolRegistration = require('../models/talentPoolModel');
const AccessCode = require('../models/accessCodeModel');

/**
 * Admin Dashboard Controller
 * Provides comprehensive admin functionality for managing the PTGR HUB platform
 */

const adminController = {
  /**
   * Get Dashboard Overview Statistics
   * GET /api/admin/dashboard
   */
  async getDashboardStats(req, res) {
    try {
      // Execute all queries in parallel for better performance
      const [
        customerStats,
        userStats,
        contestStats,
        talentPoolStats,
        recentActivity
      ] = await Promise.all([
        // Customer Statistics
        db.query(`
          SELECT
            COUNT(*) AS total_customers,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_customers,
            SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_customers,
            SUM(CASE WHEN is_email_verified = 1 THEN 1 ELSE 0 END) AS email_verified,
            SUM(CASE WHEN is_phone_verified = 1 THEN 1 ELSE 0 END) AS phone_verified,
            SUM(CASE WHEN is_kyc_verified = 1 THEN 1 ELSE 0 END) AS kyc_verified,
            SUM(CASE WHEN customer_type = 'individual' THEN 1 ELSE 0 END) AS individual,
            SUM(CASE WHEN customer_type = 'enterprise' THEN 1 ELSE 0 END) AS enterprise,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_today,
            SUM(CASE WHEN YEARWEEK(created_at) = YEARWEEK(CURDATE()) THEN 1 ELSE 0 END) AS new_this_week,
            SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) AS new_this_month
          FROM customers
          WHERE deleted_at IS NULL
        `),
        // User Statistics
        db.query(`
          SELECT
            COUNT(*) AS total_users,
            COUNT(DISTINCT customer_id) AS users_with_customers,
            SUM(CASE WHEN auth_provider = 'local' THEN 1 ELSE 0 END) AS local_auth,
            SUM(CASE WHEN auth_provider = 'google' THEN 1 ELSE 0 END) AS google_auth
          FROM users
        `),
        // Contest Statistics
        db.query(`
          SELECT
            COUNT(DISTINCT c.id) AS total_contests,
            COUNT(DISTINCT cr.registration_id) AS total_registrations,
            COUNT(DISTINCT cr.customer_id) AS unique_participants,
            SUM(CASE WHEN DATE(c.created_at) = CURDATE() THEN 1 ELSE 0 END) AS contests_created_today
          FROM contests c
          LEFT JOIN contest_registrations cr ON c.id = cr.contest_id
        `),
        // Talent Pool Statistics
        db.query(`
          SELECT
            COUNT(*) AS total_registrations,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_today
          FROM talent_pool_registration
        `),
        // Recent Activity (last 10 customer registrations)
        db.query(`
          SELECT
            customer_id,
            first_name,
            last_name,
            email,
            customer_type,
            created_at
          FROM customers
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 10
        `)
      ]);

      // Customer trend data (last 7 days)
      const [customerTrends] = await db.query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS count
        FROM customers
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          AND deleted_at IS NULL
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      // Revenue trend (empty since orders are removed)
      const revenueTrends = [];

      // Format trend data
      const formatTrendData = (data, days, defaultValue = 0) => {
        const result = { labels: [], data: [] };
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          result.labels.push(dateStr);
          const dayData = data.find(d => d.date?.toISOString().split('T')[0] === dateStr);
          result.data.push(dayData ? (dayData.count || dayData.amount || defaultValue) : defaultValue);
        }
        return result;
      };

      return res.status(200).json({
        success: true,
        data: {
          overview: {
            customers: customerStats[0][0] || {},
            users: userStats[0][0] || {},
            contests: contestStats[0][0] || {},
            talent_pool: talentPoolStats[0][0] || {}
          },
          trends: {
            customers: formatTrendData(customerTrends, 7),
            revenue: { labels: [], data: [] }
          },
          recent_activity: {
            new_customers: recentActivity[0] || []
          }
        }
      });
    } catch (err) {
      logger.error('Admin dashboard stats error', {
        error: err.message,
        stack: err.stack
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard statistics',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Customers List with Advanced Filtering
   * GET /api/admin/customers
   */
  async getCustomers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        customer_type = '',
        is_active = '',
        is_kyc_verified = '',
        is_email_verified = '',
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = `
        SELECT
          customer_id,
          first_name,
          last_name,
          email,
          phone,
          customer_type,
          is_active,
          is_email_verified,
          is_phone_verified,
          is_kyc_verified,
          profile_picture,
          created_at,
          updated_at
        FROM customers
        WHERE deleted_at IS NULL
      `;
      const params = [];

      // Build WHERE clause
      if (search) {
        query += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (customer_type) {
        query += ` AND customer_type = ?`;
        params.push(customer_type);
      }

      if (is_active !== '') {
        query += ` AND is_active = ?`;
        params.push(is_active === 'true' ? 1 : 0);
      }

      if (is_kyc_verified !== '') {
        query += ` AND is_kyc_verified = ?`;
        params.push(is_kyc_verified === 'true' ? 1 : 0);
      }

      if (is_email_verified !== '') {
        query += ` AND is_email_verified = ?`;
        params.push(is_email_verified === 'true' ? 1 : 0);
      }

      // Count total
      const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) AS total FROM');
      const [countResult] = await db.query(countQuery, params);
      const total = countResult[0]?.total || 0;

      // Add sorting and pagination
      const allowedSortFields = ['created_at', 'updated_at', 'first_name', 'last_name', 'email'];
      const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
      const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      query += ` ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);

      const [customers] = await db.query(query, params);

      return res.status(200).json({
        success: true,
        data: {
          customers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (err) {
      logger.error('Admin get customers error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve customers',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Single Customer Details (Admin View)
   * GET /api/admin/customers/:id
   */
  async getCustomerDetails(req, res) {
    try {
      const { id } = req.params;
      const customer = await Customer.findById(id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      // Get additional customer data
      const [user] = await db.query(
        'SELECT * FROM users WHERE customer_id = ?',
        [id]
      );

      const [contestRegistrations] = await db.query(`
        SELECT cr.*, c.slug, c.description
        FROM contest_registrations cr
        JOIN contests c ON cr.contest_id = c.id
        WHERE cr.customer_id = ?
        ORDER BY cr.registered_at DESC
      `, [id]);

      return res.status(200).json({
        success: true,
        data: {
          customer,
          user: user[0] || null,
          contest_registrations: contestRegistrations || []
        }
      });
    } catch (err) {
      logger.error('Admin get customer details error', {
        error: err.message,
        customerId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer details',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update Customer (Admin) - Comprehensive Update
   * PUT /api/admin/customers/:id
   */
  async updateCustomer(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body || {};

      // Remove fields that shouldn't be updated directly
      delete updateData.customer_id;
      delete updateData.created_at;

      const customer = await Customer.findById(id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      // Update customer basic information
      const allowedFields = [
        'first_name', 'last_name', 'email', 'phone', 'customer_type',
        'is_active', 'is_email_verified', 'is_phone_verified', 
        'is_kyc_verified', 'profile_picture', 'date_of_birth', 'gender'
      ];

      const customerUpdate = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          // Format date_of_birth to YYYY-MM-DD if it's provided
          if (key === 'date_of_birth' && updateData[key]) {
            const dateValue = updateData[key];
            // If it's an ISO date string, extract just the date part
            if (typeof dateValue === 'string' && dateValue.includes('T')) {
              customerUpdate[key] = dateValue.split('T')[0];
            } else if (dateValue instanceof Date) {
              customerUpdate[key] = dateValue.toISOString().split('T')[0];
            } else {
              // Already in YYYY-MM-DD format or empty string
              customerUpdate[key] = dateValue;
            }
          } else {
            customerUpdate[key] = updateData[key];
          }
        }
      });

      if (Object.keys(customerUpdate).length > 0) {
        await Customer.update(id, customerUpdate);
      }

      // Get updated customer data
      const updated = await Customer.findById(id);

      logger.info('Admin updated customer', {
        adminId: req.user.user_id,
        customerId: id,
        updates: Object.keys(customerUpdate)
      });

      return res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: updated
      });
    } catch (err) {
      logger.error('Admin update customer error', {
        error: err.message,
        customerId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to update customer',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Delete Customer (Admin)
   * DELETE /api/admin/customers/:id
   */
  async deleteCustomer(req, res) {
    try {
      const { id } = req.params;
      const customer = await Customer.findById(id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        });
      }

      await Customer.softDelete(id);

      logger.info('Admin deleted customer', {
        adminId: req.user.user_id,
        customerId: id
      });

      return res.status(200).json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (err) {
      logger.error('Admin delete customer error', {
        error: err.message,
        customerId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete customer',
        code: 'SERVER_ERROR'
      });
    }
  },


  /**
   * Get Talent Pool Registrations
   * GET /api/admin/talent-pool
   */
  async getTalentPoolRegistrations(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status = '',
        country = '',
        search = ''
      } = req.query;

      const filters = {
        status: status || undefined,
        country: country || undefined,
        search: search || undefined
      };

      const registrations = await TalentPoolRegistration.getByFilters(filters);
      const total = registrations.length;

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const paginatedRegistrations = registrations.slice(offset, offset + parseInt(limit));

      return res.status(200).json({
        success: true,
        data: {
          registrations: paginatedRegistrations,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (err) {
      logger.error('Admin get talent pool registrations error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve talent pool registrations',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update Talent Pool Registration Status
   * PATCH /api/admin/talent-pool/:id/status
   */
  async updateTalentPoolStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: pending, approved, or rejected',
          code: 'VALIDATION_ERROR'
        });
      }

      const registration = await TalentPoolRegistration.findById(id);
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found',
          code: 'NOT_FOUND'
        });
      }

      await TalentPoolRegistration.updateStatus(id, status);

      logger.info('Admin updated talent pool status', {
        adminId: req.user.user_id,
        registrationId: id,
        newStatus: status
      });

      return res.status(200).json({
        success: true,
        message: 'Registration status updated successfully'
      });
    } catch (err) {
      logger.error('Admin update talent pool status error', {
        error: err.message,
        registrationId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to update registration status',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Talent Pool Statistics
   * GET /api/admin/talent-pool/stats
   */
  async getTalentPoolStats(req, res) {
    try {
      const stats = await TalentPoolRegistration.getStats();
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err) {
      logger.error('Admin get talent pool stats error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve talent pool statistics',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Contests List
   * GET /api/admin/contests
   */
  async getContests(req, res) {
    try {
      const contests = await Contest.listAll();

      // Get registration counts for each contest
      const contestsWithStats = await Promise.all(
        contests.map(async (contest) => {
          const [registrations] = await db.query(
            'SELECT COUNT(*) AS total FROM contest_registrations WHERE contest_id = ?',
            [contest.id]
          );
          return {
            ...contest,
            registration_count: registrations[0]?.total || 0
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: contestsWithStats
      });
    } catch (err) {
      logger.error('Admin get contests error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve contests',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Contest Details with Registrations
   * GET /api/admin/contests/:id
   */
  async getContestDetails(req, res) {
    try {
      const { id } = req.params;
      const contest = await Contest.findById(id);

      if (!contest) {
        return res.status(404).json({
          success: false,
          error: 'Contest not found',
          code: 'CONTEST_NOT_FOUND'
        });
      }

      const [registrations] = await db.query(`
        SELECT
          cr.*,
          c.first_name,
          c.last_name,
          c.email
        FROM contest_registrations cr
        JOIN customers c ON cr.customer_id = c.customer_id
        WHERE cr.contest_id = ?
        ORDER BY cr.registered_at DESC
      `, [id]);

      return res.status(200).json({
        success: true,
        data: {
          contest,
          registrations: registrations || []
        }
      });
    } catch (err) {
      logger.error('Admin get contest details error', {
        error: err.message,
        contestId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve contest details',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Analytics Report
   * GET /api/admin/analytics
   */
  async getAnalytics(req, res) {
    try {
      const { period = '30' } = req.query; // days
      const periodDays = parseInt(period);

      // Customer growth analytics
      const [customerGrowth] = await db.query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS count,
          SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) AS cumulative
        FROM customers
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND deleted_at IS NULL
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [periodDays]);

      // Revenue analytics (removed - orders functionality disabled)
      const revenueAnalytics = [];

      // Customer type distribution
      const [customerTypes] = await db.query(`
        SELECT
          customer_type,
          COUNT(*) AS count
        FROM customers
        WHERE deleted_at IS NULL
        GROUP BY customer_type
      `);

      // Top countries (from talent pool)
      const [topCountries] = await db.query(`
        SELECT
          country,
          COUNT(*) AS count
        FROM talent_pool_registration
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `);

      return res.status(200).json({
        success: true,
        data: {
          period_days: periodDays,
          customer_growth: customerGrowth || [],
          revenue_analytics: revenueAnalytics || [],
          customer_type_distribution: customerTypes || [],
          top_countries: topCountries || []
        }
      });
    } catch (err) {
      logger.error('Admin get analytics error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Access Codes List
   * GET /api/admin/access-codes
   */
  async getAccessCodes(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status = '',
        search = ''
      } = req.query;

      let query = `
        SELECT
          ac.*,
          COUNT(acu.id) AS total_users,
          SUM(CASE WHEN acu.status = 'registered' THEN 1 ELSE 0 END) AS registered_users,
          SUM(CASE WHEN acu.status = 'completed' THEN 1 ELSE 0 END) AS completed_users
        FROM access_codes ac
        LEFT JOIN access_code_users acu ON ac.id = acu.access_code_id
        WHERE 1=1
      `;
      const params = [];

      if (status === 'active') {
        query += ` AND ac.is_active = 1 AND (ac.expires_at IS NULL OR ac.expires_at >= NOW())`;
      } else if (status === 'inactive') {
        query += ` AND ac.is_active = 0`;
      } else if (status === 'expired') {
        query += ` AND ac.expires_at < NOW()`;
      }

      if (search) {
        query += ` AND (ac.code LIKE ? OR ac.university_name LIKE ?)`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ` GROUP BY ac.id ORDER BY ac.created_at DESC`;

      // Get total count
      const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(DISTINCT ac.id) AS total FROM');
      const [countResult] = await db.query(countQuery.replace(/GROUP BY[\s\S]*$/, ''), params);
      const total = countResult[0]?.total || 0;

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);

      const [accessCodes] = await db.query(query, params);

      return res.status(200).json({
        success: true,
        data: {
          access_codes: accessCodes || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (err) {
      logger.error('Admin get access codes error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve access codes',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Access Code Details
   * GET /api/admin/access-codes/:id
   */
  async getAccessCodeDetails(req, res) {
    try {
      const { id } = req.params;
      const accessCode = await AccessCode.getById(id);

      if (!accessCode) {
        return res.status(404).json({
          success: false,
          error: 'Access code not found',
          code: 'ACCESS_CODE_NOT_FOUND'
        });
      }

      // Get user statistics
      const stats = await AccessCode.getUserStats(id);

      // Get users associated with this code
      // Note: access_code_users table stores user info directly, not via customer_id
      const [users] = await db.query(`
        SELECT
          acu.*
        FROM access_code_users acu
        WHERE acu.access_code_id = ?
        ORDER BY acu.created_at DESC
      `, [id]);

      return res.status(200).json({
        success: true,
        data: {
          access_code: accessCode,
          statistics: stats,
          users: users || []
        }
      });
    } catch (err) {
      logger.error('Admin get access code details error', {
        error: err.message,
        accessCodeId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve access code details',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Create Access Code
   * POST /api/admin/access-codes
   */
  async createAccessCode(req, res) {
    try {
      const {
        code,
        university_name,
        total_students,
        max_uses,
        is_active = true,
        expires_at,
        notes
      } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Access code is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const accessCodeId = await AccessCode.create({
        code: code.toUpperCase().trim(),
        university_name,
        total_students,
        max_uses,
        is_active,
        expires_at,
        notes,
        created_by: req.user.user_id
      });

      logger.info('Admin created access code', {
        adminId: req.user.user_id,
        accessCodeId,
        code: code.toUpperCase().trim()
      });

      return res.status(201).json({
        success: true,
        message: 'Access code created successfully',
        data: { id: accessCodeId }
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: 'Access code already exists',
          code: 'DUPLICATE_ENTRY'
        });
      }
      logger.error('Admin create access code error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to create access code',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update Access Code
   * PUT /api/admin/access-codes/:id
   */
  async updateAccessCode(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const accessCode = await AccessCode.getById(id);
      if (!accessCode) {
        return res.status(404).json({
          success: false,
          error: 'Access code not found',
          code: 'ACCESS_CODE_NOT_FOUND'
        });
      }

      if (updateData.code) {
        updateData.code = updateData.code.toUpperCase().trim();
      }

      await AccessCode.update(id, updateData);

      logger.info('Admin updated access code', {
        adminId: req.user.user_id,
        accessCodeId: id
      });

      return res.status(200).json({
        success: true,
        message: 'Access code updated successfully'
      });
    } catch (err) {
      logger.error('Admin update access code error', {
        error: err.message,
        accessCodeId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to update access code',
        code: 'SERVER_ERROR'
      });
    }
  },

};

module.exports = adminController;

