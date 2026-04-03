const express = require('express');
const router = express.Router();
const swafriController = require('../controllers/swafriController');

// Public routes - no authentication required
router.post('/talent-requests/submit', swafriController.submitTalentRequest);
router.post('/project-requests/submit', swafriController.submitProjectRequest);

module.exports = router;

