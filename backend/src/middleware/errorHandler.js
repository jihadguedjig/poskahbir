/**
 * Error Handling Middleware
 * Provides consistent error responses across the API
 */

const { logger } = require('../utils/logger');

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  static badRequest(message, details = null) {
    return new ApiError(400, message, details);
  }
  
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }
  
  static forbidden(message = 'Access denied') {
    return new ApiError(403, message);
  }
  
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
  
  static conflict(message, details = null) {
    return new ApiError(409, message, details);
  }
  
  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 internal server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;
  
  // Handle specific MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Duplicate entry. This record already exists.';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced record does not exist.';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 400;
    message = 'Cannot delete. Record is referenced by other data.';
  }
  
  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    statusCode = 400;
    message = 'Validation failed';
    details = err.array();
  }
  
  // Log error
  if (statusCode >= 500) {
    logger.error('Server error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  } else {
    logger.warn('Client error:', {
      message: err.message,
      statusCode,
      path: req.path,
      method: req.method
    });
  }
  
  // Send response
  const response = {
    success: false,
    error: {
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };
  
  res.status(statusCode).json(response);
};

module.exports = {
  ApiError,
  errorHandler,
  notFoundHandler
};
