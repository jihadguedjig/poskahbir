/**
 * Authentication and Authorization Middleware
 * Handles JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const db = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch fresh user data to ensure account is still active
      const [user] = await db.query(
        `SELECT u.id, u.username, u.full_name, u.role_id, u.is_active,
                r.name as role_name, r.permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [decoded.userId]
      );
      
      if (!user || !user.is_active) {
        throw ApiError.unauthorized('User account is inactive or not found');
      }
      
      // Parse permissions JSON
      user.permissions = typeof user.permissions === 'string' 
        ? JSON.parse(user.permissions) 
        : user.permissions;
      
      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Token expired');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        throw ApiError.unauthorized('Invalid token');
      }
      throw jwtError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has required role(s)
 * @param {...string} roles - Allowed role names
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    
    if (!roles.includes(req.user.role_name)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole: req.user.role_name,
        requiredRoles: roles,
        path: req.path
      });
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    
    next();
  };
};

/**
 * Check if user has specific permission
 * @param {string} resource - Resource name (e.g., 'orders')
 * @param {string} action - Action name (e.g., 'create')
 */
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    
    const permissions = req.user.permissions;
    
    if (!permissions[resource] || !permissions[resource].includes(action)) {
      logger.warn('Access denied - insufficient permission', {
        userId: req.user.id,
        resource,
        action,
        path: req.path
      });
      return next(ApiError.forbidden(`You do not have ${action} permission for ${resource}`));
    }
    
    next();
  };
};

/**
 * Optional authentication - attaches user if token present, continues otherwise
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const [user] = await db.query(
        `SELECT u.id, u.username, u.full_name, u.role_id, u.is_active,
                r.name as role_name, r.permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ? AND u.is_active = TRUE`,
        [decoded.userId]
      );
      
      if (user) {
        user.permissions = typeof user.permissions === 'string' 
          ? JSON.parse(user.permissions) 
          : user.permissions;
        req.user = user;
      }
    } catch (jwtError) {
      // Token invalid, but that's OK for optional auth
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  requireRole,
  requirePermission,
  optionalAuth
};
