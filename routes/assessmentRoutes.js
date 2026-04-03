const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');

// Submit an assessment
router.post('/submit', assessmentController.submitAssessment);

module.exports = router;
