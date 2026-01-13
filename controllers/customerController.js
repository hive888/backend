const Customer = require('../models/Customer');
const db = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { uploadToS3, deleteFromS3 } = require('../config/s3Config');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const {sendPasswordResetEmail,sendVerificationEmail,sendWelcomeEmail,}=require('../utils/email');
const jwt = require('jsonwebtoken');
const { toE164 } = require('../utils/phone');
// const mlmController = require('./mlmController'); // Removed - not needed for this project
const lastSendMap = new Map();
const COOLDOWN_MS = 0 * 1000; // 60 seconds
const OTPService = require('../services/otpService');
const customerController = {

    /**
     * Sanitize customer object for API responses.
     * Removes internal/system fields and any legacy referral-related fields.
     */
    sanitizeCustomer(customer) {
        if (!customer || typeof customer !== 'object') return customer;
        // Pick only fields we want to expose to clients
        return {
            customer_id: customer.customer_id,
            email: customer.email,
            phone: customer.phone,
            first_name: customer.first_name,
            last_name: customer.last_name,
            profile_picture: customer.profile_picture,
            date_of_birth: customer.date_of_birth,
            gender: customer.gender,
            customer_type: customer.customer_type,
            source: customer.source,
            telegram_id: customer.telegram_id,
            is_active: customer.is_active,
            is_email_verified: customer.is_email_verified,
            is_phone_verified: customer.is_phone_verified,
            is_kyc_verified: customer.is_kyc_verified
        };
    },

    /**
     * Calculate profile completion percentage (0-100)
     * Returns percentage based on filled profile fields
     */
    calculateProfileCompletion(customer, profileDetails) {
        if (!customer) return 0;

        const fields = {
            // Basic required fields (40 points total)
            first_name: customer.first_name && String(customer.first_name).trim().length > 0,
            last_name: customer.last_name && String(customer.last_name).trim().length > 0,
            email: customer.email && String(customer.email).trim().length > 0,
            phone: customer.phone && String(customer.phone).trim().length > 0 && customer.phone !== '99999999999', // Exclude default phone
            
            // Basic optional fields (30 points total)
            profile_picture: customer.profile_picture && String(customer.profile_picture).trim().length > 0,
            date_of_birth: customer.date_of_birth !== null && customer.date_of_birth !== undefined,
            gender: customer.gender && customer.gender !== 'prefer_not_to_say' && String(customer.gender).trim().length > 0,
            
            // Profile details fields (30 points total)
            location: profileDetails?.location && String(profileDetails.location).trim().length > 0,
            bio: profileDetails?.bio && String(profileDetails.bio).trim().length > 0,
            social_links: profileDetails?.social_links && typeof profileDetails.social_links === 'object' && Object.keys(profileDetails.social_links).length > 0
        };

        // Calculate points (10 points per field, total 100)
        const fieldWeights = {
            first_name: 10,
            last_name: 10,
            email: 10,
            phone: 10,
            profile_picture: 10,
            date_of_birth: 10,
            gender: 10,
            location: 10,
            bio: 10,
            social_links: 10
        };

        let totalPoints = 0;
        Object.keys(fieldWeights).forEach(field => {
            if (fields[field]) {
                totalPoints += fieldWeights[field];
            }
        });

        return Math.min(100, Math.max(0, totalPoints));
    },
    
    async createCustomer(req, res) {
        try {
            const { file, body } = req;
            const { password, from, profile_picture, ...customerData } = body;
            
            const usersource = customerData.source;
            
            // Handle profile picture upload
            const profilePictureUrl = file ? await uploadToS3(file) : profile_picture;
            
            const customerPayload = {
                ...customerData,
                profile_picture: profilePictureUrl
            };
    
            // Create customer
            const newCustomer = await Customer.create(customerPayload);
            
            // Handle user account creation for Google sign-in
            if (from === 'google') {
                const defaultPassword = 'fromgoogle';
                const userPayload = {
                    customer_id: newCustomer.customer_id,
                    username: customerData.email,
                    password_hash: await bcrypt.hash(defaultPassword, 10),
                    auth_provider: 'google'
                };
                await User.create(userPayload);
                logger.info('User account created for Google sign-in', {
                    customerId: newCustomer.customer_id,
                    email: customerData.email
                });
            }
    
            // Handle user account creation for local sign-in
            if (password) {
                const userPayload = {
                    customer_id: newCustomer.customer_id,
                    username: customerData.email,
                    password_hash: await bcrypt.hash(password, 10),
                };
                await User.create(userPayload);
                logger.info('User account created for local sign-in', {
                    customerId: newCustomer.customer_id,
                    email: customerData.email
                });
            }
    
            // Send welcome email (non-blocking)
            try {
                await sendWelcomeEmail(customerData.email, customerData.first_name, usersource);
                logger.info('Welcome email sent', { email: customerData.email });
            } catch (emailError) {
                // Email failure shouldn't block customer creation
                logger.warn('Welcome email sending failed (non-critical)', {
                    email: customerData.email,
                    error: emailError.message
                });
            }
    
            return res.status(201).json({
                success: true,
                message: 'Customer created successfully',
                data: newCustomer
            });
    
        } catch (err) {
            // Clean up uploaded file if customer creation failed
            if (req.file && req.file.profilePictureUrl) {
                await deleteFromS3(req.file.profilePictureUrl).catch(cleanupErr => {
                    logger.warn('Failed to cleanup uploaded file', {
                        error: cleanupErr.message
                    });
                });
            }
    
            // Handle duplicate entry errors
            if (err.code === 'ER_DUP_ENTRY') {
                let field = 'unknown';
                let message = 'This value is already in use';
                
                if (err.message.includes('email')) {
                    field = 'email';
                    message = 'An account with this email address already exists';
                } else if (err.message.includes('phone')) {
                    field = 'phone';
                    message = 'An account with this phone number already exists';
                }
                
                logger.info('Customer creation failed: duplicate entry', {
                    field: field,
                    email: req.body?.email
                });
                
                return res.status(409).json({
                    success: false,
                    error: message,
                    code: 'DUPLICATE_ENTRY',
                    field: field
                });
            }
    
            // Handle validation errors
            if (err.code === 'ER_BAD_NULL_ERROR' || err.code === 'ER_NO_DEFAULT_FOR_FIELD') {
                logger.warn('Customer creation failed: validation error', {
                    error: err.message,
                    email: req.body?.email
                });
                
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    code: 'VALIDATION_ERROR'
                });
            }
    
            // Log error details for debugging (not exposed to user)
            logger.error('Customer creation failed', {
                error: err.message,
                code: err.code,
                email: req.body?.email
            });
    
            // Return generic error message to user
            return res.status(500).json({
                success: false,
                error: 'Failed to create customer account',
                code: 'SERVER_ERROR'
            });
        }
    },
    async getCustomerSummary(req, res) {
        try {
            const [results] = await db.query(`
                SELECT
                    COUNT(*) AS total,
                    SUM(is_active = 1) AS active,
                    SUM(is_active = 0) AS inactive,
                    SUM(customer_type = 'individual') AS individual,
                    SUM(customer_type = 'enterprise') AS business,
                    SUM(is_kyc_verified = 1) AS kyc_verified,
                    
                    -- New customer counts
                    SUM(DATE(created_at) = CURDATE()) AS new_today,
                    SUM(YEARWEEK(created_at) = YEARWEEK(CURDATE())) AS new_this_week,
                    SUM(MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())) AS new_this_month
                FROM 
                    customers
                WHERE 
                    deleted_at IS NULL
            `);
            
            // Get trend data (same as before)
            const [trendData] = await db.query(`
                SELECT 
                    DATE(created_at) AS date,
                    COUNT(*) AS count
                FROM 
                    customers
                WHERE 
                    created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    AND deleted_at IS NULL
                GROUP BY 
                    DATE(created_at)
                ORDER BY 
                    date ASC
            `);
            
            // Format trend data (same as before)
            const trendLabels = [];
            const trendValues = [];
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                trendLabels.push(dateStr);
                
                const dayData = trendData.find(d => d.date === dateStr);
                trendValues.push(dayData ? dayData.count : 0);
            }
            
            // Calculate percentages
            const total = results[0].total;
            const typeDistribution = {
                individual: total > 0 ? Math.round((results[0].individual / total) * 1000) / 10 : 0,
                business: total > 0 ? Math.round((results[0].business / total) * 1000) / 10 : 0
            };
            
            const statusDistribution = {
                active: total > 0 ? Math.round((results[0].active / total) * 1000) / 10 : 0,
                inactive: total > 0 ? Math.round((results[0].inactive / total) * 1000) / 10 : 0
            };
            
            res.json({
                success: true,
                data: {
                    summary: {
                        total: results[0].total,
                        active: results[0].active,
                        inactive: results[0].inactive,
                        individual: results[0].individual,
                        business: results[0].business,
                        kyc_verified: results[0].kyc_verified,
                        kyc_pending: results[0].total - results[0].kyc_verified,
                        new_today: results[0].new_today,
                        new_this_week: results[0].new_this_week,
                        new_this_month: results[0].new_this_month
                    },
                    trends: {
                        labels: trendLabels,
                        data: trendValues
                    },
                    types_distribution: typeDistribution,
                    status_distribution: statusDistribution
                }
            });
            
        } catch (err) {
            logger.error('Failed to get customer summary:', {
                error: err.message,
                stack: err.stack
            });
            
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve customer summary',
                message: 'Error fetching dashboard data'
            });
        }
    },
