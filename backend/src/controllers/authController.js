/**
 * Authentication Controller
 * Handles PIN-based authentication and session management
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Login with username and PIN
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { username, pin } = req.body;
    
    // Find user by username
    const [user] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.pin_hash, u.role_id, u.is_active,
              r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = ?`,
      [username]
    );
    
    if (!user) {
      // Use same message for security (don't reveal if user exists)
      throw ApiError.unauthorized('Invalid username or PIN');
    }
    
    if (!user.is_active) {
      throw ApiError.unauthorized('Account is deactivated. Contact administrator.');
    }
    
    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, user.pin_hash);
    
    if (!isValidPin) {
      // Log failed attempt
      await logAudit(null, 'LOGIN_FAILED', 'user', user.id, null, { username });
      throw ApiError.unauthorized('Invalid username or PIN');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        roleId: user.role_id,
        roleName: user.role_name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    
    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );
    
    // Log successful login
    await logAudit(user.id, 'LOGIN_SUCCESS', 'user', user.id, null, { username });
    
    logger.info(`User logged in: ${user.username}`);
    
    // Parse permissions
    const permissions = typeof user.permissions === 'string' 
      ? JSON.parse(user.permissions) 
      : user.permissions;
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role_name,
          permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify current token and return user info
 * GET /api/auth/verify
 */
const verifyToken = async (req, res, next) => {
  try {
    // User is already attached by authenticate middleware
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          username: req.user.username,
          fullName: req.user.full_name,
          role: req.user.role_name,
          permissions: req.user.permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update authenticated user's profile (full_name only)
 * PATCH /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { full_name } = req.body;
    const userId = req.user.id;

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      throw ApiError.badRequest('Full name must be at least 2 characters');
    }

    await db.query(
      'UPDATE users SET full_name = ? WHERE id = ?',
      [full_name.trim(), userId]
    );

    await logAudit(userId, 'PROFILE_UPDATED', 'user', userId, { full_name: req.user.full_name }, { full_name: full_name.trim() });
    logger.info(`Profile updated for user: ${req.user.username}`);

    const [user] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.role_id, u.is_active,
              r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );
    user.permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role_name,
          permissions: user.permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change PIN for authenticated user
 * POST /api/auth/change-pin
 */
const changePin = async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body;
    const userId = req.user.id;
    
    // Get current pin hash
    const [user] = await db.query(
      'SELECT pin_hash FROM users WHERE id = ?',
      [userId]
    );
    
    // Verify current PIN
    const isValidPin = await bcrypt.compare(currentPin, user.pin_hash);
    
    if (!isValidPin) {
      throw ApiError.unauthorized('Current PIN is incorrect');
    }
    
    // Hash new PIN
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const newPinHash = await bcrypt.hash(newPin, saltRounds);
    
    // Update PIN
    await db.query(
      'UPDATE users SET pin_hash = ? WHERE id = ?',
      [newPinHash, userId]
    );
    
    // Log PIN change
    await logAudit(userId, 'PIN_CHANGED', 'user', userId, null, null);
    
    logger.info(`PIN changed for user: ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'PIN changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (client-side token removal, server-side logging)
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    // Log logout
    await logAudit(req.user.id, 'LOGOUT', 'user', req.user.id, null, null);
    
    logger.info(`User logged out: ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to log audit events
 */
const logAudit = async (userId, action, entityType, entityId, oldValues, newValues) => {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null
      ]
    );
  } catch (error) {
    logger.error('Failed to log audit:', error);
  }
};

/**
 * Get list of users for login dropdown (full_name, username)
 * GET /api/auth/login-options
 * Public - no auth required
 */
const getLoginOptions = async (req, res, next) => {
  try {
    const users = await db.query(
      `SELECT u.username, u.full_name
       FROM users u
       WHERE u.is_active = TRUE
       ORDER BY u.full_name`,
      []
    );
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getLoginOptions,
  verifyToken,
  updateProfile,
  changePin,
  logout,
  logAudit
};
