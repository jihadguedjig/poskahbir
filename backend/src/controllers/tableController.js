/**
 * Table Management Controller
 * Handles restaurant table operations and status management
 */

const db = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { logAudit } = require('./authController');

/**
 * Get all tables with their current status
 * GET /api/tables
 */
const getTables = async (req, res, next) => {
  try {
    const { status, section, include_inactive } = req.query;
    const showInactive = include_inactive === 'true' &&
      req.user.permissions?.tables?.includes('update');

    let query = `
      SELECT t.id, t.table_number, t.capacity, t.status, t.section,
             t.position_x, t.position_y, t.current_order_id,
             t.locked_by_user_id, t.locked_at, t.is_active,
             o.order_number, o.total_amount as current_total,
             o.opened_at as order_opened_at, o.guest_count,
             u.full_name as server_name, u.id as server_id
      FROM restaurant_tables t
      LEFT JOIN orders o ON t.current_order_id = o.id
      LEFT JOIN users u ON o.server_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (!showInactive) {
      query += ' AND t.is_active = TRUE';
    }
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (section) {
      query += ' AND t.section = ?';
      params.push(section);
    }

    query += ' ORDER BY t.table_number';
    const tables = await db.query(query, params);
    res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single table with full details
 * GET /api/tables/:id
 */
const getTableById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [table] = await db.query(
      `SELECT t.*, 
              o.id as order_id, o.order_number, o.total_amount, o.subtotal,
              o.opened_at, o.guest_count, o.status as order_status,
              u.full_name as server_name, u.id as server_id
       FROM restaurant_tables t
       LEFT JOIN orders o ON t.current_order_id = o.id
       LEFT JOIN users u ON o.server_id = u.id
       WHERE t.id = ?`,
      [id]
    );
    
    if (!table) {
      throw ApiError.notFound('Table not found');
    }
    
    // If there's an active order, get the items
    if (table.order_id) {
      const items = await db.query(
        `SELECT oi.*, p.name as product_name, p.category_id,
                c.name as category_name,
                u.full_name as added_by_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN categories c ON p.category_id = c.id
         JOIN users u ON oi.added_by_user_id = u.id
         WHERE oi.order_id = ? AND oi.status != 'cancelled'
         ORDER BY oi.added_at`,
        [table.order_id]
      );
      table.order_items = items;
    }
    
    res.json({
      success: true,
      data: table
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get table by table number
 * GET /api/tables/number/:tableNumber
 */
const getTableByNumber = async (req, res, next) => {
  try {
    const { tableNumber } = req.params;
    
    const [table] = await db.query(
      `SELECT t.*, 
              o.id as order_id, o.order_number, o.total_amount, o.subtotal,
              o.opened_at, o.guest_count, o.status as order_status,
              u.full_name as server_name, u.id as server_id
       FROM restaurant_tables t
       LEFT JOIN orders o ON t.current_order_id = o.id
       LEFT JOIN users u ON o.server_id = u.id
       WHERE t.table_number = ? AND t.is_active = TRUE`,
      [tableNumber]
    );
    
    if (!table) {
      throw ApiError.notFound('Table not found');
    }
    
    // If there's an active order, get the items
    if (table.order_id) {
      const items = await db.query(
        `SELECT oi.*, p.name as product_name, p.category_id,
                c.name as category_name,
                u.full_name as added_by_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN categories c ON p.category_id = c.id
         JOIN users u ON oi.added_by_user_id = u.id
         WHERE oi.order_id = ? AND oi.status != 'cancelled'
         ORDER BY oi.added_at`,
        [table.order_id]
      );
      table.order_items = items;
    }
    
    res.json({
      success: true,
      data: table
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lock a table for a server
 * POST /api/tables/:id/lock
 */
const lockTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await db.transaction(async (connection) => {
      // Get table with lock
      const [[table]] = await connection.execute(
        'SELECT * FROM restaurant_tables WHERE id = ? FOR UPDATE',
        [id]
      );
      
      if (!table) {
        throw ApiError.notFound('Table not found');
      }
      
      // Check if already locked by another user
      if (table.locked_by_user_id && table.locked_by_user_id !== userId) {
        // Check if lock is stale (more than 30 minutes)
        const lockAge = Date.now() - new Date(table.locked_at).getTime();
        const maxLockAge = 30 * 60 * 1000; // 30 minutes
        
        if (lockAge < maxLockAge) {
          throw ApiError.conflict('Table is currently being used by another server');
        }
      }
      
      // Lock the table
      await connection.execute(
        `UPDATE restaurant_tables 
         SET locked_by_user_id = ?, locked_at = NOW()
         WHERE id = ?`,
        [userId, id]
      );
    });
    
    logger.info(`Table ${id} locked by user ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Table locked successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unlock a table
 * POST /api/tables/:id/unlock
 */
const unlockTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role_name === 'admin';
    
    await db.transaction(async (connection) => {
      const [[table]] = await connection.execute(
        'SELECT * FROM restaurant_tables WHERE id = ? FOR UPDATE',
        [id]
      );
      
      if (!table) {
        throw ApiError.notFound('Table not found');
      }
      
      // Only the locking user or admin can unlock
      if (table.locked_by_user_id !== userId && !isAdmin) {
        throw ApiError.forbidden('Only the server who locked the table can unlock it');
      }
      
      // Unlock the table (only if no active order)
      if (table.current_order_id && table.status === 'occupied') {
        throw ApiError.badRequest('Cannot unlock table with active order');
      }
      
      await connection.execute(
        `UPDATE restaurant_tables 
         SET locked_by_user_id = NULL, locked_at = NULL
         WHERE id = ?`,
        [id]
      );
    });
    
    logger.info(`Table ${id} unlocked by user ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Table unlocked successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update table status
 * PATCH /api/tables/:id/status
 */
const updateTableStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
    
    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest('Invalid status');
    }
    
    const [table] = await db.query(
      'SELECT * FROM restaurant_tables WHERE id = ?',
      [id]
    );
    
    if (!table) {
      throw ApiError.notFound('Table not found');
    }
    
    // If marking as available, clear order reference
    const updates = { status };
    if (status === 'available') {
      updates.current_order_id = null;
      updates.locked_by_user_id = null;
      updates.locked_at = null;
    }
    
    await db.query(
      `UPDATE restaurant_tables 
       SET status = ?, 
           current_order_id = ${status === 'available' ? 'NULL' : 'current_order_id'},
           locked_by_user_id = ${status === 'available' ? 'NULL' : 'locked_by_user_id'},
           locked_at = ${status === 'available' ? 'NULL' : 'locked_at'}
       WHERE id = ?`,
      [status, id]
    );
    
    // Log audit
    await logAudit(req.user.id, 'TABLE_STATUS_CHANGED', 'table', id,
      { status: table.status },
      { status }
    );
    
    logger.info(`Table ${table.table_number} status changed to ${status} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: `Table status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get table sections
 * GET /api/tables/sections
 */
const getTableSections = async (req, res, next) => {
  try {
    const sections = await db.query(
      `SELECT DISTINCT section, COUNT(*) as table_count
       FROM restaurant_tables
       WHERE is_active = TRUE
       GROUP BY section
       ORDER BY section`
    );
    
    res.json({
      success: true,
      data: sections
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tables summary (counts by status)
 * GET /api/tables/summary
 */
const getTablesSummary = async (req, res, next) => {
  try {
    const [summary] = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
         SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
         SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved,
         SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
       FROM restaurant_tables
       WHERE is_active = TRUE`
    );
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

/**
 * Create table
 * POST /api/tables
 */
const createTable = async (req, res, next) => {
  try {
    const { table_number, capacity, section, position_x, position_y } = req.body;
    const [existing] = await db.query(
      'SELECT id FROM restaurant_tables WHERE table_number = ?',
      [table_number]
    );
    if (existing) throw ApiError.conflict('Table number already exists');
    const result = await db.query(
      `INSERT INTO restaurant_tables (table_number, capacity, section, position_x, position_y)
       VALUES (?, ?, ?, ?, ?)`,
      [table_number, capacity ?? 4, section || null, position_x ?? 0, position_y ?? 0]
    );
    const id = result.insertId;
    await logAudit(req.user.id, 'TABLE_CREATED', 'table', id, null, { table_number });
    logger.info(`Table ${table_number} created by ${req.user.username}`);
    const [row] = await db.query('SELECT * FROM restaurant_tables WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Table created', data: row });
  } catch (error) {
    next(error);
  }
};

/**
 * Update table (table_number, capacity, section, position, is_active)
 * PUT /api/tables/:id
 */
const updateTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { table_number, capacity, section, position_x, position_y, is_active } = req.body;
    const [existing] = await db.query('SELECT * FROM restaurant_tables WHERE id = ?', [id]);
    if (!existing) throw ApiError.notFound('Table not found');
    if (table_number != null && table_number !== existing.table_number) {
      const [dup] = await db.query('SELECT id FROM restaurant_tables WHERE table_number = ? AND id != ?', [table_number, id]);
      if (dup) throw ApiError.conflict('Table number already exists');
    }
    const updates = [];
    const values = [];
    if (table_number !== undefined) { updates.push('table_number = ?'); values.push(table_number); }
    if (capacity !== undefined) { updates.push('capacity = ?'); values.push(capacity); }
    if (section !== undefined) { updates.push('section = ?'); values.push(section); }
    if (position_x !== undefined) { updates.push('position_x = ?'); values.push(position_x); }
    if (position_y !== undefined) { updates.push('position_y = ?'); values.push(position_y); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(!!is_active); }
    if (updates.length === 0) throw ApiError.badRequest('No fields to update');
    values.push(id);
    await db.query(`UPDATE restaurant_tables SET ${updates.join(', ')} WHERE id = ?`, values);
    await logAudit(req.user.id, 'TABLE_UPDATED', 'table', id, existing, req.body);
    const [row] = await db.query('SELECT * FROM restaurant_tables WHERE id = ?', [id]);
    res.json({ success: true, message: 'Table updated', data: row });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete table (soft: set is_active = false)
 * DELETE /api/tables/:id
 */
const deleteTable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await db.query('SELECT * FROM restaurant_tables WHERE id = ?', [id]);
    if (!existing) throw ApiError.notFound('Table not found');
    if (existing.current_order_id) {
      throw ApiError.badRequest('Cannot deactivate table with an active order. Close the order first.');
    }
    await db.query('UPDATE restaurant_tables SET is_active = FALSE, status = ? WHERE id = ?', ['available', id]);
    await logAudit(req.user.id, 'TABLE_DELETED', 'table', id, null, null);
    logger.info(`Table ${existing.table_number} deactivated by ${req.user.username}`);
    res.json({ success: true, message: 'Table deactivated' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTables,
  getTableById,
  getTableByNumber,
  lockTable,
  unlockTable,
  updateTableStatus,
  getTableSections,
  getTablesSummary,
  createTable,
  updateTable,
  deleteTable
};
