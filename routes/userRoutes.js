const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const customerController = require('../controllers/customerController');
const validate = require('../middleware/validationMiddleware');

router.get('/', authMiddleware.authenticate,authMiddleware.authorize('administrator'), userController.getAllUsers);
router.get('/roles', authMiddleware.authenticate, authMiddleware.authorize('administrator'), userController.getAllRoles);
router.post('/', authMiddleware.authenticate, authMiddleware.authorize('administrator'), userController.createUser);
router.get('/:id', authMiddleware.authenticate,authMiddleware.authorize('administrator'),userController.getUser);
router.put('/:id', authMiddleware.authenticate,userController.verifyOwnershipUser,userController.updateUser);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.get('/roles', authMiddleware.authenticate, authMiddleware.authorize('administrator'), userController.getAllRoles);
router.post('/roles', authMiddleware.authenticate, authMiddleware.authorize('administrator'), userController.createRole);
router.get('/roles/statistics', authMiddleware.authenticate, authMiddleware.authorize('administrator'), userController.getRoleStatistics);
module.exports = router;