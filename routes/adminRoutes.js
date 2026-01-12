const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');
const bodyValidationMiddleware = require('../middleware/bodyValidationMiddleware');

/**
 * Admin Routes
 * All routes require authentication and 'developer' role
 */

// Apply authentication and authorization to all admin routes
router.use(authMiddleware.authenticate);
router.use(authMiddleware.authorize('developer'));

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Customer Management
router.get('/customers', adminController.getCustomers);
router.get('/customers/:id', adminController.getCustomerDetails);
router.put('/customers/:id', bodyValidationMiddleware, adminController.updateCustomer);
router.delete('/customers/:id', adminController.deleteCustomer);

// Talent Pool Management
router.get('/talent-pool', adminController.getTalentPoolRegistrations);
router.get('/talent-pool/stats', adminController.getTalentPoolStats);
router.patch('/talent-pool/:id/status', bodyValidationMiddleware, adminController.updateTalentPoolStatus);

// Contest Management
router.get('/contests', adminController.getContests);
router.get('/contests/:id', adminController.getContestDetails);

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Access Code Management
router.get('/access-codes', adminController.getAccessCodes);
router.get('/access-codes/:id', adminController.getAccessCodeDetails);
router.post('/access-codes', bodyValidationMiddleware, adminController.createAccessCode);
router.put('/access-codes/:id', bodyValidationMiddleware, adminController.updateAccessCode);

module.exports = router;

