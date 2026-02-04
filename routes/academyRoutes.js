const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const academyValidator = require('../validators/academyValidator');
const academyController = require('../controllers/academyController');

// Public course catalog
router.get('/courses', academyController.listCourses);
router.get('/courses/me', authMiddleware.authenticate, academyController.listMyCourses);
router.post(
  '/courses',
  authMiddleware.authenticate,
  authMiddleware.authorize('developer'),
  academyValidator.createCourse,
  validate,
  academyController.createCourse
);
router.get('/courses/:slug', academyValidator.courseSlugParam, validate, academyController.getCourseBySlug);

// Authenticated access checks + redeem
router.get(
  '/courses/:slug/access',
  authMiddleware.authenticate,
  academyValidator.courseSlugParam,
  validate,
  academyController.getMyCourseAccess
);

router.post(
  '/courses/:slug/redeem',
  authMiddleware.authenticate,
  academyValidator.courseSlugParam,
  academyValidator.redeemAccessCode,
  validate,
  academyController.redeemAccessCode
);

// Get full course content (chapters, sections, subsections) with progress
router.get(
  '/courses/:slug/content',
  authMiddleware.authenticate,
  academyValidator.courseSlugParam,
  validate,
  academyController.getCourseContent
);

// Subsection endpoints (multi-course)
router.get(
  '/courses/:slug/subsections/:id',
  authMiddleware.authenticate,
  academyValidator.courseSlugParam,
  validate,
  academyController.getSubsectionContent
);

router.post(
  '/courses/:slug/subsections/:id/complete',
  authMiddleware.authenticate,
  academyValidator.courseSlugParam,
  validate,
  academyController.completeSubsection
);

// Quiz endpoints (multi-course)
router.get(
  '/courses/:slug/sections/:id/quiz',
  authMiddleware.authenticate,
  academyValidator.courseSlugParam,
  validate,
  academyController.getSubsectionQuizInfo
);

router.post(
  '/courses/:slug/sections/:id/quiz/submit',
  authMiddleware.authenticate,
  academyValidator.courseSlugParam,
  validate,
  academyController.submitSubsectionQuiz
);

router.post(
  '/courses/:slug/sections/:id/quiz',
  authMiddleware.authenticate,
  authMiddleware.authorize('developer'),
  academyValidator.courseSlugParam,
  validate,
  academyController.createSubsectionQuiz
);

router.get(
  '/courses/:slug/sections/:id/quiz/admin',
  authMiddleware.authenticate,
  authMiddleware.authorize('developer'),
  academyValidator.courseSlugParam,
  validate,
  academyController.getSubsectionQuizAdminView
);

module.exports = router;


