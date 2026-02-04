/**
 * Payment Routes
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requirePermission, requireRole } = require('../middleware/auth');
const { validate, body, param, query } = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

// GET /api/payments/methods - Get payment methods (query: include_inactive for admin)
router.get('/methods',
  paymentController.getPaymentMethods
);

// POST /api/payments/methods - Create payment method
router.post('/methods',
  requirePermission('payments', 'update'),
  [
    body('name').isString().trim().isLength({ min: 1, max: 50 }),
    body('description').optional().isString().isLength({ max: 255 })
  ],
  validate,
  paymentController.createPaymentMethod
);

// PUT /api/payments/methods/:methodId - Update payment method
router.put('/methods/:methodId',
  requirePermission('payments', 'update'),
  [
    param('methodId').isInt({ min: 1 }),
    body('name').optional().isString().trim().isLength({ min: 1, max: 50 }),
    body('description').optional().isString().isLength({ max: 255 }),
    body('is_active').optional().isBoolean()
  ],
  validate,
  paymentController.updatePaymentMethod
);

// DELETE /api/payments/methods/:methodId - Deactivate payment method
router.delete('/methods/:methodId',
  requirePermission('payments', 'update'),
  [param('methodId').isInt({ min: 1 })],
  validate,
  paymentController.deletePaymentMethod
);

// GET /api/payments/summary/daily - Get daily sales summary (cashier + admin)
router.get('/summary/daily',
  paymentController.getDailySummary
);

// GET /api/payments/report - Get sales report for date range
router.get('/report',
  requirePermission('reports', 'view'),
  [
    query('start_date').isDate(),
    query('end_date').isDate()
  ],
  validate,
  paymentController.getSalesReport
);

// GET /api/payments - Get all payments
router.get('/',
  requirePermission('payments', 'read'),
  paymentController.getPayments
);

// GET /api/payments/:id - Get payment by ID
router.get('/:id',
  requirePermission('payments', 'read'),
  [param('id').isInt({ min: 1 })],
  validate,
  paymentController.getPaymentById
);

// POST /api/payments - Process payment
router.post('/',
  requirePermission('payments', 'create'),
  [
    body('order_id').isInt({ min: 1 }).withMessage('Valid order ID is required'),
    body('payment_method_id').isInt({ min: 1 }).withMessage('Valid payment method is required'),
    body('amount_paid').isFloat({ min: 0.01 }).withMessage('Amount paid must be positive'),
    body('tip_amount').optional().isFloat({ min: 0 }),
    body('reference_number').optional().isString().isLength({ max: 100 }),
    body('notes').optional().isString().isLength({ max: 500 })
  ],
  validate,
  paymentController.processPayment
);

module.exports = router;
