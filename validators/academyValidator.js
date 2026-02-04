const { body, param } = require('express-validator');

const academyValidator = {
  courseSlugParam: [
    param('slug')
      .trim()
      .notEmpty().withMessage('slug is required')
      .isLength({ max: 120 }).withMessage('slug must be less than 120 characters')
      .matches(/^[a-z0-9-]+$/).withMessage('slug must be lowercase letters, numbers, and hyphens only')
  ],

  redeemAccessCode: [
    body('access_code')
      .trim()
      .notEmpty().withMessage('access_code is required')
      .isLength({ max: 64 }).withMessage('access_code must be less than 64 characters')
  ],

  createCourse: [
    body('slug')
      .trim()
      .notEmpty().withMessage('slug is required')
      .isLength({ max: 120 }).withMessage('slug must be less than 120 characters')
      .matches(/^[a-z0-9-]+$/).withMessage('slug must be lowercase letters, numbers, and hyphens only'),
    body('title')
      .trim()
      .notEmpty().withMessage('title is required')
      .isLength({ max: 255 }).withMessage('title must be less than 255 characters'),
    body('short_description')
      .optional()
      .isString().withMessage('short_description must be a string'),
    body('detailed_description')
      .optional()
      .isString().withMessage('detailed_description must be a string'),
    body('thumbnail_url')
      .optional()
      .isURL().withMessage('thumbnail_url must be a valid URL'),
    body('is_active')
      .optional()
      .isBoolean().withMessage('is_active must be boolean')
  ],
};

module.exports = academyValidator;