async verifyOwnershipOrDeveloper(req, res, next) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;
  
      // If user is a developer, skip ownership check
      if (requestingUser.role_name === 'developer') {
        return next();
      }
  
      // Verify the customer ID matches the authenticated user's customer_id
      if (parseInt(id) !== parseInt(requestingUser.customer_id)) {
        return res.status(403).json({
          success: false,
          errors: [{
            field: 'authorization',
            message: 'you can only update your own profile'
          }]
        });
      }
  
      next();
    } catch (err) {
      logger.error('Ownership verification error:', err);
      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'failed to verify ownership'
        }]
      });
    }
  },
  async verifyOwnershipUser(req, res, next) {
    try {
      const { id } = req.params;
      const requestingUser = req.user;
  
      // If user is a developer, skip ownership check
      if (requestingUser.role_name === 'developer') {
        return next();
      }
  
      // Verify the customer ID matches the authenticated user's customer_id
      if (parseInt(id) !== parseInt(requestingUser.user_id)) {
        return res.status(403).json({
          success: false,
          errors: [{
            field: 'authorization',
            message: 'you can only update your own profile'
          }]
        });
      }
  
      next();
    } catch (err) {
      logger.error('Ownership verification error:', err);
      return res.status(500).json({
        success: false,
        errors: [{
          field: 'server',
          message: 'failed to verify ownership'
        }]
      });
    }
  },
  async updateCustomer(req, res) {
    try {
        const { id } = req.params;
        const { file, body } = req || {};
        const requestingUser = req.user;

        // Security logging
        logger.security('Customer update attempt', {
            userId: req.user.user_id,
            role: req.user.role_name,
            customerId: req.user.customer_id,
            targetCustomerId: id,
            ip: req.ip
        });

        // Get existing customer
        const customer = await Customer.findById(id);
        if (!customer) {
            logger.warn('Customer not found for update', { customerId: id });
            return res.status(404).json({
                success: false,
                error: 'Customer not found',
                code: 'CUSTOMER_NOT_FOUND'
            });
        }

        // Validate that request body exists
        if (!body || typeof body !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Request body is required',
                code: 'MISSING_BODY'
            });
        }

        // Initialize update data
        const updateData = { ...body };

        // Field restrictions for non-developers
        if (requestingUser.role_name !== 'developer') {
            // Define allowed fields for regular customers
            const allowedFields = [
                'first_name',
                'last_name',
                'profile_picture',
                'date_of_birth',
                'gender',
                'phone'
            ];

            // Filter out restricted fields
            Object.keys(updateData).forEach(key => {
                if (!allowedFields.includes(key)) {
                    delete updateData[key];
                }
            });

            // Prevent changing sensitive fields
            const protectedFields = [
                'customer_type',
                'is_email_verified',
                'is_phone_verified',
                'two_factor_enabled',
                'is_kyc_verified'
            ];
            protectedFields.forEach(field => delete updateData[field]);
        }

        // Handle file upload if present
        let profilePictureUrl = customer.profile_picture;
        if (file) {
            try {
                const newUrl = await uploadToS3(file);
                
                // Delete old picture if it exists
                if (profilePictureUrl) {
                    try {
                        await deleteFromS3(profilePictureUrl);
                        logger.info('Old profile picture deleted', { customerId: id });
                    } catch (deleteErr) {
                        logger.warn('Failed to delete old profile picture', { 
                            error: deleteErr.message,
                            customerId: id
                        });
                    }
                }

                profilePictureUrl = newUrl;
            } catch (uploadErr) {
                logger.error('Profile picture upload failed', { 
                    error: uploadErr.message,
                    customerId: id
                });
                return res.status(500).json({ 
                    success: false,
                    errors: [{
                        field: 'profile_picture',
                        message: 'failed to upload profile picture'
                    }]
                });
            }
        }

        // Add the profile picture to update data
        updateData.profile_picture = profilePictureUrl;

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields provided for update',
                code: 'VALIDATION_ERROR'
            });
        }

        // Update customer
        await Customer.update(id, updateData);
        const updatedCustomer = await Customer.findById(id);

        // Audit logging for successful update
        logger.audit('Customer profile updated', {
            userId: req.user.user_id,
            customerId: id,
            changedFields: Object.keys(updateData)
        });

        return res.json({
            success: true,
            message: 'Customer updated successfully',
            data: customerController.sanitizeCustomer(updatedCustomer)
        });

    } catch (err) {
        logger.error('Customer update failed', {
            error: err.message,
            customerId: req.params?.id,
            userId: req.user?.user_id,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });

        // Handle duplicate entry errors
        if (err.code === 'ER_DUP_ENTRY') {
            let field = 'unknown';
            let message = 'This value is already in use';
            
            if (err.message.includes('email')) {
                field = 'email';
                message = 'An account with this email address already exists';
            } else if (err.message.includes('phone')) {
                field = 'phone';
                message = 'An account with this phone number already exists';
            }
            
            logger.info('Customer update failed: duplicate entry', {
                field: field,
                customerId: req.params?.id
            });
            
            return res.status(409).json({
                success: false,
                error: message,
                code: 'DUPLICATE_ENTRY',
                field: field
            });
        }

        logger.error('Customer update failed', {
            error: err.message,
            code: err.code,
            customerId: req.params?.id
        });

        return res.status(500).json({
            success: false,
            error: 'Failed to update customer',
            code: 'SERVER_ERROR'
        });
    }
},
    async updateProfilePicture(req, res) {
        try {
            const { id } = req.params || {};

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required',
                    code: 'VALIDATION_ERROR'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Profile picture is required',
                    code: 'VALIDATION_ERROR'
                });
            }

            const customer = await Customer.findById(id);
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    error: 'Customer not found',
                    code: 'CUSTOMER_NOT_FOUND'
                });
            }

            // Upload new picture to S3
            const profilePictureUrl = await uploadToS3(req.file);

            try {
                // Delete old picture from S3 if exists
                if (customer.profile_picture) {
                    await deleteFromS3(customer.profile_picture);
                }

                const updateData = {
                    profile_picture: profilePictureUrl
                };

                await Customer.update(id, updateData);

                const updatedCustomer = await Customer.findById(id);

                res.json({
                    success: true,
                    message: 'Profile picture updated successfully',
                    data: {
                        profile_picture: updatedCustomer.profile_picture
                    }
                });
            } catch (updateErr) {
                // Clean up the new upload if update fails
                await deleteFromS3(profilePictureUrl).catch(() => {});
                throw updateErr;
            }
        } catch (err) {
            logger.error(`Failed to update profile picture for customer ${req.params?.id}:`, {
                error: err.message,
                stack: err.stack,
                customerId: req.params?.id
            });
            res.status(500).json({
                success: false,
                error: 'Failed to update profile picture',
                code: 'SERVER_ERROR'
            });
        }
    },

    async getAllCustomers(req, res) {
        try {
          const limit = parseInt(req.query?.limit) || 10;
          const page = parseInt(req.query?.page) || 1;
          const search = req.query?.search || '';
      
          const offset = (page - 1) * limit;
      
          const customers = await Customer.findAllPaginated({ limit, offset, search });
          const totalCount = await Customer.countAll(search);
          const summary = await Customer.getSummary(search);
      
          res.json({
            success: true,
            message: 'Customers retrieved successfully',
            data: customers.map(customerController.sanitizeCustomer),
            pagination: {
              currentPage: page,
              itemsPerPage: limit,
              totalItems: totalCount,
              totalPages: Math.ceil(totalCount / limit)
            },
            summary
          });
        } catch (err) {
          logger.error('Failed to retrieve customers:', {
            error: err.message,
            stack: err.stack,
            query: req.query
          });
          res.status(500).json({
            success: false,
            error: 'Failed to retrieve customers',
            code: 'SERVER_ERROR'
          });
        }
      },
      

    async getCustomerById(req, res) {
        try {
            const { id } = req.params || {};
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required',
                    code: 'VALIDATION_ERROR'
                });
            }

            const customer = await Customer.findById(id);
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    error: 'Customer not found',
                    code: 'CUSTOMER_NOT_FOUND'
                });
            }

            res.json({
                success: true,
                message: 'Customer retrieved successfully',
                data: customerController.sanitizeCustomer(customer)
            });
        } catch (err) {
            logger.error(`Failed to retrieve customer ${req.params?.id}:`, {
                error: err.message,
                stack: err.stack,
                customerId: req.params.id
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve customer',
                code: 'SERVER_ERROR'
            });
        }
    },

    async getMe(req, res) {
        try {
            const customerId = req.user?.customer_id;
            if (!customerId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            // Reuse existing handler logic by setting params.id
            req.params = { ...(req.params || {}), id: String(customerId) };
            return await customerController.getCustomerById(req, res);
        } catch (err) {
            logger.error('Failed to retrieve current customer (me):', {
                error: err.message,
                stack: err.stack,
                customerId: req.user?.customer_id
            });
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve customer',
                code: 'SERVER_ERROR'
            });
        }
    },

    async updateMe(req, res) {
        try {
            const customerId = req.user?.customer_id;
            if (!customerId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            // Reuse existing update logic by setting params.id
            req.params = { ...(req.params || {}), id: String(customerId) };
            return await customerController.updateCustomer(req, res);
        } catch (err) {
            logger.error('Failed to update current customer (me):', {
                error: err.message,
                stack: err.stack,
                customerId: req.user?.customer_id
            });
            return res.status(500).json({
                success: false,
                error: 'Failed to update customer',
                code: 'SERVER_ERROR'
            });
        }
    },
    
    async getCustomerWithAddress(req, res) {
        try {
            const customerId = req.user?.customer_id;
            
            if (!customerId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            const result = await Customer.findByIdWithAddresses(customerId);
    
            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Customer not found',
                    code: 'CUSTOMER_NOT_FOUND'
                });
            }
    
            res.json({
                success: true,
                message: 'Customer profile retrieved successfully',
                data: {
                    BasicInfo: result.BasicInfo,
                    addresses: result.addresses 
                }
            });
        } catch (err) {
            logger.error('Get customer with address error:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve customer profile',
                code: 'SERVER_ERROR'
            });
        }
    },
    async updateFullProfile(req, res) {
        try {
            const customerId = req.user?.customer_id;
            
            if (!customerId) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            if (!req.body || typeof req.body !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Request body is required',
                    code: 'MISSING_BODY'
                });
            }
            // 1. Handle Profile Picture
            let profilePictureUrl;
            if (req.file) {
                const [current] = await db.query(
                    'SELECT profile_picture FROM customers WHERE customer_id = ?',
                    [customerId]
                );
                
                profilePictureUrl = await uploadToS3(req.file);
                
                if (current[0]?.profile_picture) {
                    try {
                        await deleteFromS3(current[0].profile_picture);
                    } catch (deleteErr) {
                        logger.warn('Failed to delete old profile picture during full profile update', {
                            error: deleteErr.message,
                            customerId: customerId
                        });
                    }
                }
            }
    
            // 2. Build dynamic update object for customer
            const updateFields = {};
            
            const updatableFields = [
                'first_name',
                'last_name',
                'phone',
                'date_of_birth',
                'gender',
                'isShippingTheSame',
                'customer_type'
            ];
    
            updatableFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateFields[field] = req.body[field];
                }
            });
    
            if (profilePictureUrl) {
                updateFields.profile_picture = profilePictureUrl;
            }
    
            // 3. Update customer if there are fields to update
            if (Object.keys(updateFields).length > 0) {
                await db.query(
                    'UPDATE customers SET ? WHERE customer_id = ?',
                    [updateFields, customerId]
                );
            }
    
            // 4. Handle Address Updates (NEW IMPLEMENTATION)
            if (req.body.addresses) {
                const addresses = typeof req.body.addresses === 'string' 
                    ? JSON.parse(req.body.addresses) 
                    : req.body.addresses;
    
                // Get existing addresses for this customer
                const [existingAddresses] = await db.query(
                    'SELECT address_id FROM addresses WHERE customer_id = ?',
                    [customerId]
                );
    
                const existingAddressIds = existingAddresses.map(a => a.address_id);
                const newAddresses = [];
                const updatedAddressIds = [];
    
                // Process each address in the request
                for (const addr of addresses) {
                    if (addr.address_id && existingAddressIds.includes(addr.address_id)) {
                        // Update existing address
                        await db.query(
                            `UPDATE addresses SET 
                            address_type = ?, recipient_name = ?, address_line1 = ?,
                            address_line2 = ?, city = ?, state = ?,
                            postal_code = ?, country = ?, is_default = ?
                            WHERE address_id = ? AND customer_id = ?`,
                            [
                                addr.address_type,
                                addr.recipient_name,
                                addr.address_line1,
                                addr.address_line2 || null,
                                addr.city,
                                addr.state || null,
                                addr.postal_code,
                                addr.country,
                                addr.is_default ? 1 : 0,
                                addr.address_id,
                                customerId
                            ]
                        );
                        updatedAddressIds.push(addr.address_id);
                    } else {
                        // Collect new addresses for batch insert
                        newAddresses.push([
                            customerId,
                            addr.address_type,
                            addr.recipient_name,
                            addr.address_line1,
                            addr.address_line2 || null,
                            addr.city,
                            addr.state || null,
                            addr.postal_code,
                            addr.country,
                            addr.is_default ? 1 : 0
                        ]);
                    }
                }
    
                // Insert new addresses in batch if any
                if (newAddresses.length > 0) {
                    await db.query(
                        `INSERT INTO addresses 
                        (customer_id, address_type, recipient_name, address_line1, 
                         address_line2, city, state, postal_code, country, is_default)
                        VALUES ?`,
                        [newAddresses]
                    );
                }
    
                // Delete addresses that weren't included in the update (and not referenced elsewhere)
                // First find addresses to delete (those that exist but weren't in the update)
                const addressesToDelete = existingAddressIds.filter(id => !updatedAddressIds.includes(id));
                
                if (addressesToDelete.length > 0) {
                    // Delete only if not referenced in orders (safe delete)
                    await db.query(
                        `DELETE FROM addresses 
                        WHERE address_id IN (?) 
                        AND customer_id = ?
                        AND NOT EXISTS (
                            SELECT 1 FROM orders 
                            WHERE shipping_address_id = addresses.address_id
                        )`,
                        [addressesToDelete, customerId]
                    );
                }
            }
    
            // 5. Return updated profile data
            const [updatedCustomer] = await db.query(
                'SELECT * FROM customers WHERE customer_id = ?',
                [customerId]
            );
            
            const [customerAddresses] = await db.query(
                'SELECT * FROM addresses WHERE customer_id = ?',
                [customerId]
            );
    
            res.json({
                success: true,
                data: {
                    ...updatedCustomer[0],
                    addresses: customerAddresses
                }
            });
    
        } catch (err) {
            logger.error('Update full profile error:', err);
            res.status(500).json({ 
                success: false,
                error: 'Failed to update profile',
                code: 'SERVER_ERROR'
            });
        }
    },
    async deleteCustomer(req, res) {
        try {
            const { id } = req.params || {};
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer ID is required',
                    code: 'VALIDATION_ERROR'
                });
            }

            const customer = await Customer.findById(id);
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    error: 'Customer not found',
                    code: 'CUSTOMER_NOT_FOUND'
                });
            }

            await Customer.softDelete(id);
            
            res.json({
                success: true,
                message: 'Customer deleted successfully',
                data: {
                    customer_id: id,
                    deletion_type: 'soft'
                }
            });
        } catch (err) {
            logger.error(`Failed to delete customer ${req.params?.id}:`, {
                error: err.message,
                stack: err.stack,
                customerId: req.params?.id
            });
            res.status(500).json({
                success: false,
                error: 'Failed to delete customer',
                code: 'SERVER_ERROR'
            });
        }
    },
    async forgotPassword(req, res) {
        try {
            const { username } = req.body || {};
            
            // Validate input
            if (!username) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Email address is required',
                    code: 'EMAIL_REQUIRED'
                });
            }
    
            const user = await User.findByUsername(username);
            
            if (!user) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Email address not found in our system',
                    code: 'EMAIL_NOT_FOUND'
                });
            }
    
            // Create reset token (expires in 1 hour)
            const resetToken = jwt.sign(
                { 
                    customer_id: user.user_id, 
                    action: 'password_reset',
                    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
                },
                process.env.JWT_SECRET
            );
    
            // Create reset link
            const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            
            // Send email
