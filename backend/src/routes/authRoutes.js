/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, validations, body } = require('../middleware/validate');

// GET /api/auth/login-options - List users for login dropdown (public)
router.get('/login-options', authController.getLoginOptions);

// POST /api/auth/login - Login with username and PIN
router.post('/login',
  [
    body('username').isString().trim().notEmpty().withMessage('Username is required'),
    body('pin').isString().isLength({ min: 4, max: 8 }).withMessage('PIN must be 4-8 characters')
  ],
  validate,
  authController.login
);

// GET /api/auth/verify - Verify token and get user info
router.get('/verify',
  authenticate,
  authController.verifyToken
);

// PATCH /api/auth/profile - Update current user's profile (full_name)
router.patch('/profile',
  authenticate,
  [
    body('full_name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
  ],
  validate,
  authController.updateProfile
);

// POST /api/auth/change-pin - Change user's PIN
router.post('/change-pin',
  authenticate,
  [
    body('currentPin').isString().notEmpty().withMessage('Current PIN is required'),
    body('newPin').isString().isLength({ min: 4, max: 8 }).matches(/^\d+$/).withMessage('New PIN must be 4-8 digits')
  ],
  validate,
  authController.changePin
);

// POST /api/auth/logout - Logout (for audit logging)
router.post('/logout',
  authenticate,
  authController.logout
);

module.exports = router;
