/**
 * Request Validation Middleware
 * Uses express-validator for input validation
 */

const { validationResult, body, param, query } = require('express-validator');
const { ApiError } = require('./errorHandler');

/**
 * Process validation results and throw error if validation fails
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    
    return next(ApiError.badRequest('Validation failed', formattedErrors));
  }
  
  next();
};

// Common validation rules
const validations = {
  // Auth validations
  pin: body('pin')
    .isString()
    .isLength({ min: 4, max: 8 })
    .matches(/^\d+$/)
    .withMessage('PIN must be 4-8 digits'),
  
  username: body('username')
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-50 alphanumeric characters or underscores'),
  
  // User validations
  fullName: body('full_name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
  
  roleId: body('role_id')
    .isInt({ min: 1 })
    .withMessage('Valid role ID is required'),
  
  // Table validations
  tableNumber: body('table_number')
    .isInt({ min: 1, max: 100 })
    .withMessage('Table number must be between 1 and 100'),
  
  tableId: param('tableId')
    .isInt({ min: 1 })
    .withMessage('Valid table ID is required'),
  
  // Order validations
  orderId: param('orderId')
    .isInt({ min: 1 })
    .withMessage('Valid order ID is required'),
  
  guestCount: body('guest_count')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Guest count must be between 1 and 50'),
  
  // Order item validations
  productId: body('product_id')
    .isInt({ min: 1 })
    .withMessage('Valid product ID is required'),
  
  quantity: body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  
  itemNotes: body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  // Product validations
  productName: body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Product name must be 2-150 characters'),
  
  price: body('price')
    .isFloat({ min: 0.01, max: 99999.99 })
    .withMessage('Price must be between 0.01 and 99999.99'),
  
  categoryId: body('category_id')
    .isInt({ min: 1 })
    .withMessage('Valid category ID is required'),
  
  // Payment validations
  paymentMethodId: body('payment_method_id')
    .isInt({ min: 1 })
    .withMessage('Valid payment method ID is required'),
  
  amountPaid: body('amount_paid')
    .isFloat({ min: 0.01 })
    .withMessage('Amount paid must be positive'),
  
  tipAmount: body('tip_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tip amount cannot be negative'),
  
  // Generic ID parameter
  id: param('id')
    .isInt({ min: 1 })
    .withMessage('Valid ID is required'),
  
  // Pagination
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
};

module.exports = {
  validate,
  validations,
  body,
  param,
  query
};
