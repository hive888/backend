const express = require('express');
const router = express.Router();
const subsectionsController = require('../controllers/subsectionsController');
const logger = require('../utils/logger');

router.use((req, res, next) => {
  logger.http(`Subsections route accessed: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    user: req.user?.user_id || 'anonymous'
  });
  next();
});

// CRUD routes for subsections
router.get('/', subsectionsController.getAllSubsections);
router.get('/section/:sectionId', subsectionsController.getSubsectionsBySection);
router.get('/:id', subsectionsController.getSubsectionById);
router.post('/', subsectionsController.createSubsection);
router.put('/:id', subsectionsController.updateSubsection);
router.delete('/:id', subsectionsController.deleteSubsection);

// Error handling middleware
router.use((err, req, res, next) => {
  logger.error('Subsections route error:', {
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
    message: 'An unexpected error occurred in subsections processing'
  });
});

module.exports = router;