await sendPasswordResetEmail(
    user.username,
    resetLink
);
    
            return res.status(200).json({ 
                success: true,
                message: 'Password reset link has been sent to your email'
            });
    
        } catch (err) {
            logger.error('Password reset error:', {
                error: err.message,
                stack: err.stack,
                input: req.body
            });
            
            return res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    },
    async sendVerificationEmail(req, res) {
        try {
            const { email } = req.body || {};  // Changed from username to email
            
            // Validate input
            if (!email) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Email address is required',
                    code: 'EMAIL_REQUIRED'
                });
            }
    
            const customer = await Customer.findByEmail(email);  // Changed from User.findByname
            
            if (!customer) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Email address not found in our system',
                    code: 'EMAIL_NOT_FOUND'
                });
            }
    
            if (customer.is_email_verified) {  // Changed from is_verified
                return res.status(400).json({ 
                    success: false,
                    error: 'Email is already verified',
                    code: 'ALREADY_VERIFIED'
                });
            }
    
            const verificationToken = jwt.sign(
                { 
                    customer_id: customer.customer_id,  // Changed from user_id
                    action: 'email_verification'
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }  // Added expiration for security
            );
    
            // Create verification link
            const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
            
            // Send verification email
            await sendVerificationEmail(
                customer.email,  // Changed from username
                verificationLink
            );
            
            return res.status(200).json({ 
                success: true,
                message: 'Verification email has been sent'
            });
    
        } catch (err) {
            logger.error('Email verification error:', {
                error: err.message,
                stack: err.stack,
                input: req.body
            });
            
            return res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    },
    async verifyEmail(req, res) {
        try {
            const { token } = req.body || {};
    
            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'Verification token is required',
                    code: 'TOKEN_REQUIRED'
                });
            }
    
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
            if (decoded.action !== 'email_verification') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid token type',
                    code: 'INVALID_TOKEN_TYPE'
                });
            }
    
            // Check if customer exists
            const customer = await Customer.findById(decoded.customer_id);
            
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    error: 'Customer not found',
                    code: 'CUSTOMER_NOT_FOUND'
                });
            }
    
            if (customer.is_email_verified) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is already verified',
                    code: 'ALREADY_VERIFIED'
                });
            }
    
            // Update customer verification status
            const currentDate = new Date();
            await Customer.updateVerificationStatus(
                decoded.customer_id,
                "1", // is_email_verified
                currentDate // email_verified_at
            );
    
            return res.status(200).json({
                success: true,
                message: 'Email successfully verified',
                data: {
                    customer_id: decoded.customer_id,
                    is_email_verified: true,
                    email_verified_at: currentDate
                }
            });
    
        } catch (err) {
            logger.error('Email verification error:', {
                error: err.message,
                stack: err.stack,
                token: req.body.token
            });
    
            if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
                return res.status(400).json({
                    success: false,
                    error: err.name === 'TokenExpiredError' ? 'Verification token has expired' : 'Invalid verification token',
                    code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
                });
            }
    
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
};
customerController.requestPhoneOTP = async (req, res) => {
  try {
    const { phone, channel = 'sms' } = req.body || {};
    const normalized = toE164(phone);
    
    if (!normalized) {
      return res.status(400).json({
        success: false, 
        code: 'BAD_PHONE', 
        error: 'Invalid phone number'
      });
    }

    // Validate channel
    if (channel !== 'sms') {
      return res.status(400).json({
        success: false,
        code: 'UNSUPPORTED_CHANNEL',
        error: 'Only SMS channel is supported'
      });
    }

    // Cool down per phone
    const last = lastSendMap.get(normalized) || 0;
    const now = Date.now();
    if (now - last < COOLDOWN_MS) {
      return res.status(429).json({
        success: false,
        code: 'TOO_MANY_REQUESTS',
        error: 'Please wait before requesting another code',
        retry_after_seconds: Math.ceil((COOLDOWN_MS - (now - last)) / 1000)
      });
    }

    // Send OTP using new SMS service
    const resp = await OTPService.sendOTP(normalized, channel);
    lastSendMap.set(normalized, now);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent',
      data: { 
        to: normalized, 
        channel: resp.channel,
        message: 'SMS sent successfully'
      }
    });

  } catch (err) {
    console.error('OTP request error:', err);
    
    const msg = err?.message || 'Failed to send verification code';
    let status = 500, code = 'SEND_FAILED';
    
    // Handle specific SMS service errors
    if (msg.includes('Failed to send SMS')) {
      status = 500;
      code = 'SMS_SERVICE_ERROR';
    }
    
    return res.status(status).json({ 
      success: false, 
      code, 
      error: msg 
    });
  }
};

