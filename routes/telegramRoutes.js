const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');
const telegramValidator = require('../validators/telegramValidator');
const validate = require('../middleware/validationMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @route   POST /api/telegram/request-link-code
 * @desc    Return instructions for starting the bot-driven link flow
 * @access  Authenticated Hive888 user
 */
router.post(
  '/request-link-code',
  authMiddleware.authenticate,
  validate,
  telegramController.requestLinkCode
);

/**
 * @route   POST /api/telegram/confirm-link
 * @desc    Confirm a Telegram link code from the logged-in hub account
 * @access  Authenticated Hive888 user
 */
router.post(
  '/confirm-link',
  authMiddleware.authenticate,
  telegramValidator.confirmLinkValidation,
  validate,
  telegramController.confirmLink
);

/**
 * @route   GET /api/telegram/link-status
 * @desc    Get Telegram link status for the logged-in user
 * @access  Authenticated Hive888 user
 */
router.get(
  '/link-status',
  authMiddleware.authenticate,
  validate,
  telegramController.getLinkStatus
);

/**
 * @route   POST /api/telegram/unlink
 * @desc    Unlink Telegram from the logged-in Hive888 account
 * @access  Authenticated Hive888 user
 */
router.post(
  '/unlink',
  authMiddleware.authenticate,
  validate,
  telegramController.unlink
);

/**
 * @route   GET /api/telegram/check/:telegram_user_id
 * @desc    Check whether a Telegram user is linked to an active Hive888 account
 * @access  Public/internal bot use
 */
router.get(
  '/check/:telegram_user_id',
  telegramValidator.checkValidation,
  validate,
  telegramController.check
);

module.exports = router;

