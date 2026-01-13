const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const Customer = require('../models/Customer');
const { OAuth2Client } = require('google-auth-library');
const authValidator = require('../validators/authValidator');
const validate = require('../middleware/validationMiddleware');
const crypto = require('crypto');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
    logger.warn('GOOGLE_CLIENT_ID is not set. Google authentication will not work until it is configured.');
}
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Helper function to build user payload for JWT
const buildUserPayload = (user, customer) => {
    const roles = Array.isArray(user.roles)
        ? user.roles
        : (user.role_name ? String(user.role_name).split(',').map(s => s.trim()).filter(Boolean) : []);

    return {
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id,
        role_name: roles.join(','),
        roles,
        first_name: customer?.first_name || '',
        last_name: customer?.last_name || '',
        is_email_verified: customer?.is_email_verified ?? 0,
        is_kyc_verified: customer?.is_kyc_verified ?? 0,
        profile_picture: customer?.profile_picture || '',
        customer_id: user.customer_id || null,
        phone: customer?.phone || null,
        phoneVerifid: customer?.is_phone_verified || null
    };
};

// Helper function to build a public (sanitized) user object for API responses
// We keep internal identifiers/roles inside the JWT, but we avoid returning them directly in responses.
const buildPublicUser = (user, customer) => {
    return {
        customer_id: user?.customer_id ?? null,
        email: user?.username ?? null,
        first_name: customer?.first_name || '',
        last_name: customer?.last_name || '',
        profile_picture: customer?.profile_picture || '',
        phone: customer?.phone || null,
        is_email_verified: customer?.is_email_verified ?? 0,
        is_phone_verified: customer?.is_phone_verified ?? 0,
        is_kyc_verified: customer?.is_kyc_verified ?? 0
    };
};