customerController.verifyPhoneOTP = async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    const normalized = toE164(phone);
    console.log('🔍 [Verify OTP] Debug info:');
    console.log('📱 Original phone:', phone);
    console.log('📱 Normalized phone:', normalized);
    console.log('🔢 Code received:', code);
    
    if (!normalized || !code) {
      return res.status(400).json({
        success: false, 
        code: 'MISSING_FIELDS', 
        error: 'Phone and code are required'
      });
    }

    const result = await OTPService.checkOTP(normalized, code);
    if (result.status !== 'approved') {
      return res.status(400).json({
        success: false, 
        code: 'BAD_CODE', 
        error: result.reason || 'Invalid or expired code'
      });
    }

    // Tie verification to the logged-in customer
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({
        success: false, 
        code: 'AUTH_REQUIRED', 
        error: 'Authentication required'
      });
    }

    const now = new Date();
    await Customer.update(customerId, {
      is_phone_verified: 1,
      phone_verified_at: now,
      phone: normalized
    });

    const updated = await Customer.findById(customerId);

    return res.status(200).json({
      success: true,
      message: 'Phone verified successfully',
      data: {
        customer_id: customerId,
        phone: normalized,
        is_phone_verified: true,
        phone_verified_at: now,
        customer: updated
      }
    });
  } catch (err) {
    console.error('OTP verification error:', err);
    return res.status(500).json({
      success: false, 
      code: 'VERIFY_FAILED', 
      error: err?.message || 'Phone verification failed'
    });
  }
};

