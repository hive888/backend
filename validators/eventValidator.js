// validators/eventValidator.js
const { body, param, query } = require('express-validator');

const eventValidator = {
  // Client validators
  getAllEvents: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('month')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Month must be between 1 and 12'),
    query('year')
      .optional()
      .isInt({ min: 2000, max: 2100 })
      .withMessage('Year must be a valid year'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ],

  getEventById: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Event ID must be a positive integer')
  ],

  // Admin validators
  createEvent: [
    body('event_name')
      .trim()
      .notEmpty()
      .withMessage('Event name is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Event name must be between 1 and 255 characters'),
    body('event_date')
      .notEmpty()
      .withMessage('Event date is required')
      .isISO8601()
      .withMessage('Event date must be a valid ISO 8601 date (YYYY-MM-DD)'),
    body('short_description')
      .trim()
      .notEmpty()
      .withMessage('Short description is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Short description must be between 1 and 1000 characters'),
    body('detailed_content')
      .notEmpty()
      .withMessage('Detailed content is required')
      .isLength({ min: 1 })
      .withMessage('Detailed content cannot be empty')
  ],

  updateEvent: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Event ID must be a positive integer'),
    body('event_name')
      .trim()
      .notEmpty()
      .withMessage('Event name is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Event name must be between 1 and 255 characters'),
    body('event_date')
      .notEmpty()
      .withMessage('Event date is required')
      .isISO8601()
      .withMessage('Event date must be a valid ISO 8601 date (YYYY-MM-DD)'),
    body('short_description')
      .trim()
      .notEmpty()
      .withMessage('Short description is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Short description must be between 1 and 1000 characters'),
    body('detailed_content')
      .notEmpty()
      .withMessage('Detailed content is required')
      .isLength({ min: 1 })
      .withMessage('Detailed content cannot be empty')
  ],

  deleteEvent: [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Event ID must be a positive integer')
  ],

  getAllEventsAdmin: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Search term must be less than 255 characters'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ]
};

module.exports = eventValidator;


