const express = require('express');
const router = express.Router();
const sectionsController = require('../controllers/sectionsController');
const logger = require('../utils/logger');

router.use((req, res, next) => {
  logger.http(`Sections route accessed: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    user: req.user?.user_id || 'anonymous'
  });
  next();
});

const authMiddleware = require('../middleware/authMiddleware');

// CRUD routes for sections
router.get('/', sectionsController.getAllSections);
router.get('/chapter/:chapterId', sectionsController.getSectionsByChapter);
router.get('/:id', sectionsController.getSectionById);
router.post('/', authMiddleware.authenticate, authMiddleware.authorize('administrator'), sectionsController.createSection);
router.put('/:id', authMiddleware.authenticate, authMiddleware.authorize('administrator'), sectionsController.updateSection);
router.delete('/:id', authMiddleware.authenticate, authMiddleware.authorize('administrator'), sectionsController.deleteSection);

// Error handling middleware
router.use((err, req, res, next) => {
  logger.error('Sections route error:', {
    error: err.message,
    stack: err.stack,
    route: req.originalUrl
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      errors: Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred in sections processing'
  });
});

module.exports = router;