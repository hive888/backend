/**
 * AI Routes
 * Routes for AI-powered features
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiting for AI endpoints (100 requests per hour)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip trust proxy validation warning since we've configured it securely in app.js
  validate: {
    trustProxy: false
  }
});

// All AI routes require authentication and the administrator role
router.use(authMiddleware.authenticate);
router.use(authMiddleware.authorize('administrator'));
router.use(aiRateLimiter);

/**
 * Analyze Request
 * POST /api/admin/swafri/ai/analyze-request
 */
router.post('/analyze-request', aiController.analyzeRequest);

/**
 * Match Talents with AI
 * POST /api/admin/swafri/ai/match-talents
 */
router.post('/match-talents', aiController.matchTalents);

/**
 * Analyze CV
 * POST /api/admin/swafri/ai/analyze-cv
 */
router.post('/analyze-cv', aiController.analyzeCV);

/**
 * Generate AI Insights
 * GET /api/admin/swafri/ai/insights/:request_type/:request_id
 */
router.get('/insights/:request_type/:request_id', aiController.generateInsights);

/**
 * Batch Match Multiple Requests
 * POST /api/admin/swafri/ai/batch-match
 */
router.post('/batch-match', aiController.batchMatch);

/**
 * Update Talent Profile from CV
 * POST /api/admin/swafri/ai/update-talent-from-cv
 */
router.post('/update-talent-from-cv', aiController.updateTalentFromCV);

// Interactive Wizard Routes
const aiWizardController = require('../controllers/aiWizardController');

/**
 * Start Wizard Conversation
 * POST /api/admin/swafri/ai/wizard/start
 */
router.post('/wizard/start', aiWizardController.startWizard);

/**
 * Continue Wizard Conversation
 * POST /api/admin/swafri/ai/wizard/continue
 */
router.post('/wizard/continue', aiWizardController.continueWizard);

/**
 * Execute Wizard Action
 * POST /api/admin/swafri/ai/wizard/execute
 */
router.post('/wizard/execute', aiWizardController.executeAction);

/**
 * Get Conversation History
 * GET /api/admin/swafri/ai/wizard/history/:session_id
 */
router.get('/wizard/history/:session_id', aiWizardController.getHistory);

module.exports = router;

