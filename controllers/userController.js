const User = require('../models/User');
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { sendPasswordResetEmail } = require('../utils/email');
const { v4: uuidv4 } = require('uuid');

function getFrontendBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.FRONTENDHIVE_URL ||
    process.env.BASE_URL ||
    'http://localhost:3000'
  );
}

function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
}

const userController = {
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
    async forgotPassword(req, res) {
        try {
            const { username, email } = req.body || {};
            const identifier = (email || username || '').trim();
            
            // Validate input
            if (!identifier) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Email address is required',
                    code: 'EMAIL_REQUIRED'
                });
            }
    
            const user = await User.findByUsername(identifier);
    
            // Create reset token (expires in 1 hour)
            if (user) {
                const resetToken = jwt.sign(
                    { 
                        user_id: user.user_id,
                        action: 'password_reset'
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '1h' }
                );

                // Create reset link
                const resetLink = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}`;
                
                // Send email
                await sendPasswordResetEmail(user.username, resetLink);

                logger.info('Password reset email sent', { username: user.username, userId: user.user_id });
            } else {
                // Do not leak whether a user exists
                logger.info('Password reset requested for non-existent email (masked)', { identifier });
            }
    
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
    
    async resetPassword  (req, res)  {
        try {
          const { token, password, newPassword } = req.body || {};
          const nextPassword = (password || newPassword || '');
      
          if (!token || !nextPassword) {
            return res.status(400).json({
              success: false,
              error: 'Token and new password are required',
              code: 'VALIDATION_ERROR'
            });
          }

          if (!isStrongPassword(nextPassword)) {
            return res.status(400).json({
              success: false,
              error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number',
              code: 'WEAK_PASSWORD'
            });
          }
      
          // Step 1: Verify the JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
          // Step 2: Check if this is a password reset token
          if (decoded.action !== 'password_reset') {
            return res.status(400).json({
              success: false,
              error: 'Invalid token type',
              code: 'INVALID_TOKEN_TYPE'
            });
          }
      
          // Step 3: Find the user in database
          const user = await User.findById(decoded.user_id);
          if (!user) {
            return res.status(404).json({
              success: false,
              error: 'User not found',
              code: 'USER_NOT_FOUND'
            });
          }
      
          // Step 4: Hash the new password
          const saltRounds = 10;
          const hashedPassword = await bcrypt.hash(nextPassword, saltRounds);
      
          // Step 5: Update user's password and increment token version
          await User.update(user.user_id, {
            password_hash: hashedPassword
          });
      
          return res.status(200).json({
            success: true,
            message: 'Password has been reset successfully'
          });
      
        } catch (error) {
          // Handle different error cases
          if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
              success: false,
              error: 'Reset link has expired',
              code: 'TOKEN_EXPIRED'
            });
          }
          
          if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({
              success: false,
              error: 'Invalid token',
              code: 'INVALID_TOKEN'
            });
          }
      
          logger.error('Reset password error:', {
            error: error.message,
            stack: error.stack
          });
          return res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
          });
        }
      },
    async createUser(req, res) {
        try {
            const { username, password, role_id, customer_id } = req.body || {};
    
            // Validate required fields
            if (!username || !password || !role_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    message: 'Username, password and role_id are required',
                    code: 'VALIDATION_ERROR'
                });
            }
    
            // Check if username exists
            const existingUser = await User.findByUsername(username);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: 'Duplicate username',
                    message: 'Username already exists'
                });
            }
    
            // Hash password
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(password, saltRounds);
    
            // Build user object with only defined values
            const userData = {
                user_id: uuidv4(),
                username,
                password_hash,
                role_id
            };
    
            // Only add customer_id if provided
            if (customer_id) {
                userData.customer_id = customer_id;
            }
    
            const result = await User.create(userData);
    
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    user_id: userData.user_id
                }
            });
        } catch (err) {
            logger.error('User creation failed:', err);
            
            // Handle specific MySQL errors
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid reference',
                    message: 'The specified role_id does not exist'
                });
            }
    
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: 'Failed to create user',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    },
    async getAllUsers(req, res) {
        try {
            // Get pagination parameters from query (default values provided)
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
    
            // Get optional filter parameters
            const { role_id, username } = req.query;
    
            // Get users from model
            const { users, totalCount } = await User.findAll({
                limit,
                offset,
                role_id,
                username
            });
    
            // Remove password hashes from the response
            const sanitizedUsers = users.map(user => {
                const { password_hash, ...userWithoutPassword } = user;
                return userWithoutPassword;
            });
    
            res.json({
                success: true,
                message: 'Users retrieved successfully',
                data: {
                    users: sanitizedUsers,
                    pagination: {
                        total: totalCount,
                        page,
                        limit,
                        totalPages: Math.ceil(totalCount / limit)
                    }
                }
            });
        } catch (err) {
            logger.error('Failed to retrieve users:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: 'Failed to retrieve users'
            });
        }
    },

    async getUser(req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Not Found',
                    message: 'User not found'
                });
            }

            // Don't return password hash
            delete user.password_hash;

            res.json({
                success: true,
                message: 'User retrieved successfully',
                data: user
            });
        } catch (err) {
            logger.error(`Failed to retrieve user ${req.params.id}:`, err);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user',
                message: 'Error fetching user details'
            });
        }
    },

    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body || {};

            if (!updateData || Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Bad Request',
                    message: 'No fields provided for update',
                    code: 'VALIDATION_ERROR'
                });
            }

            // Check if user exists
            const existingUser = await User.findById(id);
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Not Found',
                    message: 'User not found'
                });
            }

            // Handle password update
            if (updateData.password) {
                const saltRounds = 10;
                updateData.password_hash = await bcrypt.hash(updateData.password, saltRounds);
                delete updateData.password;
            }

            const result = await User.update(id, updateData);

            // Get updated user data
            const updatedUser = await User.findById(id);
            delete updatedUser.password_hash;

            res.json({
                success: true,
                message: 'User updated successfully',
                data: updatedUser
            });
        } catch (err) {
            logger.error(`Failed to update user ${req.params.id}:`, err);
            res.status(500).json({
                success: false,
                error: 'Failed to update user',
                message: 'Error updating user'
            });
        }
    },
    async  hashPassword(password) {
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    },
    async sendEmail({ to, subject, html }) {
        const nodemailer = require('nodemailer');
        
        console.log('[Email] Creating transporter for:', 'mail.ptgr-test.com:465');
        
        const transporter = nodemailer.createTransport({
            host: 'mail.ptgr-test.com',
            port: 465,
            secure: true,
            auth: {
                user: 'info@ptgr-test.com',
                pass: '6.E-6F9ufjv(YF2w#@PD'
            },
            logger: true, // This will output SMTP logs to console
            debug: true,  // More verbose debugging
            tls: {
                rejectUnauthorized: false
            }
        });
    
        console.log('[Email] Preparing mail options for:', to);
        
        const mailOptions = {
            from: '"PTGR AG" <info@ptgr-test.com>',
            to,
            subject,
            html
        };
    
        console.log('[Email] Sending email...');
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log('[Email] Transport completed. Message ID:', info.messageId);
        console.log('[Email] Envelope:', info.envelope);
        
        return info;
    },
  
    async getAllRoles(req, res) {
        try {
            // Hardcoded test response
            return res.status(200).json({
                success: true,
                data: [
                    { role_id: 'test1', role_name: 'admin' },
                    { role_id: 'test2', role_name: 'user' }
                ]
            });
            
            // const [roles] = await db.query('SELECT role_id, role_name FROM roles ORDER BY role_name');
            // ... rest of the original code
        } catch (err) {
            // ... error handling
        }
    },
    async createRole(req, res) {
        try {
            const { role_name } = req.body || {};
            
            if (!role_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Role name is required'
                });
            }
            
            // Check if role already exists
            const existingRole = await User.findRoleByName(role_name);
            if (existingRole) {
                return res.status(409).json({
                    success: false,
                    error: 'Role already exists'
                });
            }
            
            const newRole = await User.createRole(role_name);
            
            res.status(201).json({
                success: true,
                message: 'Role created successfully',
                data: newRole
            });
            
        } catch (err) {
            logger.error('Role creation failed:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to create role'
            });
        }
    },
    
    /**
     * Get role statistics (count of users per role)
     */
    async getRoleStatistics(req, res) {
        try {
            const roleStats = await User.getRoleStatistics();
            
            res.json({
                success: true,
                message: 'Role statistics retrieved successfully',
                data: roleStats
            });
            
        } catch (err) {
            logger.error('Failed to get role statistics:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve role statistics'
            });
        }
    },
    
    // Replace the existing getAllRoles with this enhanced version
    async getAllRoles(req, res) {
        try {
            const roles = await User.findAllRoles();
            
            res.json({
                success: true,
                message: 'Roles retrieved successfully',
                data: roles
            });
            
        } catch (err) {
            logger.error('Failed to retrieve roles:', err);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve roles'
            });
        }
    }


 
};

module.exports = userController;