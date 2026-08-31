const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const subsectionAuditController = require('../controllers/subsectionAuditController');

// Admin-only: internal diagnostic/repair tool for course subsection ordering
// (no frontend calls this - it's invoked manually), and the fix endpoints
// mutate subsection/section ordering data.
router.use(authMiddleware.authenticate, authMiddleware.authorize('administrator'));

// Subsection navigation audit endpoints
router.get('/subsection-navigation', subsectionAuditController.auditSubsectionNavigation);
router.get('/subsection-navigation/:subsectionId', subsectionAuditController.auditSubsectionNavigationById);

// Subsection navigation fix endpoints
router.post('/subsection-navigation/fix', subsectionAuditController.fixSubsectionNavigation);
router.post('/subsection-navigation/fix/:subsectionId', subsectionAuditController.fixSubsectionById);
router.post('/subsection-navigation/fix-section/:sectionId', subsectionAuditController.fixSectionOrdering);

module.exports = router;

