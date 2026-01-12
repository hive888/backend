const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const courseAccessController = require('../controllers/courseAccessController');

// Protected: must include a valid token; no body params required
router.post('/register', authMiddleware.authenticate, courseAccessController.checkCourseAccessFromToken);
router.get('/', authMiddleware.authenticate, courseAccessController.getSubscriptionStatus);
router.get('/subsections/:id', authMiddleware.authenticate, courseAccessController.getSubsectionContent);
router.post('/subsections/:id/complete', authMiddleware.authenticate, courseAccessController.completeSubsection);


router.post('/sections/:id/quiz', authMiddleware.authenticate, courseAccessController.createSubsectionQuiz);
router.get('/sections/:id/quiz', authMiddleware.authenticate, courseAccessController.getSubsectionQuizInfo);
router.post('/sections/:id/quiz/submit', authMiddleware.authenticate, courseAccessController.submitSubsectionQuiz);
router.get('/sections/:id/quiz/admin', authMiddleware.authenticate, courseAccessController.getSubsectionQuizAdminView);
module.exports = router;
