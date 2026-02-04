/**
 * Table Management Routes
 */

const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate, body, param, query } = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

// GET /api/tables - Get all tables (query: include_inactive for admin)
router.get('/',
  tableController.getTables
);

// POST /api/tables - Create table
router.post('/',
  requirePermission('tables', 'create'),
  [
    body('table_number').isInt({ min: 1, max: 999 }),
    body('capacity').optional().isInt({ min: 1, max: 50 }),
    body('section').optional().isString().isLength({ max: 50 }),
    body('position_x').optional().isInt({ min: 0 }),
    body('position_y').optional().isInt({ min: 0 })
  ],
  validate,
  tableController.createTable
);

// GET /api/tables/summary - Get tables summary (counts by status)
router.get('/summary',
  tableController.getTablesSummary
);

// GET /api/tables/sections - Get table sections
router.get('/sections',
  tableController.getTableSections
);

// GET /api/tables/number/:tableNumber - Get table by number
router.get('/number/:tableNumber',
  [param('tableNumber').isInt({ min: 1, max: 100 })],
  validate,
  tableController.getTableByNumber
);

// GET /api/tables/:id - Get table by ID
router.get('/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  tableController.getTableById
);

// PUT /api/tables/:id - Update table
router.put('/:id',
  requirePermission('tables', 'update'),
  [
    param('id').isInt({ min: 1 }),
    body('table_number').optional().isInt({ min: 1, max: 999 }),
    body('capacity').optional().isInt({ min: 1, max: 50 }),
    body('section').optional().isString().isLength({ max: 50 }),
    body('position_x').optional().isInt({ min: 0 }),
    body('position_y').optional().isInt({ min: 0 }),
    body('is_active').optional().isBoolean()
  ],
  validate,
  tableController.updateTable
);

// DELETE /api/tables/:id - Deactivate table
router.delete('/:id',
  requirePermission('tables', 'delete'),
  [param('id').isInt({ min: 1 })],
  validate,
  tableController.deleteTable
);

// POST /api/tables/:id/lock - Lock a table
router.post('/:id/lock',
  [param('id').isInt({ min: 1 })],
  validate,
  tableController.lockTable
);

// POST /api/tables/:id/unlock - Unlock a table
router.post('/:id/unlock',
  [param('id').isInt({ min: 1 })],
  validate,
  tableController.unlockTable
);

// PATCH /api/tables/:id/status - Update table status
router.patch('/:id/status',
  requirePermission('tables', 'update'),
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(['available', 'occupied', 'reserved', 'maintenance'])
  ],
  validate,
  tableController.updateTableStatus
);

module.exports = router;
