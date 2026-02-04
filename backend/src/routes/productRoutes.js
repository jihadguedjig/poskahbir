/**
 * Product and Category Routes
 */

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requirePermission, requireRole } = require('../middleware/auth');
const { validate, body, param, query } = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

// =====================
// CATEGORY ROUTES
// =====================

// GET /api/categories - Get all categories
router.get('/categories',
  productController.getCategories
);

// GET /api/categories/:id - Get category by ID
router.get('/categories/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  productController.getCategoryById
);

// POST /api/categories - Create category
router.post('/categories',
  requirePermission('categories', 'create'),
  [
    body('name').isString().trim().isLength({ min: 2, max: 100 }),
    body('description').optional().isString().isLength({ max: 255 }),
    body('display_order').optional().isInt({ min: 0 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('icon').optional().isString().isLength({ max: 50 }),
    body('image_url').optional().isString().isLength({ max: 500 })
  ],
  validate,
  productController.createCategory
);

// PUT /api/categories/:id - Update category
router.put('/categories/:id',
  requirePermission('categories', 'update'),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('description').optional().isString().isLength({ max: 255 }),
    body('display_order').optional().isInt({ min: 0 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('icon').optional().isString().isLength({ max: 50 }),
    body('image_url').optional().isString().isLength({ max: 500 })
  ],
  validate,
  productController.updateCategory
);

// DELETE /api/categories/:id - Delete category
router.delete('/categories/:id',
  requirePermission('categories', 'delete'),
  [param('id').isInt({ min: 1 })],
  validate,
  productController.deleteCategory
);

// =====================
// PRODUCT ROUTES
// =====================

// GET /api/products - Get all products
router.get('/',
  productController.getProducts
);

// GET /api/products/by-category - Get products grouped by category
router.get('/by-category',
  productController.getProductsByCategory
);

// GET /api/products/low-stock - Get low stock products
router.get('/low-stock',
  requirePermission('products', 'read'),
  productController.getLowStockProducts
);

// GET /api/products/:id - Get product by ID
router.get('/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  productController.getProductById
);

// POST /api/products - Create product
router.post('/',
  requirePermission('products', 'create'),
  [
    body('name').isString().trim().isLength({ min: 2, max: 150 }),
    body('category_id').isInt({ min: 1 }),
    body('price').isFloat({ min: 0.01, max: 99999.99 }),
    body('description').optional().isString(),
    body('cost_price').optional().isFloat({ min: 0 }),
    body('sku').optional().isString().isLength({ max: 50 }),
    body('stock_quantity').optional().isInt({ min: 0 }),
    body('track_stock').optional().isBoolean(),
    body('min_stock_alert').optional().isInt({ min: 0 }),
    body('image_url').optional().isURL()
  ],
  validate,
  productController.createProduct
);

// PUT /api/products/:id - Update product
router.put('/:id',
  requirePermission('products', 'update'),
  [param('id').isInt({ min: 1 })],
  validate,
  productController.updateProduct
);

// PATCH /api/products/:id/availability - Toggle product availability
router.patch('/:id/availability',
  requirePermission('products', 'update'),
  [
    param('id').isInt({ min: 1 }),
    body('is_available').isBoolean()
  ],
  validate,
  productController.toggleProductAvailability
);

// PATCH /api/products/:id/stock - Update product stock
router.patch('/:id/stock',
  requirePermission('products', 'update'),
  [
    param('id').isInt({ min: 1 }),
    body('stock_quantity').optional().isInt({ min: 0 }),
    body('adjustment').optional().isInt(),
    body('reason').optional().isString().isLength({ max: 255 })
  ],
  validate,
  productController.updateProductStock
);

// DELETE /api/products/:id - Delete product
router.delete('/:id',
  requirePermission('products', 'delete'),
  [param('id').isInt({ min: 1 })],
  validate,
  productController.deleteProduct
);

module.exports = router;
