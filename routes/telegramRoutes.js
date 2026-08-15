const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');
const telegramValidator = require('../validators/telegramValidator');
const validate = require('../middleware/validationMiddleware');

/**
 * @route   POST /api/telegram/register
 * @desc    Register a new customer from Telegram
 * @access  Public (used internally by bot)
 */
router.post(
  '/register',
  telegramValidator.registerValidation,
  validate,
  telegramController.register
);

/**
 * @route   POST /api/telegram/link
 * @desc    Link Telegram account to existing customer
 * @access  Public (used internally by bot)
 */
router.post(
  '/link',
  telegramValidator.linkValidation,
  validate,
  telegramController.link
);

/**
 * @route   POST /api/telegram/request-code
 * @desc    Request verification code for linking
 * @access  Public (used internally by bot)
 */
router.post(
  '/request-code',
  telegramValidator.requestCodeValidation,
  validate,
  telegramController.requestCode
);

/**
 * @route   GET /api/telegram/check/:telegram_user_id
 * @desc    Check if Telegram user is registered
 * @access  Public (used internally by bot)
 */
router.get(
  '/check/:telegram_user_id',
  telegramValidator.checkValidation,
  validate,
  telegramController.check
);

module.exports = router;