// Login endpoint
router.post('/login', authValidator.loginValidation, validate, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findByUsername(username);
        
        if (!user) {
            logger.warn(`Login attempt with non-existent username: ${username}`, { ip: req.ip });
            return res.status(401).json({ 
                success: false,
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            logger.warn(`Failed login attempt for user: ${username}`, { 
                userId: user.user_id,
                ip: req.ip 
            });
            return res.status(401).json({ 
                success: false,
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Fetch customer data
        const customer = await Customer.findById(user.customer_id);
        if (!customer) {
            logger.error(`Customer not found for user: ${user.user_id}`);
            return res.status(500).json({
                success: false,
                error: 'User data incomplete',
                code: 'DATA_INTEGRITY_ERROR'
            });
        }

        // Build payload
        const payload = buildUserPayload(user, customer);
        const publicUser = buildPublicUser(user, customer);

        // Generate tokens
        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Log successful login
        logger.info(`User logged in successfully: ${username}`, {
            userId: user.user_id,
            ip: req.ip
        });

        // Return response
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken,
                refreshToken,
                user: publicUser
            }
        });

    } catch (err) {
        logger.error('Login error:', {
            error: err.message,
            stack: err.stack,
            username: req.body?.username
        });
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Refresh token endpoint with token rotation
router.post('/refresh', authValidator.refreshTokenValidation, validate, authMiddleware.verifyRefreshToken, async (req, res) => {
    try {
        const { refreshToken: oldRefreshToken } = req.body;

        // Fetch latest user and customer data to ensure tokens have current information
        const user = await User.findById(req.user.user_id);
        if (!user) {
            logger.warn(`Token refresh attempted for non-existent user: ${req.user.user_id}`);
            return res.status(401).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        const customer = await Customer.findById(user.customer_id);
        if (!customer) {
            logger.error(`Customer not found for user during token refresh: ${user.user_id}`);
            return res.status(500).json({
                success: false,
                error: 'User data incomplete',
                code: 'DATA_INTEGRITY_ERROR'
            });
        }

        // Build fresh payload with latest user data
        const payload = buildUserPayload(user, customer);
        const publicUser = buildPublicUser(user, customer);

        // Generate new access token
        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Generate new refresh token (token rotation for security)
        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Revoke old refresh token (token rotation)
        await authMiddleware.revokeRefreshToken(oldRefreshToken);

        // Security logging
        logger.info(`Token refreshed for user ${req.user.user_id}`, {
            userId: req.user.user_id,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken,
                refreshToken,
                user: publicUser
            }
        });
    } catch (err) {
        logger.error('Refresh token processing error:', {
            error: err.message,
            stack: err.stack,
            userId: req.user?.user_id,
            endpoint: '/refresh'
        });
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Logout endpoint
router.post('/logout', authMiddleware.authenticate, authValidator.logoutValidation, validate, async (req, res) => {
    try {
        const accessToken = req.header('Authorization')?.replace('Bearer ', '');
        const { refreshToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'No access token provided',
                code: 'NO_ACCESS_TOKEN'
            });
        }

        // Revoke both tokens simultaneously
        const [accessRevoked, refreshRevoked] = await Promise.all([
            authMiddleware.revokeToken(accessToken),
            authMiddleware.revokeRefreshToken(refreshToken)
        ]);

        if (!accessRevoked || !refreshRevoked) {
            logger.warn(`Partial token revocation - access: ${accessRevoked}, refresh: ${refreshRevoked}`, {
                userId: req.user?.user_id,
                ip: req.ip
            });
        }

        // Log security event
        logger.info(`User logged out: ${req.user.user_id}`, {
            userId: req.user.user_id,
            ip: req.ip,
            accessTokenRevoked: accessRevoked,
            refreshTokenRevoked: refreshRevoked
        });

        res.json({
            success: true,
            message: 'Successfully logged out',
            data: {
                accessTokenRevoked: accessRevoked,
                refreshTokenRevoked: refreshRevoked
            }
        });

    } catch (err) {
        logger.error('Logout error:', {
            error: err.message,
            stack: err.stack,
            userId: req.user?.user_id,
            ip: req.ip
        });
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            code: 'LOGOUT_ERROR'
        });
    }
});
router.post('/check-static-password', async (req, res) => {
    try {
        // Check if request body exists
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ 
                success: false,
                error: 'Request body is required',
                code: 'MISSING_BODY'
            });
        }

        const { password } = req.body || {};

        // Validate input
        if (!password) {
            return res.status(400).json({ 
                success: false,
                error: 'Password is required',
                code: 'VALIDATION_ERROR'
            });
        }

        // MD5 hash of the static password "PTGR2025!"
        const staticPasswordMd5 = '08836cc0be8a5b90cc64ad60bb0eeb4a'; // MD5 hash of "PTGR2025!"

        // Create MD5 hash of the provided password
        const crypto = require('crypto');
        const providedPasswordMd5 = crypto.createHash('md5').update(password).digest('hex');

        // Compare the hashes
        if (providedPasswordMd5 === staticPasswordMd5) {
            return res.json({
                success: true,
                message: 'Password matches'
            });
        } else {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid password',
                code: 'INVALID_PASSWORD'
            });
        }

    } catch (err) {
        logger.error('Static password check error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});
// Protected test endpoint
router.get('/test-protected', authMiddleware.authenticate, (req, res) => {
    res.json({
        success: true,
        message: 'You have accessed a protected route',
        user: req.user
    });
});
router.post('/google-login', authValidator.googleLoginValidation, validate, async (req, res) => {
    try {
        const { token } = req.body;

        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name, sub, picture } = payload || {};

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Google token does not include an email address',
                code: 'GOOGLE_EMAIL_MISSING'
            });
        }

        // Check if user exists by email
        let user = await User.findByEmail(email);
        let customer = null;
        let isNewUser = false;

        // If user doesn't exist, create customer + user (Google signup)
        if (!user) {
            isNewUser = true;
            logger.info(`Google signup initiated for: ${email}`, { ip: req.ip });

            // IMPORTANT: customers.phone is UNIQUE and NOT NULL. We must create a unique placeholder phone.
            const placeholderPhone = sub ? `google_${sub}` : `google_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

            try {
                customer = await Customer.create({
                    email,
                    phone: placeholderPhone,
                    first_name: given_name || 'Google',
                    last_name: family_name || '',
                    profile_picture: picture || null,
                    is_email_verified: 1,
                    source: 'google'
                });
            } catch (createCustomerErr) {
                // If email already exists, fetch existing customer and continue
                if (createCustomerErr?.code === 'ER_DUP_ENTRY') {
                    customer = await Customer.findByEmail(email);
                } else {
                    throw createCustomerErr;
                }
            }

            if (!customer) {
                return res.status(500).json({
                    success: false,
                    error: 'Account creation failed',
                    code: 'SIGNUP_ERROR'
                });
            }

            // Create matching user account if missing
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const password_hash = await bcrypt.hash(randomPassword, 10);

            try {
                await User.create({
                    customer_id: customer.customer_id,
                    username: email,
                    password_hash
                    // role_id omitted -> DB default role_id will apply
                });
            } catch (createUserErr) {
                // If username already exists, we can proceed as login
                if (createUserErr?.code !== 'ER_DUP_ENTRY') {
                    throw createUserErr;
                }
            }

            user = await User.findByEmail(email);
        }

        if (!user) {
            return res.status(500).json({
                success: false,
                error: 'Authentication failed',
                code: 'AUTH_ERROR'
            });
        }

        // Fetch customer data
        if (!customer) {
            customer = await Customer.findById(user.customer_id);
        }
        if (!customer) {
            logger.error(`Customer not found for user during Google login: ${user.user_id}`);
            return res.status(500).json({
                success: false,
                error: 'Customer record missing',
                code: 'DATA_INTEGRITY_ERROR'
            });
        }

        // Build payload using helper function
        const jwtPayload = buildUserPayload(user, customer);
        const publicUser = buildPublicUser(user, customer);

        // Generate tokens
        const accessToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        const refreshToken = jwt.sign(jwtPayload, process.env.JWT_REFRESH_SECRET, {
            expiresIn: '7d'
        });

        logger.info(`Google login successful for user: ${email}`, {
            userId: user.user_id,
            ip: req.ip
        });

        res.json({
            success: true,
            message: isNewUser ? 'Google signup successful' : 'Google login successful',
            data: {
                accessToken,
                refreshToken,
                user: publicUser,
                isNewUser
            }
        });

    } catch (err) {
        logger.error('Google login error:', {
            error: err.message,
            stack: err.stack,
            ip: req.ip
        });
        res.status(500).json({
            success: false,
            error: 'Google login failed',
            code: 'GOOGLE_AUTH_ERROR'
        });
    }
});
module.exports = router;