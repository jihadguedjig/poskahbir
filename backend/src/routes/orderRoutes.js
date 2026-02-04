/**
 * Order Management Routes
 */

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, requirePermission, requireRole } = require('../middleware/auth');
const { validate, body, param, query } = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

// GET /api/orders - Get all orders with filters
router.get('/',
  requirePermission('orders', 'read'),
  orderController.getOrders
);

// GET /api/orders/active - Get active orders only
router.get('/active',
  orderController.getActiveOrders
);

// GET /api/orders/:id - Get order by ID with full details
router.get('/:orderId',
  [param('orderId').isInt({ min: 1 })],
  validate,
  orderController.getOrderById
);

// POST /api/orders - Create new order (table_id optional for takeaway)
router.post('/',
  requirePermission('orders', 'create'),
  [
    body('table_id').optional().isInt({ min: 1 }).withMessage('table_id must be a positive integer'),
    body('guest_count').optional().isInt({ min: 1, max: 50 })
  ],
  validate,
  orderController.createOrder
);

// PATCH /api/orders/:orderId - Update order (notes, guest count)
router.patch('/:orderId',
  [
    param('orderId').isInt({ min: 1 }),
    body('guest_count').optional().isInt({ min: 1, max: 50 }),
    body('notes').optional().isString().isLength({ max: 1000 })
  ],
  validate,
  orderController.updateOrder
);

// POST /api/orders/:orderId/items - Add item to order
router.post('/:orderId/items',
  [
    param('orderId').isInt({ min: 1 }),
    body('product_id').isInt({ min: 1 }).withMessage('Valid product ID is required'),
    body('quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100'),
    body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
    body('notes').optional().isString().isLength({ max: 500 })
  ],
  validate,
  orderController.addOrderItem
);

// PATCH /api/orders/:orderId/items/:itemId - Update order item
router.patch('/:orderId/items/:itemId',
  [
    param('orderId').isInt({ min: 1 }),
    param('itemId').isInt({ min: 1 }),
    body('quantity').optional().isInt({ min: 1, max: 100 }),
    body('notes').optional().isString().isLength({ max: 500 })
  ],
  validate,
  orderController.updateOrderItem
);

// DELETE /api/orders/:orderId/items/:itemId - Remove item from order
router.delete('/:orderId/items/:itemId',
  [
    param('orderId').isInt({ min: 1 }),
    param('itemId').isInt({ min: 1 })
  ],
  validate,
  orderController.removeOrderItem
);

// POST /api/orders/:orderId/cancel - Cancel order
router.post('/:orderId/cancel',
  requireRole('admin', 'moderator'),
  [
    param('orderId').isInt({ min: 1 }),
    body('reason').optional().isString().isLength({ max: 500 })
  ],
  validate,
  orderController.cancelOrder
);

module.exports = router;
