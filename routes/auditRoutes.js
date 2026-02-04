const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const subsectionAuditController = require('../controllers/subsectionAuditController');

// All audit routes require authentication (and optionally developer/admin role)
router.use(authMiddleware.authenticate);

// Subsection navigation audit endpoints
router.get('/subsection-navigation', subsectionAuditController.auditSubsectionNavigation);
router.get('/subsection-navigation/:subsectionId', subsectionAuditController.auditSubsectionNavigationById);

// Subsection navigation fix endpoints
router.post('/subsection-navigation/fix', subsectionAuditController.fixSubsectionNavigation);
router.post('/subsection-navigation/fix/:subsectionId', subsectionAuditController.fixSubsectionById);
router.post('/subsection-navigation/fix-section/:sectionId', subsectionAuditController.fixSectionOrdering);

module.exports = router;

