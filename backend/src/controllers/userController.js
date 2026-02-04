/**
 * User Management Controller
 * Handles CRUD operations for users and roles
 */

const bcrypt = require('bcrypt');
const db = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { logAudit } = require('./authController');

/**
 * Get all users with their roles
 * GET /api/users
 */
const getUsers = async (req, res, next) => {
  try {
    let users = await db.query(
      `SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, 
              u.last_login, u.created_at,
              r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.full_name`
    );

    // Moderator sees only servers and cashiers
    if (req.user.role_name === 'moderator') {
      users = users.filter(u => u.role_name === 'server' || u.role_name === 'cashier');
    }
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single user by ID
 * GET /api/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [user] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.role_id, u.is_active,
              u.last_login, u.created_at, u.updated_at,
              r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );
    
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    
    // Parse permissions
    user.permissions = typeof user.permissions === 'string'
      ? JSON.parse(user.permissions)
      : user.permissions;
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new user
 * POST /api/users
 */
const createUser = async (req, res, next) => {
  try {
    const { username, full_name, pin, role_id } = req.body;
    
    // Check if username exists
    const [existingUser] = await db.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existingUser) {
      throw ApiError.conflict('Username already exists');
    }
    
    // Verify role exists
    const [role] = await db.query(
      'SELECT id, name FROM roles WHERE id = ?',
      [role_id]
    );
    
    if (!role) {
      throw ApiError.badRequest('Invalid role ID');
    }

    // Moderator can only create server or cashier users
    if (req.user.role_name === 'moderator' && !['server', 'cashier'].includes(role.name)) {
      throw ApiError.forbidden('You can only create server or cashier users');
    }
    
    // Hash PIN
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const pinHash = await bcrypt.hash(pin, saltRounds);
    
    // Insert user
    const result = await db.query(
      `INSERT INTO users (username, full_name, pin_hash, role_id)
       VALUES (?, ?, ?, ?)`,
      [username, full_name, pinHash, role_id]
    );
    
    const userId = result.insertId;
    
    // Log audit
    await logAudit(req.user.id, 'USER_CREATED', 'user', userId, null, {
      username,
      full_name,
      role_id
    });
    
    logger.info(`User created: ${username} by ${req.user.username}`);
    
    // Fetch created user
    const [newUser] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, u.created_at,
              r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, role_id, is_active } = req.body;
    
    // Get current user data with role name
    const [currentUser] = await db.query(
      `SELECT u.*, r.name as role_name FROM users u
       JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );
    
    if (!currentUser) {
      throw ApiError.notFound('User not found');
    }

    // Moderator cannot edit admin or moderator users
    if (req.user.role_name === 'moderator' && ['admin', 'moderator'].includes(currentUser.role_name)) {
      throw ApiError.forbidden('You cannot edit this user');
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (full_name !== undefined) {
      updates.push('full_name = ?');
      values.push(full_name);
    }
    
    if (role_id !== undefined) {
      // Verify role exists
      const [role] = await db.query('SELECT id, name FROM roles WHERE id = ?', [role_id]);
      if (!role) {
        throw ApiError.badRequest('Invalid role ID');
      }
      // Moderator can only assign server or cashier role
      if (req.user.role_name === 'moderator' && !['server', 'cashier'].includes(role.name)) {
        throw ApiError.forbidden('You can only assign server or cashier role');
      }
      updates.push('role_id = ?');
      values.push(role_id);
    }
    
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Log audit
    await logAudit(req.user.id, 'USER_UPDATED', 'user', id, 
      { full_name: currentUser.full_name, role_id: currentUser.role_id, is_active: currentUser.is_active },
      { full_name, role_id, is_active }
    );
    
    logger.info(`User updated: ${currentUser.username} by ${req.user.username}`);
    
    // Fetch updated user
    const [updatedUser] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.role_id, u.is_active, u.created_at,
              r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset user PIN (admin only)
 * POST /api/users/:id/reset-pin
 */
const resetUserPin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_pin } = req.body;
    
    // Check user exists
    const [user] = await db.query(
      'SELECT username FROM users WHERE id = ?',
      [id]
    );
    
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    
    // Hash new PIN
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    const pinHash = await bcrypt.hash(new_pin, saltRounds);
    
    // Update PIN
    await db.query(
      'UPDATE users SET pin_hash = ? WHERE id = ?',
      [pinHash, id]
    );
    
    // Log audit
    await logAudit(req.user.id, 'USER_PIN_RESET', 'user', id, null, null);
    
    logger.info(`PIN reset for user: ${user.username} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'PIN reset successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (soft delete by deactivating)
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      throw ApiError.badRequest('You cannot delete your own account');
    }
    
    // Check user exists with role
    const [user] = await db.query(
      `SELECT u.username, r.name as role_name FROM users u
       JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );
    
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Moderator cannot deactivate admin or moderator users
    if (req.user.role_name === 'moderator' && ['admin', 'moderator'].includes(user.role_name)) {
      throw ApiError.forbidden('You cannot deactivate this user');
    }
    
    // Soft delete (deactivate)
    await db.query(
      'UPDATE users SET is_active = FALSE WHERE id = ?',
      [id]
    );
    
    // Log audit
    await logAudit(req.user.id, 'USER_DELETED', 'user', id, null, null);
    
    logger.info(`User deactivated: ${user.username} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all roles
 * GET /api/roles
 */
const getRoles = async (req, res, next) => {
  try {
    const roles = await db.query(
      'SELECT id, name, description, permissions FROM roles ORDER BY id'
    );
    
    // Parse permissions
    roles.forEach(role => {
      role.permissions = typeof role.permissions === 'string'
        ? JSON.parse(role.permissions)
        : role.permissions;
    });
    
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPin,
  deleteUser,
  getRoles
};
