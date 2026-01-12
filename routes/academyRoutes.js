const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const academyValidator = require('../validators/academyValidator');
const academyController = require('../controllers/academyController');

// Public course catalog
router.get('/courses', academyController.listCourses);
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

module.exports = router;


