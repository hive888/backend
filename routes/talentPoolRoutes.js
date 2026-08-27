const express = require('express');
const router = express.Router();
const talentPoolController = require('../controllers/talentPoolController');
const authMiddleware = require('../middleware/authMiddleware');

// Talent pool registration routes
router.post('/register', authMiddleware.authenticate, talentPoolController.handleTalentRegistration);
router.get('/my-registration', authMiddleware.authenticate, talentPoolController.getMyRegistration);
router.put('/my-registration', authMiddleware.authenticate, talentPoolController.updateMyRegistration);
router.get('/registrations', authMiddleware.authenticate, authMiddleware.authorize('administrator'), talentPoolController.getAllRegistrations);
router.get('/registrations/stats', authMiddleware.authenticate, authMiddleware.authorize('administrator'), talentPoolController.getRegistrationStats);
router.get('/registrations/filter', authMiddleware.authenticate, authMiddleware.authorize('administrator'), talentPoolController.getFilteredRegistrations);
router.get('/registrations/status-definitions', authMiddleware.authenticate, talentPoolController.getStatusDefinitions);
router.get('/registrations/:id', authMiddleware.authenticate, authMiddleware.authorize('administrator'), talentPoolController.getRegistrationById);

// Admin management routes
router.put('/registrations/:id/status', authMiddleware.authenticate, authMiddleware.authorize('administrator'), talentPoolController.updateRegistrationStatus);
router.put('/registrations/:id', authMiddleware.authenticate, authMiddleware.authorize('administrator'), talentPoolController.updateRegistration);
router.delete('/registrations/:id', authMiddleware.authenticate, authMiddleware.authorize('administrator'), talentPoolController.deleteRegistration);

module.exports = router;