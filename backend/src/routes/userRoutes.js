/**
 * User Management Routes
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole, requirePermission } = require('../middleware/auth');
const { validate, validations, body, param } = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

// GET /api/users - Get all users (admin/moderator only)
router.get('/',
  requirePermission('users', 'read'),
  userController.getUsers
);

// GET /api/users/roles - Get all roles
router.get('/roles',
  userController.getRoles
);

// GET /api/users/:id - Get user by ID
router.get('/:id',
  requirePermission('users', 'read'),
  [param('id').isInt({ min: 1 })],
  validate,
  userController.getUserById
);

// POST /api/users - Create new user (admin/moderator with permission)
router.post('/',
  requirePermission('users', 'create'),
  [
    body('username').isString().trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
    body('full_name').isString().trim().isLength({ min: 2, max: 100 }),
    body('pin').isString().isLength({ min: 4, max: 8 }).matches(/^\d+$/),
    body('role_id').isInt({ min: 1 })
  ],
  validate,
  userController.createUser
);

// PUT /api/users/:id - Update user
router.put('/:id',
  requireRole('admin'),
  [param('id').isInt({ min: 1 })],
  validate,
  userController.updateUser
);

// POST /api/users/:id/reset-pin - Reset user PIN (admin only)
router.post('/:id/reset-pin',
  requireRole('admin'),
  [
    param('id').isInt({ min: 1 }),
    body('new_pin').isString().isLength({ min: 4, max: 8 }).matches(/^\d+$/)
  ],
  validate,
  userController.resetUserPin
);

// DELETE /api/users/:id - Delete (deactivate) user
router.delete('/:id',
  requirePermission('users', 'delete'),
  [param('id').isInt({ min: 1 })],
  validate,
  userController.deleteUser
);

module.exports = router;
