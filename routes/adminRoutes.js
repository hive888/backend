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

// Summary Report
router.get('/report/summary', adminController.getSummaryReport);

// Customer Management
router.get('/customers', adminController.getCustomers);
router.get('/customers/with-progress', adminController.getCustomersWithProgress);
router.get('/customers/:id', adminController.getCustomerDetails);
router.put('/customers/:id', bodyValidationMiddleware, adminController.updateCustomer);
router.delete('/customers/:id', adminController.deleteCustomer);

// Payment Tracking
router.get('/payments', adminController.getPayments);
router.get('/payments/stats', adminController.getPaymentStats);
router.get('/payments/:id', adminController.getPaymentById);
router.get('/payments/customer/:customer_id', adminController.getCustomerPayments);
router.get('/payments/status/:status', adminController.getPaymentsByStatus);

// Exit Exam Payment Management
router.get('/exit-exam-payments', adminController.getExitExamPayments);
router.get('/exit-exam-payments/:id', adminController.getExitExamPaymentById);

// Telegram Management
router.get('/telegram/users', adminController.getTelegramUsers);
router.get('/telegram/users/:telegram_user_id', adminController.getTelegramUserDetails);
router.get('/telegram/stats', adminController.getTelegramStats);
// Note: Block/unblock/kick/message endpoints would need telegram bot integration

// University Management
router.get('/universities', adminController.getUniversities);
router.get('/universities/:id', adminController.getUniversityById);
router.post('/universities', bodyValidationMiddleware, adminController.createUniversity);
router.put('/universities/:id', bodyValidationMiddleware, adminController.updateUniversity);
router.delete('/universities/:id', adminController.deleteUniversity);

// Event Management
router.get('/events', adminController.getEvents);
router.get('/events/:id', adminController.getEventById);
router.post('/events', bodyValidationMiddleware, adminController.createEvent);
router.put('/events/:id', bodyValidationMiddleware, adminController.updateEvent);
router.delete('/events/:id', adminController.deleteEvent);

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

