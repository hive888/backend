// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const eventValidator = require('../validators/eventValidator');
const validate = require('../middleware/validationMiddleware');

/**
 * Client Event Routes (Public)
 */

// Get all events
router.get(
  '/',
  eventValidator.getAllEvents,
  validate,
  eventController.getAllEvents
);

// Get event by ID
router.get(
  '/:id',
  eventValidator.getEventById,
  validate,
  eventController.getEventById
);

module.exports = router;


