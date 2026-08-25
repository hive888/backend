const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const chatController = require('../controllers/chatController');

const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 messages per IP per window
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many chat messages, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
  },
});

router.use(chatRateLimiter);

router.post('/', chatController.sendMessage);

module.exports = router;
