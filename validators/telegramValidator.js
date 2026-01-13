const { body, param } = require('express-validator');

const telegramValidator = {
  registerValidation: [
    body('telegram_user_id')
      .notEmpty().withMessage('telegram_user_id is required')
      .isInt({ min: 1 }).withMessage('telegram_user_id must be a positive integer'),
    
    body('telegram_username')
      .optional()
      .trim()
      .isLength({ max: 255 }).withMessage('telegram_username must be less than 255 characters'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('email is required')
      .isEmail().withMessage('invalid email format')
      .normalizeEmail({ gmail_remove_dots: false })
      .isLength({ max: 255 }).withMessage('email must be less than 255 characters'),
    
    body('phone')
      .trim()
      .notEmpty().withMessage('phone is required')
      .isLength({ min: 8, max: 20 }).withMessage('phone number must be between 8 and 20 characters'),
    
    body('first_name')
      .trim()
      .notEmpty().withMessage('first_name is required')
      .isLength({ min: 1, max: 100 }).withMessage('first_name must be between 1 and 100 characters'),
    
    body('last_name')
      .trim()
      .notEmpty().withMessage('last_name is required')
      .isLength({ min: 1, max: 100 }).withMessage('last_name must be between 1 and 100 characters')
  ],

  linkValidation: [
    body('telegram_user_id')
      .notEmpty().withMessage('telegram_user_id is required')
      .isInt({ min: 1 }).withMessage('telegram_user_id must be a positive integer'),
    
    body('telegram_username')
      .optional()
      .trim()
      .isLength({ max: 255 }).withMessage('telegram_username must be less than 255 characters'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('email is required')
      .isEmail().withMessage('invalid email format')
      .normalizeEmail({ gmail_remove_dots: false }),
    
    body('code')
      .trim()
      .notEmpty().withMessage('code is required')
      .isLength({ min: 6, max: 6 }).withMessage('code must be 6 digits')
      .matches(/^\d{6}$/).withMessage('code must be 6 digits')
  ],

  requestCodeValidation: [
    body('telegram_user_id')
      .notEmpty().withMessage('telegram_user_id is required')
      .isInt({ min: 1 }).withMessage('telegram_user_id must be a positive integer'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('email is required')
      .isEmail().withMessage('invalid email format')
      .normalizeEmail({ gmail_remove_dots: false })
  ],

  checkValidation: [
    param('telegram_user_id')
      .notEmpty().withMessage('telegram_user_id is required')
      .isInt({ min: 1 }).withMessage('telegram_user_id must be a positive integer')
  ]
};

module.exports = telegramValidator;

