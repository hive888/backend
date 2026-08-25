const { body, param } = require('express-validator');

const telegramValidator = {
  confirmLinkValidation: [
    body('code')
      .trim()
      .notEmpty().withMessage('code is required')
      .isLength({ min: 6, max: 12 }).withMessage('code must be 6-12 characters')
      .matches(/^[A-Za-z0-9]+$/).withMessage('code must be alphanumeric')
  ],

  checkValidation: [
    param('telegram_user_id')
      .notEmpty().withMessage('telegram_user_id is required')
      .isInt({ min: 1 }).withMessage('telegram_user_id must be a positive integer')
  ]
};

module.exports = telegramValidator;

