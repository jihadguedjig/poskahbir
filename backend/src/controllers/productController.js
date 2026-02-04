/**
 * Product and Category Controller
 * Handles product catalog management
 */

const db = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { logAudit } = require('./authController');

// =====================
// CATEGORY OPERATIONS
// =====================

/**
 * Get all categories
 * GET /api/categories
 */
const getCategories = async (req, res, next) => {
  try {
    const { include_inactive } = req.query;
    
    let query = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = TRUE) as product_count
      FROM categories c
    `;
    
    if (!include_inactive) {
      query += ' WHERE c.is_active = TRUE';
    }
    
    query += ' ORDER BY c.display_order, c.name';
    
    const categories = await db.query(query);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get category by ID with products
 * GET /api/categories/:id
 */
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [category] = await db.query(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
    
    // Get products in this category
    const products = await db.query(
      `SELECT * FROM products 
       WHERE category_id = ? AND is_active = TRUE
       ORDER BY name`,
      [id]
    );
    
    category.products = products;
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new category
 * POST /api/categories
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, display_order, color, icon, image_url } = req.body;
    
    const result = await db.query(
      `INSERT INTO categories (name, description, display_order, color, icon, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, display_order || 0, color || '#3B82F6', icon || null, image_url || null]
    );
    
    const categoryId = result.insertId;
    
    await logAudit(req.user.id, 'CATEGORY_CREATED', 'category', categoryId, null, { name });
    
    logger.info(`Category "${name}" created by ${req.user.username}`);
    
    const [category] = await db.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update category
 * PUT /api/categories/:id
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, display_order, color, icon, image_url, is_active } = req.body;
    
    const [existing] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    
    if (!existing) {
      throw ApiError.notFound('Category not found');
    }
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (display_order !== undefined) { updates.push('display_order = ?'); values.push(display_order); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url || null); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
    
    if (updates.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    await logAudit(req.user.id, 'CATEGORY_UPDATED', 'category', id, existing, req.body);
    
    const [category] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category (soft delete)
 * DELETE /api/categories/:id
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if category has products
    const [productCount] = await db.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = TRUE',
      [id]
    );
    
    if (productCount.count > 0) {
      throw ApiError.badRequest('Cannot delete category with active products. Deactivate products first.');
    }
    
    await db.query('UPDATE categories SET is_active = FALSE WHERE id = ?', [id]);
    
    await logAudit(req.user.id, 'CATEGORY_DELETED', 'category', id, null, null);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// =====================
// PRODUCT OPERATIONS
// =====================

/**
 * Get all products
 * GET /api/products
 */
