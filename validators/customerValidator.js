const { body, param, query } = require('express-validator');

const genders = ['male', 'female', 'other', 'prefer_not_to_say'];
const customerTypes = ['individual', 'enterprise'];

const customerValidator = {
  createCustomerValidation: [
    body('email')
      .trim()
      .notEmpty().withMessage('email is required')
      .isEmail().withMessage('invalid email format')
      .normalizeEmail({ gmail_remove_dots: false })
      .isLength({ max: 255 }).withMessage('email must be less than 255 characters'),
    
    body('phone')
      .trim()
      .notEmpty().withMessage('phone is required')
      .isLength({ min: 8, max: 20 }).withMessage('phone number must be between 8 and 20 characters')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('invalid phone number format')
      .custom(value => {
        if (value.length === 10) {
          throw new Error('phone number length cannot be exactly 10 characters');
        }
        return true;
      }),
    
    body('first_name')
      .trim()
      .notEmpty().withMessage('first name is required')
      .isLength({ min: 1, max: 100 }).withMessage('first name must be between 1 and 100 characters')
      .matches(/^[a-zA-Z\s'-]+$/).withMessage('first name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('last_name')
      .trim()
      .notEmpty().withMessage('last name is required')
      .isLength({ min: 1, max: 100 }).withMessage('last name must be between 1 and 100 characters')
      .matches(/^[a-zA-Z\s'-]+$/).withMessage('last name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('password')
      .optional()
      .isLength({ min: 8 }).withMessage('password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
    body('profile_picture')
      .optional()
      .isString().withMessage('profile picture must be a string URL')
      .isURL().withMessage('profile picture must be a valid URL'),
    
    body('date_of_birth')
      .optional()
      .isISO8601().withMessage('invalid date format (must be ISO 8601 format)')
      .custom(value => {
        const date = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - date.getFullYear();
        if (age < 13) {
          throw new Error('user must be at least 13 years old');
        }
        if (age > 120) {
          throw new Error('invalid date of birth');
        }
        return true;
      }),
    
    body('gender')
      .optional()
      .isIn(genders).withMessage(`gender must be one of: ${genders.join(', ')}`),
    
    body('is_email_verified')
      .optional()
      .isBoolean().withMessage('email verification status must be true or false')
      .toBoolean(),
    
    body('is_phone_verified')
      .optional()
      .isBoolean().withMessage('phone verification status must be true or false')
      .toBoolean(),
    
    body('two_factor_enabled')
      .optional()
      .isBoolean().withMessage('two-factor status must be true or false')
      .toBoolean(),
    
    body('is_kyc_verified')
      .optional()
      .isBoolean().withMessage('kyc verification status must be true or false')
      .toBoolean(),
    
    body('customer_type')
      .optional()
      .isIn(customerTypes).withMessage(`customer type must be one of: ${customerTypes.join(', ')}`),
    
    body('from')
      .optional()
      .isIn(['google', 'local']).withMessage('from must be either "google" or "local"'),
    
    body('source')
      .optional()
      .isLength({ max: 100 }).withMessage('source must be less than 100 characters')
  ],

  updateCustomerValidation: [
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('invalid email format')
      .normalizeEmail({ gmail_remove_dots: false })
      .isLength({ max: 255 }).withMessage('email must be less than 255 characters'),
    
    body('phone')
      .optional()
      .trim()
      .isLength({ min: 8, max: 20 }).withMessage('phone number must be between 8 and 20 characters')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('invalid phone number format'),
    
    body('first_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('first name must be between 1 and 100 characters')
      .matches(/^[a-zA-Z\s'-]+$/).withMessage('first name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('last_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('last name must be between 1 and 100 characters')
      .matches(/^[a-zA-Z\s'-]+$/).withMessage('last name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('profile_picture')
      .optional()
      .isString().withMessage('profile picture must be a string URL')
      .isURL().withMessage('profile picture must be a valid URL'),
    
    body('date_of_birth')
      .optional()
      .isISO8601().withMessage('invalid date format (must be ISO 8601 format)')
      .custom(value => {
        const date = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - date.getFullYear();
        if (age < 13) {
          throw new Error('user must be at least 13 years old');
        }
        if (age > 120) {
          throw new Error('invalid date of birth');
        }
        return true;
      }),
    
    body('gender')
      .optional()
      .isIn(genders).withMessage(`gender must be one of: ${genders.join(', ')}`),
    
    // Prevent updates to sensitive fields
    body('is_email_verified')
      .optional()
      .custom(() => {
        throw new Error('email verification status cannot be updated through this endpoint');
      }),
    
    body('is_phone_verified')
      .optional()
      .custom(() => {
        throw new Error('phone verification status cannot be updated through this endpoint');
      }),
    
    body('two_factor_enabled')
      .optional()
      .custom(() => {
        throw new Error('two-factor status cannot be updated through this endpoint');
      }),
    
    body('is_kyc_verified')
      .optional()
      .custom(() => {
        throw new Error('kyc verification status cannot be updated through this endpoint');
      }),
    
    body('customer_type')
      .optional()
      .custom(() => {
        throw new Error('customer type cannot be updated through this endpoint');
      })
  ],

  requestPhoneOTPValidation: [
    body('phone')
      .trim()
      .notEmpty().withMessage('phone is required')
      .isLength({ min: 8, max: 20 }).withMessage('phone number must be between 8 and 20 characters')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('invalid phone number format'),
    
    body('channel')
      .optional()
      .isIn(['sms', 'email']).withMessage('channel must be either "sms" or "email"')
  ],

  verifyPhoneOTPValidation: [
    body('phone')
      .trim()
      .notEmpty().withMessage('phone is required')
      .isLength({ min: 8, max: 20 }).withMessage('phone number must be between 8 and 20 characters'),
    
    body('code')
      .trim()
      .notEmpty().withMessage('verification code is required')
      .isLength({ min: 4, max: 8 }).withMessage('verification code must be between 4 and 8 characters')
      .matches(/^\d+$/).withMessage('verification code must contain only numbers')
  ],

  sendVerificationEmailValidation: [
    body('email')
      .trim()
      .notEmpty().withMessage('email is required')
      .isEmail().withMessage('invalid email format')
      .normalizeEmail({ gmail_remove_dots: false })
  ],

  verifyEmailValidation: [
    body('token')
      .trim()
      .notEmpty().withMessage('verification token is required')
      .isLength({ min: 10 }).withMessage('invalid verification token format')
  ],

  customerIdParamValidation: [
    param('id')
      .notEmpty().withMessage('customer id is required')
      .isInt({ min: 1 }).withMessage('customer id must be a positive integer')
  ],

  getAllCustomersQueryValidation: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('page must be a positive integer')
      .toInt(),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
      .toInt(),
    
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('search term must be less than 100 characters')
  ]
};

module.exports = customerValidator;