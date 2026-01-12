const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const customerController = require('../controllers/customerController');
const customerValidator = require('../validators/customerValidator');
const validate = require('../middleware/validationMiddleware');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

// Simplified file upload middleware
const handleFileUpload = (req, res, next) => {
  // Check if the request contains file data
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return upload.single('profile_picture')(req, res, (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          error: 'File upload error',
          message: err.message,
          code: 'FILE_UPLOAD_ERROR'
        });
      }
      console.log('File upload successful:', req.file ? req.file.originalname : 'No file');
      next();
    });
  }
  console.log('No file upload detected');
  next();
};

// Phone OTP endpoints
router.post(
  '/phone/request-otp',
  otpLimiter,
  customerValidator.requestPhoneOTPValidation,
  validate,
  customerController.requestPhoneOTP
);

router.post(
  '/phone/verify-otp',
  authMiddleware.authenticate,
  customerValidator.verifyPhoneOTPValidation,
  validate,
  customerController.verifyPhoneOTP
);

// Customer creation route
router.post('/',
  customerValidator.createCustomerValidation,
  validate,
  handleFileUpload,
  customerController.createCustomer
);

// Current customer (from token) - must be defined BEFORE '/:id'
router.get('/me',
  authMiddleware.authenticate,
  customerController.getMe
);

router.put('/me',
  authMiddleware.authenticate,
  customerValidator.updateCustomerValidation,
  validate,
  handleFileUpload,
  customerController.updateMe
);

// Customer update route - for general updates (may include profile picture)
router.put('/:id',
  authMiddleware.authenticate,
  customerValidator.customerIdParamValidation,
  customerValidator.updateCustomerValidation,
  validate,
  handleFileUpload,
  customerController.verifyOwnershipOrDeveloper,
  customerController.updateCustomer
);

router.get('/full-profile',
  authMiddleware.authenticate,
  customerController.verifyOwnershipOrDeveloper,
  customerController.getCustomerWithAddress
);

router.put('/update/full-profile',
  authMiddleware.authenticate,
  customerValidator.updateCustomerValidation,
  validate,
  upload.single('profile_picture'),
  customerController.updateFullProfile
);

router.patch('/:id/profile-picture',
  authMiddleware.authenticate,
  authMiddleware.authorize('developer'),
  customerValidator.customerIdParamValidation,
  validate,
  upload.single('profile_picture'),
  customerController.updateProfilePicture
);

// Get all customers
router.get('/',
  customerValidator.getAllCustomersQueryValidation,
  validate,
  customerController.getAllCustomers
);

router.get('/summary',
  authMiddleware.authenticate,
  authMiddleware.authorize('developer'), 
  customerController.getCustomerSummary
);

// Get single customer
router.get('/:id',
  authMiddleware.authenticate,
  customerValidator.customerIdParamValidation,
  validate,
  customerController.verifyOwnershipOrDeveloper,
  customerController.getCustomerById
);

// Delete customer
router.delete('/:id',
  authMiddleware.authenticate,
  authMiddleware.authorize('developer'),
  customerValidator.customerIdParamValidation,
  validate,
  customerController.deleteCustomer
);

router.post(
  '/send-verification-email',
  customerValidator.sendVerificationEmailValidation,
  validate,
  customerController.sendVerificationEmail
);

router.post(
  '/verify-email',
  customerValidator.verifyEmailValidation,
  validate,
  customerController.verifyEmail
);

module.exports = router;
