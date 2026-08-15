const db = require('../config/database');
const logger = require('../utils/logger');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Contest = require('../models/Contest');
const ContestRegistration = require('../models/ContestRegistration');
const TalentPoolRegistration = require('../models/talentPoolModel');
const ProjectPool = require('../models/projectPoolModel');
const AccessCode = require('../models/accessCodeModel');
const PaymentTracking = require('../models/paymentTrackingModel');
const ExitExamPayment = require('../models/ExitExamPayment');
const University = require('../models/University');
const Event = require('../models/Event');
const SelfStudyRegistration = require('../models/selfStudyRegistrationModel');
const CustomerCourseAccess = require('../models/customerCourseAccessModel');

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
        paymentStats,
        telegramStats,
        courseStats,
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
            COUNT(DISTINCT customer_id) AS users_with_customers
          FROM users
        `),
        // Contest Statistics
        db.query(`
          SELECT
            COUNT(DISTINCT c.id) AS total_contests,
            COUNT(DISTINCT cr.id) AS total_registrations,
            COUNT(DISTINCT cr.customer_id) AS unique_participants,
            SUM(CASE WHEN DATE(c.created_at) = CURDATE() THEN 1 ELSE 0 END) AS contests_created_today
          FROM contests c
          LEFT JOIN contest_registrations cr ON c.id = cr.contest_id
        `),
        // Talent Pool Statistics
        db.query(`
          SELECT
            COUNT(*) AS total_registrations,
            SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_today
          FROM talent_pool_registration
        `),
        // Payment Statistics
        db.query(`
          SELECT
            COUNT(*) AS total_payments,
            SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) AS completed_payments,
            SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS pending_payments,
            SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) AS failed_payments,
            SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) AS total_revenue,
            AVG(CASE WHEN payment_status = 'completed' THEN amount ELSE NULL END) AS avg_payment_amount,
            SUM(CASE WHEN payment_status = 'completed' AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END) AS revenue_today,
            SUM(CASE WHEN payment_status = 'completed' AND YEARWEEK(created_at) = YEARWEEK(CURDATE()) THEN amount ELSE 0 END) AS revenue_this_week,
            SUM(CASE WHEN payment_status = 'completed' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN amount ELSE 0 END) AS revenue_this_month
          FROM payment_tracking
        `),
        // Telegram Statistics
        db.query(`
          SELECT
            COUNT(*) AS total_telegram_users,
            SUM(CASE WHEN telegram_user_id IS NOT NULL AND telegram_user_id != 0 THEN 1 ELSE 0 END) AS active_telegram_users,
            SUM(CASE WHEN telegram_user_id IS NULL OR telegram_user_id = 0 THEN 1 ELSE 0 END) AS blocked_telegram_users,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_today
          FROM customers
          WHERE telegram_user_id IS NOT NULL
        `),
        // Course Statistics
        db.query(`
          SELECT
            COUNT(DISTINCT customer_id) AS total_registrations,
            COUNT(DISTINCT CASE WHEN status = 'completed' THEN customer_id END) AS completed_courses,
            COUNT(DISTINCT CASE WHEN status = 'active' THEN customer_id END) AS in_progress,
            COUNT(DISTINCT CASE WHEN status = 'completed' THEN customer_id END) AS certificates_issued
          FROM selfstudy_registrations
          WHERE status IN ('active', 'completed')
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

      // Get revenue trends
      const [revenueTrends] = await db.query(`
        SELECT
          DATE(created_at) AS date,
          SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) AS amount
        FROM payment_tracking
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      // Format trend data
      const formatTrendData = (data, days, defaultValue = 0) => {
        const result = { labels: [], data: [] };
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          result.labels.push(dateStr);
          const dayData = data.find(d => {
            const dataDate = d.date instanceof Date 
              ? d.date.toISOString().split('T')[0] 
              : (d.date?.toISOString?.()?.split('T')[0] || d.date);
            return dataDate === dateStr;
          });
          result.data.push(dayData ? (dayData.count || dayData.amount || defaultValue) : defaultValue);
        }
        return result;
      };

      return res.status(200).json({
        success: true,
        data: {
          summary: {
            total_customers: customerStats[0][0]?.total_customers || 0,
            total_users: userStats[0][0]?.total_users || 0,
            total_revenue: parseFloat(paymentStats[0][0]?.total_revenue || 0),
            total_payments: paymentStats[0][0]?.total_payments || 0,
            telegram_users: telegramStats[0][0]?.total_telegram_users || 0,
            active_contests: contestStats[0][0]?.total_contests || 0
          },
          overview: {
            customers: customerStats[0][0] || {},
            users: userStats[0][0] || {},
            contests: contestStats[0][0] || {},
            talent_pool: talentPoolStats[0][0] || {},
            payments: {
              total_payments: paymentStats[0][0]?.total_payments || 0,
              completed_payments: paymentStats[0][0]?.completed_payments || 0,
              pending_payments: paymentStats[0][0]?.pending_payments || 0,
              failed_payments: paymentStats[0][0]?.failed_payments || 0,
              total_revenue: parseFloat(paymentStats[0][0]?.total_revenue || 0),
              avg_payment_amount: parseFloat(paymentStats[0][0]?.avg_payment_amount || 0),
              revenue_today: parseFloat(paymentStats[0][0]?.revenue_today || 0),
              revenue_this_week: parseFloat(paymentStats[0][0]?.revenue_this_week || 0),
              revenue_this_month: parseFloat(paymentStats[0][0]?.revenue_this_month || 0)
            },
            telegram: {
              total_telegram_users: telegramStats[0][0]?.total_telegram_users || 0,
              active_telegram_users: telegramStats[0][0]?.active_telegram_users || 0,
              blocked_telegram_users: telegramStats[0][0]?.blocked_telegram_users || 0,
              new_today: telegramStats[0][0]?.new_today || 0
            },
            courses: {
              total_registrations: courseStats[0][0]?.total_registrations || 0,
              completed_courses: courseStats[0][0]?.completed_courses || 0,
              in_progress: courseStats[0][0]?.in_progress || 0,
              certificates_issued: courseStats[0][0]?.certificates_issued || 0
            }
          },
          trends: {
            customers: formatTrendData(customerTrends, 7),
            revenue: formatTrendData(revenueTrends, 7, 0)
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

      const CustomerProfileDetails = require('../models/customerProfileDetailsModel');
      const profileDetails = await CustomerProfileDetails.findByCustomerId(id);

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
          profile_details: profileDetails || null,
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

      // Update customer profile details if provided
      const CustomerProfileDetails = require('../models/customerProfileDetailsModel');
      const profileFields = ['location', 'bio', 'social_links', 'position', 'organization', 'skills', 'experience', 'documents'];
      const profileUpdate = {};
      let hasProfileUpdate = false;
      
      profileFields.forEach(key => {
        if (updateData[key] !== undefined) {
          profileUpdate[key] = updateData[key];
          hasProfileUpdate = true;
        }
      });
      
      if (hasProfileUpdate) {
        const existingProfile = await CustomerProfileDetails.findByCustomerId(id);
        const mergedUpdate = {
          location: profileUpdate.location !== undefined ? profileUpdate.location : (existingProfile?.location ?? null),
          bio: profileUpdate.bio !== undefined ? profileUpdate.bio : (existingProfile?.bio ?? null),
          social_links: profileUpdate.social_links !== undefined ? profileUpdate.social_links : (existingProfile?.social_links ?? {}),
          position: profileUpdate.position !== undefined ? profileUpdate.position : (existingProfile?.position ?? null),
          organization: profileUpdate.organization !== undefined ? profileUpdate.organization : (existingProfile?.organization ?? null),
          skills: profileUpdate.skills !== undefined ? profileUpdate.skills : (existingProfile?.skills ?? null),
          experience: profileUpdate.experience !== undefined ? profileUpdate.experience : (existingProfile?.experience ?? null),
          documents: profileUpdate.documents !== undefined ? profileUpdate.documents : (existingProfile?.documents ?? null),
        };
        await CustomerProfileDetails.upsertByCustomerId(id, mergedUpdate);
      }

      // Get updated customer data
      const updated = await Customer.findById(id);
      const updatedProfile = await CustomerProfileDetails.findByCustomerId(id);

      logger.info('Admin updated customer', {
        adminId: req.user.user_id,
        customerId: id,
        updates: [...Object.keys(customerUpdate), ...(hasProfileUpdate ? Object.keys(profileUpdate) : [])]
      });

      return res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: {
          ...updated,
          profile_details: updatedProfile
        }
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

      let statusVal = undefined;
      if (status === 'pending') statusVal = 0;
      else if (status === 'approved') statusVal = 1;
      else if (status === 'rejected') statusVal = 2;
      else if (status === 'shortlisted') statusVal = 3;

      const filters = {
        status: statusVal,
        country: country || undefined,
        search: search || undefined
      };

      const registrations = await TalentPoolRegistration.getByFilters(filters);
      const total = registrations.length;

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const paginatedRegistrations = registrations.slice(offset, offset + parseInt(limit));

      // Map status numbers back to string tags for UI compatibility
      const mappedRegistrations = paginatedRegistrations.map(reg => {
        let statusStr = 'pending';
        if (reg.status === 1) statusStr = 'approved';
        else if (reg.status === 2) statusStr = 'rejected';
        else if (reg.status === 3) statusStr = 'shortlisted';
        return { ...reg, status: statusStr };
      });

      return res.status(200).json({
        success: true,
        data: {
          registrations: mappedRegistrations,
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

      let statusVal = 0;
      if (status === 'approved') statusVal = 1;
      else if (status === 'rejected') statusVal = 2;
      else if (status === 'shortlisted') statusVal = 3;

      await TalentPoolRegistration.updateStatus(id, statusVal);

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
   * Get Project Pool Submissions
   * GET /api/admin/project-pool
   */
  async getProjectPoolQueue(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status = '',
        category = ''
      } = req.query;

      let statusVal = undefined;
      if (status === 'pending') statusVal = 0;
      else if (status === 'approved') statusVal = 1;
      else if (status === 'completed') statusVal = 2;
      else if (status === 'rejected') statusVal = 3;

      const filters = {
        status: statusVal,
        category: category || undefined
      };

      const projects = await ProjectPool.findAllProjects(filters);
      const total = projects.length;

      // Apply pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const paginatedProjects = projects.slice(offset, offset + parseInt(limit));

      // Map status numbers back to string tags for UI compatibility
      const mappedProjects = paginatedProjects.map(proj => {
        let statusStr = 'pending';
        if (proj.status === 1) statusStr = 'approved';
        else if (proj.status === 2) statusStr = 'completed';
        else if (proj.status === 3) statusStr = 'rejected';
        return { ...proj, status: statusStr };
      });

      return res.status(200).json({
        success: true,
        data: {
          registrations: mappedProjects,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (err) {
      logger.error('Admin get project pool queue error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve project pool queue',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update Project Pool Listing Status
   * PATCH /api/admin/project-pool/:id/status
   */
  async updateProjectPoolStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: pending, approved, completed, or rejected',
          code: 'VALIDATION_ERROR'
        });
      }

      const project = await ProjectPool.findProjectById(id);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project listing not found',
          code: 'NOT_FOUND'
        });
      }

      let statusVal = 0;
      if (status === 'approved') statusVal = 1;
      else if (status === 'completed') statusVal = 2;
      else if (status === 'rejected') statusVal = 3;

      await ProjectPool.updateProjectStatus(id, statusVal);

      logger.info('Admin updated project pool status', {
        adminId: req.user.user_id,
        projectId: id,
        newStatus: status
      });

      return res.status(200).json({
        success: true,
        message: 'Project status updated successfully'
      });
    } catch (err) {
      logger.error('Admin update project pool status error', {
        error: err.message,
        projectId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to update project status',
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
      const [customerGrowthRows] = await db.query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS count
        FROM customers
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND deleted_at IS NULL
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [periodDays]);
      let running = 0;
      const customerGrowth = (customerGrowthRows || []).map((row) => {
        running += Number(row.count) || 0;
        return { ...row, cumulative: running };
      });

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
        course_id,
        university_name,
        total_students,
        max_uses,
        is_active = true,
        expires_at,
        notes,
        payment_amount,
        payment_currency
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
        course_id: course_id || null,
        university_name,
        total_students,
        max_uses,
        is_active,
        expires_at,
        notes,
        created_by: req.user.user_id,
        payment_amount: payment_amount !== undefined ? Number(payment_amount) : undefined,
        payment_currency: payment_currency || undefined
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

  /**
   * Get Summary Report
   * GET /api/admin/report/summary
   */
  async getSummaryReport(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      // Build date filter
      let dateFilter = '';
      const params = [];
      if (start_date) {
        dateFilter += ' AND DATE(created_at) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        dateFilter += ' AND DATE(created_at) <= ?';
        params.push(end_date);
      }

      // Get customer stats
      const [customerStats] = await db.query(`
        SELECT
          COUNT(*) AS total_customers,
          SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS new_customers
        FROM customers
        WHERE deleted_at IS NULL ${dateFilter}
      `, params);

      // Get payment stats
      const paymentParams = [];
      let paymentFilter = '';
      if (start_date) {
        paymentFilter += ' AND DATE(created_at) >= ?';
        paymentParams.push(start_date);
      }
      if (end_date) {
        paymentFilter += ' AND DATE(created_at) <= ?';
        paymentParams.push(end_date);
      }

      const [paymentStats] = await db.query(`
        SELECT
          COUNT(*) AS total_payments,
          SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) AS total_revenue
        FROM payment_tracking
        WHERE 1=1 ${paymentFilter}
      `, paymentParams);

      // Get course stats
      const [courseStats] = await db.query(`
        SELECT
          COUNT(DISTINCT customer_id) AS active_courses,
          COUNT(DISTINCT CASE WHEN status = 'completed' THEN customer_id END) AS certificates_issued
        FROM selfstudy_registrations
        WHERE status IN ('active', 'completed')
      `);

      // Get breakdown by customer type
      const [customerTypeBreakdown] = await db.query(`
        SELECT
          customer_type,
          COUNT(*) AS count
        FROM customers
        WHERE deleted_at IS NULL ${dateFilter}
        GROUP BY customer_type
      `, params);

      // Get breakdown by payment status
      const [paymentStatusBreakdown] = await db.query(`
        SELECT
          payment_status,
          COUNT(*) AS count
        FROM payment_tracking
        WHERE 1=1 ${paymentFilter}
        GROUP BY payment_status
      `, paymentParams);

      return res.status(200).json({
        success: true,
        data: {
          period: {
            start_date: start_date || null,
            end_date: end_date || null
          },
          summary: {
            total_customers: customerStats[0]?.total_customers || 0,
            new_customers: customerStats[0]?.new_customers || 0,
            total_revenue: parseFloat(paymentStats[0]?.total_revenue || 0),
            total_payments: paymentStats[0]?.total_payments || 0,
            active_courses: courseStats[0]?.active_courses || 0,
            certificates_issued: courseStats[0]?.certificates_issued || 0
          },
          breakdown: {
            by_customer_type: customerTypeBreakdown.reduce((acc, row) => {
              acc[row.customer_type] = row.count;
              return acc;
            }, {}),
            by_payment_status: paymentStatusBreakdown.reduce((acc, row) => {
              acc[row.payment_status] = row.count;
              return acc;
            }, {})
          },
          insights: []
        }
      });
    } catch (err) {
      logger.error('Admin get summary report error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve summary report',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Customers with Course Progress
   * GET /api/admin/customers/with-progress
   */
  async getCustomersWithProgress(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        sort_by = 'completed_at',
        sort_order = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build search condition
      let searchCondition = '';
      const searchParams = [];
      if (search) {
        searchCondition = ` AND (
          c.first_name LIKE ? OR 
          c.last_name LIKE ? OR 
          CONCAT(c.first_name, ' ', c.last_name) LIKE ? OR
          c.email LIKE ?
        )`;
        const searchTerm = `%${search}%`;
        searchParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Build sort condition
      const allowedSortFields = {
        'completed_at': 'MAX(csp.completed_at)',
        'first_completed_at': 'MIN(csp.completed_at)',
        'last_completed_at': 'MAX(csp.completed_at)',
        'completed_subsections': 'COUNT(DISTINCT csp.subsection_id)',
        'first_name': 'c.first_name',
        'last_name': 'c.last_name',
        'email': 'c.email',
        'created_at': 'c.created_at'
      };
      const sortField = allowedSortFields[sort_by] || allowedSortFields['completed_at'];
      const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get customers with progress
      const query = `
        SELECT
          c.customer_id,
          c.first_name,
          c.last_name,
          CONCAT(c.first_name, ' ', c.last_name) AS full_name,
          c.email,
          c.phone,
          c.profile_picture,
          COUNT(DISTINCT csp.subsection_id) AS completed_subsections,
          MIN(csp.completed_at) AS first_completed_at,
          MAX(csp.completed_at) AS last_completed_at,
          c.created_at,
          COALESCE(cca.access_code_id, sr.access_code_id) AS access_code_id,
          COALESCE(ac.code, NULL) AS access_code,
          CASE 
            WHEN cca.access_code_id IS NOT NULL THEN 'customer_course_access'
            WHEN sr.access_code_id IS NOT NULL THEN 'selfstudy_registrations'
            ELSE NULL
          END AS access_code_source
        FROM customers c
        INNER JOIN customer_subsection_progress csp ON c.customer_id = csp.customer_id
        LEFT JOIN customer_course_access cca ON c.customer_id = cca.customer_id
        LEFT JOIN selfstudy_registrations sr ON c.customer_id = sr.customer_id AND sr.status = 'active'
        LEFT JOIN access_codes ac ON COALESCE(cca.access_code_id, sr.access_code_id) = ac.id
        WHERE c.deleted_at IS NULL
          AND csp.status = 'completed'
          ${searchCondition}
        GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.phone, c.profile_picture, c.created_at,
                 cca.access_code_id, sr.access_code_id, ac.code
        ORDER BY ${sortField} ${sortDir}
        LIMIT ? OFFSET ?
      `;

      const [customers] = await db.query(query, [...searchParams, parseInt(limit), offset]);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT c.customer_id) AS total
        FROM customers c
        INNER JOIN customer_subsection_progress csp ON c.customer_id = csp.customer_id
        WHERE c.deleted_at IS NULL
          AND csp.status = 'completed'
          ${searchCondition}
      `;
      const [countResult] = await db.query(countQuery, searchParams);
      const total = countResult[0]?.total || 0;

      return res.status(200).json({
        success: true,
        data: {
          customers: customers || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (err) {
      logger.error('Admin get customers with progress error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve customers with progress',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get All Payments
   * GET /api/admin/payments
   */
  async getPayments(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        customer_id,
        access_code_id,
        payment_status,
        payment_type,
        start_date,
        end_date
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        customer_id: customer_id ? parseInt(customer_id) : undefined,
        access_code_id: access_code_id ? parseInt(access_code_id) : undefined,
        payment_status: payment_status || undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined
      };

      // Note: payment_type filter is not directly in payment_tracking table
      // It would need to be determined from related tables if needed

      const result = await PaymentTracking.getAll(filters);

      return res.status(200).json({
        success: true,
        data: {
          payments: result.payments || [],
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            total_pages: result.total_pages
          }
        }
      });
    } catch (err) {
      logger.error('Admin get payments error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve payments',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Payment Statistics
   * GET /api/admin/payments/stats
   */
  async getPaymentStats(req, res) {
    try {
      const stats = await PaymentTracking.getStats();

      // Calculate additional stats
      const revenueToday = stats.daily_stats
        .filter(d => d.date === new Date().toISOString().split('T')[0])
        .reduce((sum, d) => sum + parseFloat(d.daily_revenue || 0), 0);

      const revenueThisWeek = stats.daily_stats
        .filter(d => {
          const date = new Date(d.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return date >= weekAgo;
        })
        .reduce((sum, d) => sum + parseFloat(d.daily_revenue || 0), 0);

      const revenueThisMonth = stats.daily_stats
        .filter(d => {
          const date = new Date(d.date);
          const now = new Date();
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, d) => sum + parseFloat(d.daily_revenue || 0), 0);

      return res.status(200).json({
        success: true,
        data: {
          total_payments: stats.overview.total_payments || 0,
          completed_payments: stats.overview.completed_payments || 0,
          pending_payments: stats.overview.pending_payments || 0,
          failed_payments: stats.overview.failed_payments || 0,
          total_revenue: parseFloat(stats.overview.total_revenue || 0),
          avg_payment_amount: parseFloat(stats.overview.avg_payment_amount || 0),
          revenue_today: revenueToday,
          revenue_this_week: revenueThisWeek,
          revenue_this_month: revenueThisMonth
        }
      });
    } catch (err) {
      logger.error('Admin get payment stats error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment statistics',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Payment by ID
   * GET /api/admin/payments/:id
   */
  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await PaymentTracking.getById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND'
        });
      }

      return res.status(200).json({
        success: true,
        data: payment
      });
    } catch (err) {
      logger.error('Admin get payment by ID error', {
        error: err.message,
        paymentId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Customer Payments
   * GET /api/admin/payments/customer/:customer_id
   */
  async getCustomerPayments(req, res) {
    try {
      const { customer_id } = req.params;
      const payments = await PaymentTracking.getCustomerPayments(customer_id);

      return res.status(200).json({
        success: true,
        data: {
          payments: payments || []
        }
      });
    } catch (err) {
      logger.error('Admin get customer payments error', {
        error: err.message,
        customerId: req.params.customer_id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve customer payments',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Payments by Status
   * GET /api/admin/payments/status/:status
   */
  async getPaymentsByStatus(req, res) {
    try {
      const { status } = req.params;
      const payments = await PaymentTracking.getPaymentsByStatus(status, 100);

      return res.status(200).json({
        success: true,
        data: {
          payments: payments || []
        }
      });
    } catch (err) {
      logger.error('Admin get payments by status error', {
        error: err.message,
        status: req.params.status
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve payments by status',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get All Exit Exam Payments
   * GET /api/admin/exit-exam-payments
   */
  async getExitExamPayments(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        customer_id,
        access_code_id,
        payment_status
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = `
        SELECT
          eep.*,
          c.first_name,
          c.last_name,
          c.email,
          ac.code AS access_code,
          ac.university_name
        FROM exit_exam_payments eep
        LEFT JOIN customers c ON eep.customer_id = c.customer_id
        LEFT JOIN access_codes ac ON eep.access_code_id = ac.id
        WHERE 1=1
      `;
      const params = [];

      if (customer_id) {
        query += ` AND eep.customer_id = ?`;
        params.push(customer_id);
      }

      if (access_code_id) {
        query += ` AND eep.access_code_id = ?`;
        params.push(access_code_id);
      }

      if (payment_status) {
        query += ` AND eep.payment_status = ?`;
        params.push(payment_status);
      }

      // Get total count
      const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) AS total FROM');
      const [countResult] = await db.query(countQuery, params);
      const total = countResult[0]?.total || 0;

      query += ` ORDER BY eep.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);

      const [payments] = await db.query(query, params);

      return res.status(200).json({
        success: true,
        data: {
          payments: payments || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (err) {
      logger.error('Admin get exit exam payments error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve exit exam payments',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Exit Exam Payment by ID
   * GET /api/admin/exit-exam-payments/:id
   */
  async getExitExamPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await ExitExamPayment.findById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Exit exam payment not found',
          code: 'PAYMENT_NOT_FOUND'
        });
      }

      // Get customer and access code details
      const [customer] = await db.query(
        'SELECT first_name, last_name, email FROM customers WHERE customer_id = ?',
        [payment.customer_id]
      );

      const [accessCode] = await db.query(
        'SELECT code, university_name FROM access_codes WHERE id = ?',
        [payment.access_code_id]
      );

      return res.status(200).json({
        success: true,
        data: {
          ...payment,
          first_name: customer[0]?.first_name || null,
          last_name: customer[0]?.last_name || null,
          email: customer[0]?.email || null,
          access_code: accessCode[0]?.code || null,
          university_name: accessCode[0]?.university_name || null
        }
      });
    } catch (err) {
      logger.error('Admin get exit exam payment by ID error', {
        error: err.message,
        paymentId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve exit exam payment',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Telegram Users
   * GET /api/admin/telegram/users
   */
  async getTelegramUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        is_blocked
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = `
        SELECT
          c.customer_id,
          c.telegram_user_id,
          c.telegram_username,
          c.first_name,
          c.last_name,
          c.email,
          c.is_active,
          CASE WHEN c.telegram_user_id IS NOT NULL AND c.telegram_user_id != 0 THEN 0 ELSE 1 END AS is_blocked,
          c.created_at AS joined_at
        FROM customers c
        WHERE c.telegram_user_id IS NOT NULL AND c.telegram_user_id != 0
      `;
      const params = [];

      if (is_blocked !== undefined) {
        const blockedValue = is_blocked === 'true' ? 1 : 0;
        query += ` AND CASE WHEN c.telegram_user_id IS NOT NULL AND c.telegram_user_id != 0 THEN 0 ELSE 1 END = ?`;
        params.push(blockedValue);
      }

      // Get total count
      const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) AS total FROM');
      const [countResult] = await db.query(countQuery, params);
      const total = countResult[0]?.total || 0;

      query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);

      const [users] = await db.query(query, params);

      return res.status(200).json({
        success: true,
        data: {
          users: users || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
    } catch (err) {
      logger.error('Admin get telegram users error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve telegram users',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Telegram User Details
   * GET /api/admin/telegram/users/:telegram_user_id
   */
  async getTelegramUserDetails(req, res) {
    try {
      const { telegram_user_id } = req.params;
      const [user] = await db.query(`
        SELECT
          c.*,
          CASE WHEN c.telegram_user_id IS NOT NULL AND c.telegram_user_id != 0 THEN 0 ELSE 1 END AS is_blocked
        FROM customers c
        WHERE c.telegram_user_id = ?
      `, [telegram_user_id]);

      if (!user || user.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Telegram user not found',
          code: 'USER_NOT_FOUND'
        });
      }

      return res.status(200).json({
        success: true,
        data: user[0]
      });
    } catch (err) {
      logger.error('Admin get telegram user details error', {
        error: err.message,
        telegramUserId: req.params.telegram_user_id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve telegram user details',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Telegram Statistics
   * GET /api/admin/telegram/stats
   */
  async getTelegramStats(req, res) {
    try {
      const [stats] = await db.query(`
        SELECT
          COUNT(*) AS total_users,
          SUM(CASE WHEN telegram_user_id IS NOT NULL AND telegram_user_id != 0 THEN 1 ELSE 0 END) AS active_users,
          SUM(CASE WHEN telegram_user_id IS NULL OR telegram_user_id = 0 THEN 1 ELSE 0 END) AS blocked_users,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS new_today,
          SUM(CASE WHEN YEARWEEK(created_at) = YEARWEEK(CURDATE()) THEN 1 ELSE 0 END) AS new_this_week,
          SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) AS new_this_month
        FROM customers
        WHERE telegram_user_id IS NOT NULL
      `);

      return res.status(200).json({
        success: true,
        data: {
          total_users: stats[0]?.total_users || 0,
          active_users: stats[0]?.active_users || 0,
          blocked_users: stats[0]?.blocked_users || 0,
          new_today: stats[0]?.new_today || 0,
          new_this_week: stats[0]?.new_this_week || 0,
          new_this_month: stats[0]?.new_this_month || 0
        }
      });
    } catch (err) {
      logger.error('Admin get telegram stats error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve telegram statistics',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get All Universities
   * GET /api/admin/universities
   */
  async getUniversities(req, res) {
    try {
      const {
        is_active,
        search
      } = req.query;

      const filters = {
        is_active: is_active !== undefined ? is_active === 'true' : undefined,
        search: search || undefined
      };

      const universities = await University.findAll(filters);

      return res.status(200).json({
        success: true,
        data: universities || []
      });
    } catch (err) {
      logger.error('Admin get universities error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve universities',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get University by ID
   * GET /api/admin/universities/:id
   */
  async getUniversityById(req, res) {
    try {
      const { id } = req.params;
      const university = await University.findById(id);

      if (!university) {
        return res.status(404).json({
          success: false,
          error: 'University not found',
          code: 'UNIVERSITY_NOT_FOUND'
        });
      }

      return res.status(200).json({
        success: true,
        data: university
      });
    } catch (err) {
      logger.error('Admin get university by ID error', {
        error: err.message,
        universityId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve university',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Create University
   * POST /api/admin/universities
   */
  async createUniversity(req, res) {
    try {
      const { university_name, is_active = true } = req.body;

      if (!university_name) {
        return res.status(400).json({
          success: false,
          error: 'University name is required',
          code: 'VALIDATION_ERROR'
        });
      }

      // Handle file uploads if present (for certificate files)
      // Note: File upload handling would need to be implemented with multer
      // For now, we'll accept URL strings
      const universityData = {
        university_name,
        is_active,
        certificate_file_url: req.body.certificate_file_url || null,
        achievement_certificate_file_url: req.body.achievement_certificate_file_url || null,
        stamp_image_url: req.body.stamp_image_url || null
      };

      const universityId = await University.create(universityData);

      logger.info('Admin created university', {
        adminId: req.user.user_id,
        universityId,
        universityName: university_name
      });

      return res.status(201).json({
        success: true,
        message: 'University created successfully',
        data: {
          id: universityId
        }
      });
    } catch (err) {
      logger.error('Admin create university error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to create university',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update University
   * PUT /api/admin/universities/:id
   */
  async updateUniversity(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const university = await University.findById(id);
      if (!university) {
        return res.status(404).json({
          success: false,
          error: 'University not found',
          code: 'UNIVERSITY_NOT_FOUND'
        });
      }

      await University.update(id, updateData);

      logger.info('Admin updated university', {
        adminId: req.user.user_id,
        universityId: id
      });

      return res.status(200).json({
        success: true,
        message: 'University updated successfully'
      });
    } catch (err) {
      logger.error('Admin update university error', {
        error: err.message,
        universityId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to update university',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Delete University
   * DELETE /api/admin/universities/:id
   */
  async deleteUniversity(req, res) {
    try {
      const { id } = req.params;
      const university = await University.findById(id);

      if (!university) {
        return res.status(404).json({
          success: false,
          error: 'University not found',
          code: 'UNIVERSITY_NOT_FOUND'
        });
      }

      await University.delete(id);

      logger.info('Admin deleted university', {
        adminId: req.user.user_id,
        universityId: id
      });

      return res.status(200).json({
        success: true,
        message: 'University deleted successfully'
      });
    } catch (err) {
      logger.error('Admin delete university error', {
        error: err.message,
        universityId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete university',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get All Events (Admin)
   * GET /api/admin/events
   */
  async getEvents(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        start_date,
        end_date
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // Max 100
        search: search || undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined
      };

      const result = await Event.findAllAdmin(filters);

      return res.status(200).json({
        success: true,
        data: {
          events: result.events || [],
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            total_pages: result.total_pages
          }
        }
      });
    } catch (err) {
      logger.error('Admin get events error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve events',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Event by ID (Admin)
   * GET /api/admin/events/:id
   */
  async getEventById(req, res) {
    try {
      const { id } = req.params;
      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
          code: 'EVENT_NOT_FOUND'
        });
      }

      return res.status(200).json({
        success: true,
        data: event
      });
    } catch (err) {
      logger.error('Admin get event by ID error', {
        error: err.message,
        eventId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve event',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Create Event
   * POST /api/admin/events
   */
  async createEvent(req, res) {
    try {
      const { event_name, event_date, short_description, detailed_content } = req.body;

      if (!event_name || !event_date || !short_description || !detailed_content) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required: event_name, event_date, short_description, detailed_content',
          code: 'MISSING_FIELDS'
        });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      const eventId = await Event.create({
        event_name,
        event_date,
        short_description,
        detailed_content
      });

      logger.info('Admin created event', {
        adminId: req.user.user_id,
        eventId,
        eventName: event_name
      });

      return res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: {
          id: eventId
        }
      });
    } catch (err) {
      logger.error('Admin create event error', {
        error: err.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to create event',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update Event
   * PUT /api/admin/events/:id
   */
  async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const { event_name, event_date, short_description, detailed_content } = req.body;

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
          code: 'EVENT_NOT_FOUND'
        });
      }

      if (!event_name || !event_date || !short_description || !detailed_content) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required: event_name, event_date, short_description, detailed_content',
          code: 'MISSING_FIELDS'
        });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      await Event.update(id, {
        event_name,
        event_date,
        short_description,
        detailed_content
      });

      logger.info('Admin updated event', {
        adminId: req.user.user_id,
        eventId: id
      });

      return res.status(200).json({
        success: true,
        message: 'Event updated successfully'
      });
    } catch (err) {
      logger.error('Admin update event error', {
        error: err.message,
        eventId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to update event',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Delete Event
   * DELETE /api/admin/events/:id
   */
  async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
          code: 'EVENT_NOT_FOUND'
        });
      }

      await Event.delete(id);

      logger.info('Admin deleted event', {
        adminId: req.user.user_id,
        eventId: id
      });

      return res.status(200).json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (err) {
      logger.error('Admin delete event error', {
        error: err.message,
        eventId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Private Groups List
   * GET /api/admin/private-groups
   */
  async getPrivateGroups(req, res) {
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../data/private-groups.json');
      
      if (!fs.existsSync(jsonPath)) {
        return res.status(200).json({ success: true, data: [] });
      }
      
      const fileData = fs.readFileSync(jsonPath, 'utf8');
      const groups = JSON.parse(fileData);
      
      return res.status(200).json({
        success: true,
        data: groups
      });
    } catch (err) {
      logger.error('Admin get private groups error', { error: err.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve private groups',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Get Private Group by ID
   * GET /api/admin/private-groups/:id
   */
  async getPrivateGroupById(req, res) {
    try {
      const { id } = req.params;
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../data/private-groups.json');
      
      if (!fs.existsSync(jsonPath)) {
        return res.status(404).json({ success: false, error: 'Group not found' });
      }
      
      const fileData = fs.readFileSync(jsonPath, 'utf8');
      const groups = JSON.parse(fileData);
      const group = groups.find(g => g.id === id);
      
      if (!group) {
        return res.status(404).json({
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: group
      });
    } catch (err) {
      logger.error('Admin get private group details error', { error: err.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve group details',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Create Private Group
   * POST /api/admin/private-groups
   */
  async createPrivateGroup(req, res) {
    try {
      const { name, category, type, description, price, currency } = req.body;
      
      if (!name || !category || !type) {
        return res.status(400).json({
          success: false,
          error: 'Name, category, and type are required',
          code: 'VALIDATION_ERROR'
        });
      }
      
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../data/private-groups.json');
      
      let groups = [];
      if (fs.existsSync(jsonPath)) {
        const fileData = fs.readFileSync(jsonPath, 'utf8');
        groups = JSON.parse(fileData);
      }
      
      const newGroup = {
        id: `g_${Date.now()}`,
        name,
        category,
        type,
        description: description || '',
        price: price !== undefined ? Number(price) : 0,
        currency: currency || 'USD',
        memberCount: 0,
        members: [],
        posts: [],
        announcements: [],
        resources: []
      };
      
      groups.push(newGroup);
      fs.writeFileSync(jsonPath, JSON.stringify(groups, null, 2), 'utf8');
      
      logger.info('Admin created private group', {
        adminId: req.user.user_id,
        groupId: newGroup.id,
        name
      });
      
      return res.status(201).json({
        success: true,
        message: 'Private group created successfully',
        data: newGroup
      });
    } catch (err) {
      logger.error('Admin create private group error', { error: err.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to create private group',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Update Private Group
   * PUT /api/admin/private-groups/:id
   */
  async updatePrivateGroup(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../data/private-groups.json');
      
      if (!fs.existsSync(jsonPath)) {
        return res.status(404).json({ success: false, error: 'Group not found' });
      }
      
      const fileData = fs.readFileSync(jsonPath, 'utf8');
      let groups = JSON.parse(fileData);
      const groupIndex = groups.findIndex(g => g.id === id);
      
      if (groupIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND'
        });
      }
      
      // Update fields
      const group = groups[groupIndex];
      if (updateData.name) group.name = updateData.name;
      if (updateData.category) group.category = updateData.category;
      if (updateData.type) group.type = updateData.type;
      if (updateData.description !== undefined) group.description = updateData.description;
      if (updateData.price !== undefined) group.price = Number(updateData.price);
      if (updateData.currency) group.currency = updateData.currency;
      
      // Handle members / posts / resources updates if provided (e.g. for members deletion or moderation)
      if (updateData.members) {
        group.members = updateData.members;
        group.memberCount = updateData.members.length;
      }
      if (updateData.posts) group.posts = updateData.posts;
      if (updateData.announcements) group.announcements = updateData.announcements;
      if (updateData.resources) group.resources = updateData.resources;

      groups[groupIndex] = group;
      fs.writeFileSync(jsonPath, JSON.stringify(groups, null, 2), 'utf8');
      
      logger.info('Admin updated private group', {
        adminId: req.user.user_id,
        groupId: id
      });
      
      return res.status(200).json({
        success: true,
        message: 'Private group updated successfully',
        data: group
      });
    } catch (err) {
      logger.error('Admin update private group error', { error: err.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to update private group',
        code: 'SERVER_ERROR'
      });
    }
  },

  /**
   * Delete Private Group
   * DELETE /api/admin/private-groups/:id
   */
  async deletePrivateGroup(req, res) {
    try {
      const { id } = req.params;
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../data/private-groups.json');
      
      if (!fs.existsSync(jsonPath)) {
        return res.status(404).json({ success: false, error: 'Group not found' });
      }
      
      const fileData = fs.readFileSync(jsonPath, 'utf8');
      let groups = JSON.parse(fileData);
      const groupExists = groups.some(g => g.id === id);
      
      if (!groupExists) {
        return res.status(404).json({
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND'
        });
      }
      
      groups = groups.filter(g => g.id !== id);
      fs.writeFileSync(jsonPath, JSON.stringify(groups, null, 2), 'utf8');
      
      logger.info('Admin deleted private group', {
        adminId: req.user.user_id,
        groupId: id
      });
      
      return res.status(200).json({
        success: true,
        message: 'Private group deleted successfully'
      });
    } catch (err) {
      logger.error('Admin delete private group error', { error: err.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete private group',
        code: 'SERVER_ERROR'
      });
    }
  }

};

module.exports = adminController;