const getProducts = async (req, res, next) => {
  try {
    const { category_id, available_only, search, page = 1, limit = 100 } = req.query;
    
    let query = `
      SELECT p.*, c.name as category_name, c.color as category_color
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
    `;
    
    const params = [];
    
    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }
    
    if (available_only === 'true') {
      query += ' AND p.is_available = TRUE';
    }
    
    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY c.display_order, p.name';
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const products = await db.query(query, params);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get products grouped by category (for POS interface)
 * GET /api/products/by-category
 */
const getProductsByCategory = async (req, res, next) => {
  try {
    // Get active categories
    const categories = await db.query(
      `SELECT * FROM categories WHERE is_active = TRUE ORDER BY display_order, name`
    );
    
    // Get products for each category
    for (const category of categories) {
      const products = await db.query(
        `SELECT * FROM products 
         WHERE category_id = ? AND is_active = TRUE AND is_available = TRUE
         ORDER BY name`,
        [category.id]
      );
      category.products = products;
    }
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by ID
 * GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [product] = await db.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new product
 * POST /api/products
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      name, description, category_id, price, cost_price,
      sku, stock_quantity, track_stock, min_stock_alert, image_url, variable_price
    } = req.body;
    
    // Verify category exists
    const [category] = await db.query('SELECT id FROM categories WHERE id = ?', [category_id]);
    
    if (!category) {
      throw ApiError.badRequest('Invalid category ID');
    }
    
    const result = await db.query(
      `INSERT INTO products (
        name, description, category_id, price, cost_price,
        sku, stock_quantity, track_stock, min_stock_alert, image_url, variable_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, description || null, category_id, price, cost_price || 0,
        sku || null, stock_quantity || null, track_stock || false,
        min_stock_alert || 10, image_url || null, variable_price ? true : false
      ]
    );
    
    const productId = result.insertId;
    
    await logAudit(req.user.id, 'PRODUCT_CREATED', 'product', productId, null, { name, price });
    
    logger.info(`Product "${name}" created by ${req.user.username}`);
    
    const [product] = await db.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [productId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product
 * PUT /api/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    
    if (!existing) {
      throw ApiError.notFound('Product not found');
    }
    
    // Build dynamic update query
    const allowedFields = [
      'name', 'description', 'category_id', 'price', 'cost_price',
      'sku', 'stock_quantity', 'track_stock', 'min_stock_alert',
      'image_url', 'is_available', 'variable_price', 'is_active'
    ];
    
    const updateClauses = [];
    const values = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateClauses.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    
    if (updateClauses.length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE products SET ${updateClauses.join(', ')} WHERE id = ?`,
      values
    );
    
    await logAudit(req.user.id, 'PRODUCT_UPDATED', 'product', id, existing, updates);
    
    logger.info(`Product "${existing.name}" updated by ${req.user.username}`);
    
    const [product] = await db.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle product availability
 * PATCH /api/products/:id/availability
 */
const toggleProductAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;
    
    const [product] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    
    await db.query(
      'UPDATE products SET is_available = ? WHERE id = ?',
      [is_available, id]
    );
    
    await logAudit(req.user.id, 'PRODUCT_AVAILABILITY_CHANGED', 'product', id, 
      { is_available: product.is_available }, 
      { is_available }
    );
    
    res.json({
      success: true,
      message: `Product ${is_available ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product stock
 * PATCH /api/products/:id/stock
 */
const updateProductStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock_quantity, adjustment, reason } = req.body;
    
    const [product] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    
    let newStock;
    
    if (adjustment !== undefined) {
      // Adjust relative to current stock
      newStock = (product.stock_quantity || 0) + adjustment;
    } else if (stock_quantity !== undefined) {
      // Set absolute stock
      newStock = stock_quantity;
    } else {
      throw ApiError.badRequest('Either stock_quantity or adjustment is required');
    }
    
    if (newStock < 0) {
      throw ApiError.badRequest('Stock cannot be negative');
    }
    
    await db.query(
      'UPDATE products SET stock_quantity = ? WHERE id = ?',
      [newStock, id]
    );
    
    await logAudit(req.user.id, 'PRODUCT_STOCK_UPDATED', 'product', id,
      { stock_quantity: product.stock_quantity },
      { stock_quantity: newStock, reason }
    );
    
    logger.info(`Stock updated for "${product.name}": ${product.stock_quantity} -> ${newStock} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: { previousStock: product.stock_quantity, newStock }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product (soft delete)
 * DELETE /api/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [product] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    
    await db.query('UPDATE products SET is_active = FALSE WHERE id = ?', [id]);
    
    await logAudit(req.user.id, 'PRODUCT_DELETED', 'product', id, null, null);
    
    logger.info(`Product "${product.name}" deleted by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get low stock products
 * GET /api/products/low-stock
 */
const getLowStockProducts = async (req, res, next) => {
  try {
    const products = await db.query(
      `SELECT p.*, c.name as category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.track_stock = TRUE 
         AND p.is_active = TRUE
         AND p.stock_quantity <= p.min_stock_alert
       ORDER BY p.stock_quantity ASC`
    );
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Categories
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Products
  getProducts,
  getProductsByCategory,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  updateProductStock,
  deleteProduct,
  getLowStockProducts
};
