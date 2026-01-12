const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const logger = require('../utils/logger');
const User = require('../models/User');

class AuthMiddleware {
  constructor() {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.initializeRedis();
  }

  async initializeRedis() {
    this.redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    await this.redisClient.connect();
    logger.info('Redis connected successfully');
  }

  // Main authentication method
  authenticate = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return this.sendError(res, 401, 'No token provided', 'NO_AUTH_TOKEN');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (await this.isTokenRevoked(token)) {
        this.logSecurityEvent('Revoked token usage', decoded.user_id, req.ip);
        return this.sendError(res, 401, 'Session expired', 'TOKEN_REVOKED');
      }

      req.user = decoded;
      next();
    } catch (err) {
      this.handleAuthError(err, res);
    }
  };

  // Refresh token verification
  verifyRefreshToken = async (req, res, next) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return this.sendError(res, 401, 'Refresh token required', 'NO_REFRESH_TOKEN');
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      if (await this.isRefreshTokenRevoked(refreshToken)) {
        this.logSecurityEvent('Revoked refresh attempt', decoded.user_id, req.ip);
        return this.sendError(res, 401, 'Session expired', 'REFRESH_TOKEN_REVOKED');
      }

      req.user = decoded;
      next();
    } catch (err) {
      this.handleAuthError(err, res);
    }
  };

  // Token revocation methods
  revokeToken = async (token) => {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return false;

      const ttl = this.calculateTokenTTL(decoded.exp);
      await this.redisClient.set(`blacklist:${token}`, '1', { EX: ttl });
      return true;
    } catch (err) {
      logger.error('Token revocation failed:', err);
      return false;
    }
  };

  revokeRefreshToken = async (token) => {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return false;

      const ttl = this.calculateTokenTTL(decoded.exp);
      await this.redisClient.set(`blacklist:refresh:${token}`, '1', { EX: ttl });
      return true;
    } catch (err) {
      logger.error('Refresh token revocation failed:', err);
      return false;
    }
  };

  // Authorization middleware
authorize = (required = []) => {
  if (typeof required === 'string') required = [required];

  // normalize required roles once
  const requiredNorm = required.map(r => r.toLowerCase());

  return (req, res, next) => {
    // extract user roles from token
    const tokenRoles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : (req.user?.role_name
          ? String(req.user.role_name).split(',').map(s => s.trim()).filter(Boolean)
          : []);

    if (!tokenRoles.length) {
      return this.sendError(res, 401, 'Not authenticated', 'NOT_AUTHENTICATED');
    }

    // normalize user roles
    const userNorm = tokenRoles.map(r => r.toLowerCase());

    // allow if any required role is present
    const allowed = requiredNorm.length === 0
      ? true
      : requiredNorm.some(r => userNorm.includes(r));

    if (!allowed) {
      return this.sendError(res, 403, 'Forbidden', 'FORBIDDEN');
    }

    next();
  };
};


  // ========== UTILITY METHODS ==========
  isTokenRevoked = async (token) => {
    try {
      return await this.redisClient.get(`blacklist:${token}`) === '1';
    } catch (err) {
      logger.error('Token revocation check failed:', err);
      return false;
    }
  };

  isRefreshTokenRevoked = async (token) => {
    try {
      return await this.redisClient.get(`blacklist:refresh:${token}`) === '1';
    } catch (err) {
      logger.error('Refresh token check failed:', err);
      return false;
    }
  };

  sendError = (res, status, error, code) => {
    return res.status(status).json({ 
      success: false,
      error,
      code 
    });
  };

  handleAuthError = (err, res) => {
    const code = err.name === 'TokenExpiredError' 
      ? 'TOKEN_EXPIRED' 
      : 'INVALID_TOKEN';
    
    res.status(401).json({ 
      success: false,
      error: err.message,
      code
    });
  };

  logSecurityEvent = (message, userId, ip) => {
    if (typeof logger.security === 'function') {
      logger.security(message, { userId, ip });
    } else {
      logger.error(`SECURITY: ${message}`, { userId, ip });
    }
  };

  calculateTokenTTL = (exp) => {
    return exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 86400;
  };
}

// Initialize and export
const authMiddleware = new AuthMiddleware();

module.exports = {
  authenticate: authMiddleware.authenticate.bind(authMiddleware),
  verifyRefreshToken: authMiddleware.verifyRefreshToken.bind(authMiddleware),
  authorize: authMiddleware.authorize.bind(authMiddleware),
  revokeToken: authMiddleware.revokeToken.bind(authMiddleware),
  revokeRefreshToken: authMiddleware.revokeRefreshToken.bind(authMiddleware)
};