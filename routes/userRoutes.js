const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const customerController = require('../controllers/customerController');
const validate = require('../middleware/validationMiddleware');

router.get('/', authMiddleware.authenticate,authMiddleware.authorize('developer'), userController.getAllUsers);
router.post('/',userController.createUser);
router.get('/roles', userController.getAllRoles);
router.get('/:id', authMiddleware.authenticate,authMiddleware.authorize('developer'),userController.getUser);
router.put('/:id', authMiddleware.authenticate,userController.verifyOwnershipUser,userController.updateUser);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.get('/roles', authMiddleware.authenticate, authMiddleware.authorize('developer'), userController.getAllRoles);
router.post('/roles', authMiddleware.authenticate, authMiddleware.authorize('developer'), userController.createRole);
router.get('/roles/statistics', authMiddleware.authenticate, authMiddleware.authorize('developer'), userController.getRoleStatistics);
module.exports = router;