const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const errorHandler = require('./middleware/errorHandler');
const customerRoutes = require('./routes/customerRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const talentPoolRoutes = require('./routes/talentPoolRoutes');
const courseAccessRoutes = require('./routes/courseAccessRoutes');
const subsectionRoutes = require('./routes/subsectionQuizRoutes');
const contestRoutes = require('./routes/contestRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const chaptersRoutes = require('./routes/chaptersRoutes');
const sectionsRoutes = require('./routes/sectionsRoutes');
const subsectionsRoutes = require('./routes/subsectionsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const academyRoutes = require('./routes/academyRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const logger = require('./utils/logger');
const app = express();

// 1. Body parsers
app.use(express.json({ limit: '1000kb' }));
app.use(express.urlencoded({ extended: true, limit: '1000kb' }));

// 1.5. Body validation middleware (ensure body exists for POST/PUT/PATCH)
const bodyValidationMiddleware = require('./middleware/bodyValidationMiddleware');
app.use(bodyValidationMiddleware);

// 2. Improved Sanitization Middleware
app.use((req, res, next) => {
  try {
    // Sanitize body if it exists
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = mongoSanitize.sanitize(req.body);
    }
    
    // Sanitize params if they exist
    if (req.params && Object.keys(req.params).length > 0) {
      req.params = mongoSanitize.sanitize(req.params);
    }
    
    // Sanitize query if it exists
    if (req.query && Object.keys(req.query).length > 0) {
      req.query = mongoSanitize.sanitize(req.query);
    }
  } catch (error) {
    logger.error('Sanitization error:', error);
    return res.status(400).json({ 
      error: 'Invalid input data',
      code: 'INPUT_VALIDATION_FAILED'
    });
  }
  next();
});

// 3. Cookie parser
app.use(cookieParser());

// 4. Security Headers
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Feature-Policy', "geolocation 'none'; microphone 'none'; camera 'none'");
  res.setHeader('Permissions-Policy', "geolocation=(), microphone=(), camera=()");
  next();
});

// 5. CORS Configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  maxAge: 86400
}));

// 6. HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['sort', 'page', 'limit']
}));

// 7. CSRF Protection (optional)
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  },
  value: (req) => req.headers['x-csrf-token'] || req.body._csrf
});
// Uncomment if CSRF is needed
// app.use(csrfProtection);

// 8. Request Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} from IP: ${req.ip}`);
  next();
});

// 9. Routes
app.use('/api/auth', authRoutes); 
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/talent-pool', talentPoolRoutes);
app.use('/api/course-access', courseAccessRoutes);
app.use('/api/subsection-quizzes', subsectionRoutes);
app.use('/api/contest', contestRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/chapters', chaptersRoutes);
app.use('/api/sections', sectionsRoutes);
app.use('/api/subsections', subsectionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// 9.5. Simple built-in Google Auth test page (dev utility)
// Visit: GET /tools/google-auth
app.get('/tools/google-auth', (req, res) => {
  try {
    // Relax Helmet defaults for this *single* page so Google's GSI script and popups can work.
    // This is a dev utility route; do not reuse these headers for your main app pages.
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline'",
        // allow inline scripts + Google's GSI client
        "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
        // backend is same-origin; Google scripts may call out
        "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
        "frame-src https://accounts.google.com",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
    // Needed for popup-based sign-in to work in modern browsers.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const htmlPath = path.join(__dirname, 'tools', 'google-auth.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Inject GOOGLE_CLIENT_ID so the Google button works without hardcoding it into the HTML.
    // (Client ID is public; do NOT inject client secret.)
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    html = html.replaceAll('__GOOGLE_CLIENT_ID__', clientId);

    return res.status(200).send(html);
  } catch (error) {
    logger.error('tools/google-auth error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load google auth test page' });
  }
});

// 10. Health Check Routes
// Comprehensive health check with service status
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services: {}
    };

    // Check Database
    try {
      const db = require('./config/database');
      const [rows] = await db.query('SELECT 1 as healthy');
      health.services.database = {
        status: 'healthy',
        message: 'Database connection successful'
      };
    } catch (dbError) {
      health.services.database = {
        status: 'unhealthy',
        message: dbError.message
      };
      health.status = 'degraded';
    }

    // Check Redis
    try {
      const authMiddleware = require('./middleware/authMiddleware');
      const redisClient = authMiddleware.redisClient;
      
      if (!redisClient) {
        health.services.redis = {
          status: 'unhealthy',
          message: 'Redis client not initialized'
        };
        health.status = 'degraded';
      } else {
        // Try to ping Redis - this is the most reliable check
        await redisClient.ping();
        health.services.redis = {
          status: 'healthy',
          message: 'Redis connection successful'
        };
      }
    } catch (redisError) {
      health.services.redis = {
        status: 'unhealthy',
        message: redisError.message || 'Redis connection failed'
      };
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      message: error.message
    });
  }
});

// Simple health check endpoint
app.get('/api/health/simple', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Simple health check error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      status: 'error',
      error: 'Health check failed'
    });
  }
});

// Root health check for convenience
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      message: 'Server is running',
      note: 'Use /api/health for detailed health check with service status'
    };
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      status: 'error',
      error: 'Health check failed'
    });
  }
});

// 11. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND'
  });
});

// 12. Error Handling Middleware
app.use(errorHandler);

module.exports = app;

