const express = require('express');
const router = express.Router();
const chaptersController = require('../controllers/chaptersController');
const logger = require('../utils/logger');

router.use((req, res, next) => {
  logger.http(`Chapters route accessed: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    user: req.user?.user_id || 'anonymous'
  });
  next();
});

// CRUD routes for chapters
router.get('/', chaptersController.getAllChapters);
router.get('/:id', chaptersController.getChapterById);
router.post('/', chaptersController.createChapter);
router.put('/:id', chaptersController.updateChapter);
router.delete('/:id', chaptersController.deleteChapter);

// Error handling middleware
router.use((err, req, res, next) => {
  logger.error('Chapters route error:', {
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
    message: 'An unexpected error occurred in chapters processing'
  });
});

module.exports = router;