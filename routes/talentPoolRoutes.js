const express = require('express');
const router = express.Router();
const talentPoolController = require('../controllers/talentPoolController');
const authMiddleware = require('../middleware/authMiddleware');

// Talent pool registration routes
router.post('/register', authMiddleware.authenticate, talentPoolController.handleTalentRegistration);
router.get('/my-registration', authMiddleware.authenticate, talentPoolController.getMyRegistration);
router.put('/my-registration', authMiddleware.authenticate, talentPoolController.updateMyRegistration);
router.get('/registrations', talentPoolController.getAllRegistrations);
router.get('/registrations/stats', talentPoolController.getRegistrationStats);
router.get('/registrations/filter', talentPoolController.getFilteredRegistrations);
router.get('/registrations/status-definitions', talentPoolController.getStatusDefinitions);
router.get('/registrations/:id', talentPoolController.getRegistrationById);

// Admin management routes
router.put('/registrations/:id/status', talentPoolController.updateRegistrationStatus);
router.put('/registrations/:id', talentPoolController.updateRegistration);
router.delete('/registrations/:id', talentPoolController.deleteRegistration);

module.exports = router;