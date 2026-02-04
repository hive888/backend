const { body } = require('express-validator');

const authValidator = {
  loginValidation: [
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 1, max: 255 }).withMessage('Username must be between 1 and 255 characters'),
    
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 1 }).withMessage('Password cannot be empty')
  ],

  refreshTokenValidation: [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required')
      .isString().withMessage('Refresh token must be a string')
  ],

  logoutValidation: [
    body('refreshToken')
      .notEmpty().withMessage('Refresh token is required')
      .isString().withMessage('Refresh token must be a string')
  ],

  googleLoginValidation: [
    body('token')
      .notEmpty().withMessage('Google token is required')
      .isString().withMessage('Google token must be a string')
  ]
};

module.exports = authValidator;