// Extended profile details controllers
customerController.getMyProfileDetails = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Fetch basic customer info
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Fetch profile details
    const CustomerProfileDetails = require('../models/customerProfileDetailsModel');
    const profileDetails = await CustomerProfileDetails.findByCustomerId(customerId);

    // Combine basic customer info with profile details
    const basicInfo = customerController.sanitizeCustomer(customer);
    const completionPercentage = customerController.calculateProfileCompletion(customer, profileDetails);
    
    const response = {
      ...basicInfo,
      location: profileDetails?.location ?? null,
      bio: profileDetails?.bio ?? null,
      social_links: profileDetails?.social_links ?? {},
      created_at: profileDetails?.created_at ?? null,
      updated_at: profileDetails?.updated_at ?? null,
      profile_completion_percentage: completionPercentage
    };

    res.json({
      success: true,
      message: 'Profile details retrieved successfully',
      data: response
    });
  } catch (err) {
    logger.error('Failed to retrieve profile details (me):', {
      error: err.message,
      stack: err.stack,
      customerId: req.user?.customer_id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile details',
      code: 'SERVER_ERROR'
    });
  }
};

customerController.updateMyProfileDetails = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const { file, body } = req || {};
    const requestingUser = req.user;

    // Get existing customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Separate customer fields from profile details fields
    const profileDetailsFields = ['location', 'bio', 'social_links'];
    const customerUpdateData = {};
    const profileDetailsUpdateData = {};

    // Handle file upload if present
    let profilePictureUrl = customer.profile_picture;
    if (file) {
      try {
        const newUrl = await uploadToS3(file);
        
        // Delete old picture if it exists
        if (profilePictureUrl) {
          try {
            await deleteFromS3(profilePictureUrl);
            logger.info('Old profile picture deleted', { customerId: customerId });
          } catch (deleteErr) {
            logger.warn('Failed to delete old profile picture', { 
              error: deleteErr.message,
              customerId: customerId
            });
          }
        }

        profilePictureUrl = newUrl;
        customerUpdateData.profile_picture = profilePictureUrl;
      } catch (uploadErr) {
        logger.error('Profile picture upload failed', { 
          error: uploadErr.message,
          customerId: customerId
        });
        return res.status(500).json({ 
          success: false,
          errors: [{
            field: 'profile_picture',
            message: 'failed to upload profile picture'
          }]
        });
      }
    }

    // Process customer fields
    const allowedCustomerFields = [
      'first_name',
      'last_name',
      'profile_picture',
      'date_of_birth',
      'gender',
      'phone'
    ];

    Object.keys(body || {}).forEach(key => {
      if (!profileDetailsFields.includes(key) && allowedCustomerFields.includes(key)) {
        if (key === 'profile_picture' && !file) {
          // Only allow URL string if no file upload
          customerUpdateData[key] = body[key];
        } else if (key !== 'profile_picture') {
          customerUpdateData[key] = body[key];
        }
      }
    });

    // Field restrictions for non-developers
    if (requestingUser.role_name !== 'developer') {
      const protectedFields = [
        'customer_type',
        'is_email_verified',
        'is_phone_verified',
        'two_factor_enabled',
        'is_kyc_verified',
        'email'
      ];
      protectedFields.forEach(field => delete customerUpdateData[field]);
    }

    // Update customer if there are customer fields to update
    if (Object.keys(customerUpdateData).length > 0) {
      await Customer.update(customerId, customerUpdateData);
    }

    // Process profile details fields
    const CustomerProfileDetails = require('../models/customerProfileDetailsModel');
    const existingProfileDetails = await CustomerProfileDetails.findByCustomerId(customerId);
    
    // Handle social links merging
    let socialLinks = existingProfileDetails?.social_links || {};
    if (body.social_links !== undefined) {
      socialLinks = { ...socialLinks, ...body.social_links };
      // Remove null values (allows clearing individual links)
      Object.keys(socialLinks).forEach(key => {
        if (socialLinks[key] === null) {
          delete socialLinks[key];
        }
      });
    }

    profileDetailsUpdateData.location = body.location !== undefined ? body.location : (existingProfileDetails?.location ?? null);
    profileDetailsUpdateData.bio = body.bio !== undefined ? body.bio : (existingProfileDetails?.bio ?? null);
    profileDetailsUpdateData.social_links = socialLinks;

    // Update profile details if there are profile details fields to update
    const updatedProfileDetails = await CustomerProfileDetails.upsertByCustomerId(customerId, profileDetailsUpdateData);

    // Fetch updated customer info to return combined response
    const updatedCustomer = await Customer.findById(customerId);
    const basicInfo = customerController.sanitizeCustomer(updatedCustomer);
    const completionPercentage = customerController.calculateProfileCompletion(updatedCustomer, updatedProfileDetails);
    
    const response = {
      ...basicInfo,
      location: updatedProfileDetails.location ?? null,
      bio: updatedProfileDetails.bio ?? null,
      social_links: updatedProfileDetails.social_links ?? {},
      created_at: updatedProfileDetails.created_at ?? null,
      updated_at: updatedProfileDetails.updated_at ?? null,
      profile_completion_percentage: completionPercentage
    };

    logger.audit('Profile details updated (me)', {
      userId: req.user.user_id,
      customerId: customerId,
      changedFields: Object.keys(body || {})
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: response
    });
  } catch (err) {
    logger.error('Failed to update profile details (me):', {
      error: err.message,
      stack: err.stack,
      customerId: req.user?.customer_id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'SERVER_ERROR'
    });
  }
};

