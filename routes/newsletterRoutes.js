const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const newsletterController = require('../controllers/newsletterController');

// Public routes - no authentication required
router.post('/subscribe', newsletterController.subscribe);
router.post('/unsubscribe', newsletterController.unsubscribe);

// Admin routes - require authentication
router.get('/subscribers', authMiddleware.authenticate, newsletterController.getSubscribers);

module.exports = router;

