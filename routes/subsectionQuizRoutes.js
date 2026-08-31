const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const subsectionQuizController = require('../controllers/subsectionQuizController');

// Admin-only: this is the quiz-builder CRUD API used by admin-dashboard's
// Academy editor (create/update/delete quiz questions & options). The
// student-facing read/submit endpoints live separately under
// courseAccessRoutes.js (/sections/:id/quiz, /quiz/submit).
router.use(authMiddleware.authenticate, authMiddleware.authorize('administrator'));

// List the quiz (questions + options) for a subsection
router.get('/:subsectionId', subsectionQuizController.listQuiz);

// Create / update / delete QUESTIONS
router.post('/:subsectionId/questions', subsectionQuizController.createQuestion);
router.put('/questions/:questionId', subsectionQuizController.updateQuestion);
router.delete('/questions/:questionId', subsectionQuizController.deleteQuestion);

// Create / update / delete OPTIONS
router.post('/questions/:questionId/options', subsectionQuizController.createOption);
router.put('/options/:optionId', subsectionQuizController.updateOption);
router.delete('/options/:optionId', subsectionQuizController.deleteOption);

module.exports = router;