customerController.getProfileDetailsByCustomerId = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);

    // Fetch basic customer info
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Fetch profile details
    const CustomerProfileDetails = require('../models/customerProfileDetailsModel');
    const profileDetails = await CustomerProfileDetails.findByCustomerId(customerId);

    // Combine basic customer info with profile details
    const basicInfo = customerController.sanitizeCustomer(customer);
    const response = {
      ...basicInfo,
      location: profileDetails?.location ?? null,
      bio: profileDetails?.bio ?? null,
      social_links: profileDetails?.social_links ?? {},
      created_at: profileDetails?.created_at ?? null,
      updated_at: profileDetails?.updated_at ?? null
    };

    res.json({
      success: true,
      message: 'Profile details retrieved successfully',
      data: response
    });
  } catch (err) {
    logger.error('Failed to retrieve profile details by customer ID:', {
      error: err.message,
      stack: err.stack,
      customerId: req.params?.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile details',
      code: 'SERVER_ERROR'
    });
  }
};

customerController.updateProfileDetailsByCustomerId = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);
    const { file, body } = req || {};
    const requestingUser = req.user;

    // Get existing customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND'
      });
    }

    // Separate customer fields from profile details fields
    const profileDetailsFields = ['location', 'bio', 'social_links'];
    const customerUpdateData = {};
    const profileDetailsUpdateData = {};

    // Handle file upload if present
    let profilePictureUrl = customer.profile_picture;
    if (file) {
      try {
        const newUrl = await uploadToS3(file);
        
        // Delete old picture if it exists
        if (profilePictureUrl) {
          try {
            await deleteFromS3(profilePictureUrl);
            logger.info('Old profile picture deleted', { customerId: customerId });
          } catch (deleteErr) {
            logger.warn('Failed to delete old profile picture', { 
              error: deleteErr.message,
              customerId: customerId
            });
          }
        }

        profilePictureUrl = newUrl;
        customerUpdateData.profile_picture = profilePictureUrl;
      } catch (uploadErr) {
        logger.error('Profile picture upload failed', { 
          error: uploadErr.message,
          customerId: customerId
        });
        return res.status(500).json({ 
          success: false,
          errors: [{
            field: 'profile_picture',
            message: 'failed to upload profile picture'
          }]
        });
      }
    }

    // Process customer fields
    const allowedCustomerFields = requestingUser.role_name === 'developer' 
      ? ['first_name', 'last_name', 'profile_picture', 'date_of_birth', 'gender', 'phone', 'email']
      : ['first_name', 'last_name', 'profile_picture', 'date_of_birth', 'gender', 'phone'];

    Object.keys(body || {}).forEach(key => {
      if (!profileDetailsFields.includes(key) && allowedCustomerFields.includes(key)) {
        if (key === 'profile_picture' && !file) {
          // Only allow URL string if no file upload
          customerUpdateData[key] = body[key];
        } else if (key !== 'profile_picture') {
          customerUpdateData[key] = body[key];
        }
      }
    });

    // Field restrictions for non-developers
    if (requestingUser.role_name !== 'developer') {
      const protectedFields = [
        'customer_type',
        'is_email_verified',
        'is_phone_verified',
        'two_factor_enabled',
        'is_kyc_verified',
        'email'
      ];
      protectedFields.forEach(field => delete customerUpdateData[field]);
    }

    // Update customer if there are customer fields to update
    if (Object.keys(customerUpdateData).length > 0) {
      await Customer.update(customerId, customerUpdateData);
    }

    // Process profile details fields
    const CustomerProfileDetails = require('../models/customerProfileDetailsModel');
    const existingProfileDetails = await CustomerProfileDetails.findByCustomerId(customerId);
    
    // Handle social links merging
    let socialLinks = existingProfileDetails?.social_links || {};
    if (body.social_links !== undefined) {
      socialLinks = { ...socialLinks, ...body.social_links };
      // Remove null values (allows clearing individual links)
      Object.keys(socialLinks).forEach(key => {
        if (socialLinks[key] === null) {
          delete socialLinks[key];
        }
      });
    }

    profileDetailsUpdateData.location = body.location !== undefined ? body.location : (existingProfileDetails?.location ?? null);
    profileDetailsUpdateData.bio = body.bio !== undefined ? body.bio : (existingProfileDetails?.bio ?? null);
    profileDetailsUpdateData.social_links = socialLinks;

    // Update profile details if there are profile details fields to update
    const updatedProfileDetails = await CustomerProfileDetails.upsertByCustomerId(customerId, profileDetailsUpdateData);

    // Fetch updated customer info to return combined response
    const updatedCustomer = await Customer.findById(customerId);
    const basicInfo = customerController.sanitizeCustomer(updatedCustomer);
    const response = {
      ...basicInfo,
      location: updatedProfileDetails.location ?? null,
      bio: updatedProfileDetails.bio ?? null,
      social_links: updatedProfileDetails.social_links ?? {},
      created_at: updatedProfileDetails.created_at ?? null,
      updated_at: updatedProfileDetails.updated_at ?? null
    };

    logger.audit('Profile details updated by customer ID', {
      userId: req.user.user_id,
      customerId: customerId,
      changedFields: Object.keys(body || {})
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: response
    });
  } catch (err) {
    logger.error('Failed to update profile details by customer ID:', {
      error: err.message,
      stack: err.stack,
      customerId: req.params?.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = customerController;