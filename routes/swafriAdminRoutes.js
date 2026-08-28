const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const swafriAdminController = require('../controllers/swafriAdminController');

// All routes here require authentication and the administrator role
router.use(authMiddleware.authenticate);
router.use(authMiddleware.authorize('administrator'));

// Talent request management
router.get('/talent-requests', swafriAdminController.getTalentRequests);
router.get('/talent-requests/stats', swafriAdminController.getTalentRequestsStats);
router.get('/talent-requests/:id', swafriAdminController.getTalentRequestById);
router.patch('/talent-requests/:id/status', swafriAdminController.updateTalentRequestStatus);
router.put('/talent-requests/:id', swafriAdminController.updateTalentRequest);
router.delete('/talent-requests/:id', swafriAdminController.deleteTalentRequest);

// Non-AI keyword/work-arrangement matching suggestions
router.get('/suggestions/:request_type/:request_id', swafriAdminController.getTalentSuggestions);

// Assignment management (linking a talent-pool registrant to a request)
router.post('/assignments', swafriAdminController.createAssignment);
router.get('/assignments', swafriAdminController.getAssignments);
router.get('/assignments/request/:request_type/:request_id', swafriAdminController.getAssignmentsByRequest);
router.get('/assignments/:id', swafriAdminController.getAssignmentById);
router.put('/assignments/:id', swafriAdminController.updateAssignment);
router.patch('/assignments/:id/status', swafriAdminController.updateAssignmentStatus);
router.delete('/assignments/:id', swafriAdminController.deleteAssignment);

module.exports = router;
