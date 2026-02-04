/**
 * Order Management Controller
 * Handles order creation, item management, and order lifecycle
 */

const db = require("../config/database");
const { ApiError } = require("../middleware/errorHandler");
const { logger } = require("../utils/logger");
const { logAudit } = require("./authController");

/**
 * Generate unique order number
 */
const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${dateStr}-${random}`;
};

/**
 * Get all orders with optional filters
 * GET /api/orders
 */
const getOrders = async (req, res, next) => {
  try {
    const {
      status,
      server_id,
      table_id,
      date,
      page = 1,
      limit = 50,
    } = req.query;

    let query = `
      SELECT o.*, 
             t.table_number,
             u.full_name as server_name,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status != 'cancelled') as item_count
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      JOIN users u ON o.server_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += " AND o.status = ?";
      params.push(status);
    }

    if (server_id) {
      query += " AND o.server_id = ?";
      params.push(server_id);
    }

    if (table_id) {
      query += " AND o.table_id = ?";
      params.push(table_id);
    }

    if (date) {
      query += " AND DATE(o.opened_at) = ?";
      params.push(date);
    }

    query += " ORDER BY o.opened_at DESC";

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const orders = await db.query(query, params);

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM orders o WHERE 1=1";
    const countParams = [];

    if (status) {
      countQuery += " AND o.status = ?";
      countParams.push(status);
    }
    if (server_id) {
      countQuery += " AND o.server_id = ?";
      countParams.push(server_id);
    }
    if (table_id) {
      countQuery += " AND o.table_id = ?";
      countParams.push(table_id);
    }
    if (date) {
      countQuery += " AND DATE(o.opened_at) = ?";
      countParams.push(date);
    }

    const [{ total }] = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active orders only
 * GET /api/orders/active
 */
const getActiveOrders = async (req, res, next) => {
  try {
    const orders = await db.query(
      `SELECT o.*, 
              t.table_number,
              u.full_name as server_name,
              TIMESTAMPDIFF(MINUTE, o.opened_at, NOW()) as duration_minutes,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status != 'cancelled') as item_count
       FROM orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       JOIN users u ON o.server_id = u.id
       WHERE o.status = 'open'
       ORDER BY o.opened_at ASC`
    );

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single order with all details
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const id = req.params.orderId || req.params.id;

    const [order] = await db.query(
      `SELECT o.*, 
              t.table_number, t.section,
              u.full_name as server_name
       FROM orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       JOIN users u ON o.server_id = u.id
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    // Get order items
    const items = await db.query(
      `SELECT oi.*, 
              p.name as product_name, p.category_id,
              c.name as category_name,
              u.full_name as added_by_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN categories c ON p.category_id = c.id
       JOIN users u ON oi.added_by_user_id = u.id
       WHERE oi.order_id = ?
       ORDER BY oi.added_at`,
      [id]
    );

    order.items = items;

    // Get payment if exists
    const [payment] = await db.query(
      `SELECT p.*, pm.name as payment_method_name, u.full_name as cashier_name
       FROM payments p
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       JOIN users u ON p.cashier_id = u.id
       WHERE p.order_id = ?`,
      [id]
    );

    if (payment) {
      order.payment = payment;
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new order for a table
 * POST /api/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const { table_id, guest_count = 1, notes } = req.body;
    const serverId = req.user.id;
    const isTakeaway =
      table_id == null || table_id === undefined || table_id === "";

    const result = await db.transaction(async (connection) => {
      let tableNumber = null;

      if (!isTakeaway) {
        // Check table availability
        const [[table]] = await connection.execute(
          "SELECT * FROM restaurant_tables WHERE id = ? FOR UPDATE",
          [table_id]
        );

        if (!table) {
          throw ApiError.notFound("Table not found");
        }

        if (table.status === "occupied" && table.current_order_id) {
          throw ApiError.conflict("Table already has an active order");
        }

        if (table.status === "maintenance") {
          throw ApiError.badRequest("Table is under maintenance");
        }

        // Check if locked by another user
        if (table.locked_by_user_id && table.locked_by_user_id !== serverId) {
          const lockAge = Date.now() - new Date(table.locked_at).getTime();
          const maxLockAge = 30 * 60 * 1000;

          if (lockAge < maxLockAge) {
            throw ApiError.conflict("Table is locked by another server");
          }
        }

        tableNumber = table.table_number;
      }

      // Generate order number
      const orderNumber = generateOrderNumber();

      // Create order (table_id NULL for takeaway)
      const [orderResult] = await connection.execute(
        `INSERT INTO orders (order_number, table_id, server_id, guest_count, notes, status, opened_at)
         VALUES (?, ?, ?, ?, ?, 'open', NOW())`,
        [
          orderNumber,
          isTakeaway ? null : table_id,
          serverId,
          guest_count,
          notes || null,
        ]
      );

      const orderId = orderResult.insertId;

      if (!isTakeaway) {
        // Update table
        await connection.execute(
          `UPDATE restaurant_tables 
           SET status = 'occupied', 
               current_order_id = ?,
               locked_by_user_id = ?,
               locked_at = NOW()
           WHERE id = ?`,
          [orderId, serverId, table_id]
        );
      }

      return { orderId, orderNumber, tableNumber };
    });

    // Log audit
    await logAudit(serverId, "ORDER_CREATED", "order", result.orderId, null, {
      table_id: isTakeaway ? null : table_id,
      guest_count,
      order_number: result.orderNumber,
      takeaway: isTakeaway,
    });

    logger.info(
      `Order ${result.orderNumber} created ${
        result.tableNumber != null
          ? `for table ${result.tableNumber}`
          : "as takeaway"
      } by ${req.user.username}`
    );

    // Fetch complete order (LEFT JOIN for takeaway)
    const [order] = await db.query(
      `SELECT o.*, t.table_number, u.full_name as server_name
       FROM orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       JOIN users u ON o.server_id = u.id
       WHERE o.id = ?`,
      [result.orderId]
    );

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add item to order
 * POST /api/orders/:orderId/items
 */
const addOrderItem = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const {
      product_id,
      quantity,
      notes,
      unit_price: requestUnitPrice,
    } = req.body;
    const userId = req.user.id;

    const result = await db.transaction(async (connection) => {
      // Get order
      const [[order]] = await connection.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [orderId]
      );

      if (!order) {
        throw ApiError.notFound("Order not found");
      }

      if (order.status !== "open") {
        throw ApiError.badRequest("Cannot modify a closed order");
      }

      // Check if user can modify this order (same server or admin/moderator)
      const canModify =
        order.server_id === userId ||
        ["admin", "moderator"].includes(req.user.role_name);

      if (!canModify) {
        throw ApiError.forbidden("You can only modify your own orders");
      }

      // Get product
      const [[product]] = await connection.execute(
        "SELECT * FROM products WHERE id = ? AND is_active = TRUE",
        [product_id]
      );

      if (!product) {
        throw ApiError.notFound("Product not found");
      }

      if (!product.is_available) {
        throw ApiError.badRequest("Product is not available");
      }

      // Check stock if tracking
      if (product.track_stock && product.stock_quantity < quantity) {
        throw ApiError.badRequest(
          `Insufficient stock. Only ${product.stock_quantity} available.`
        );
      }

      // Unit price: for variable-price products use provided unit_price, else product price
      let unitPrice;
      if (
        product.variable_price &&
        requestUnitPrice != null &&
        requestUnitPrice !== ""
      ) {
        unitPrice = parseFloat(requestUnitPrice);
        if (isNaN(unitPrice) || unitPrice < 0) {
          throw ApiError.badRequest(
            "Invalid unit price for variable-price product"
          );
        }
      } else {
        unitPrice = parseFloat(product.price);
      }
      const subtotal = unitPrice * quantity;

      // Insert item
      const [itemResult] = await connection.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, notes, added_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          product_id,
          quantity,
          unitPrice,
          subtotal,
          notes || null,
          userId,
        ]
      );

      // Update stock if tracking
      if (product.track_stock) {
        await connection.execute(
          "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?",
          [quantity, product_id]
        );
      }

      // Update order totals
      await updateOrderTotals(connection, orderId);

      return { itemId: itemResult.insertId, productName: product.name };
    });

    // Log audit
    await logAudit(
      userId,
      "ORDER_ITEM_ADDED",
      "order_item",
      result.itemId,
      null,
      {
        order_id: orderId,
        product_id,
        quantity,
      }
    );

    logger.info(
      `Item "${result.productName}" x${quantity} added to order ${orderId} by ${req.user.username}`
    );

    // Fetch updated order (LEFT JOIN for takeaway)
    const [order] = await db.query(
      `SELECT o.*, t.table_number
       FROM orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       WHERE o.id = ?`,
      [orderId]
    );

    res.status(201).json({
      success: true,
      message: "Item added successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order item quantity
 * PATCH /api/orders/:orderId/items/:itemId
 */
const updateOrderItem = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { quantity, notes } = req.body;
    const userId = req.user.id;

    await db.transaction(async (connection) => {
      // Get order
      const [[order]] = await connection.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [orderId]
      );

      if (!order) {
        throw ApiError.notFound("Order not found");
      }

      if (order.status !== "open") {
        throw ApiError.badRequest("Cannot modify a closed order");
      }

      // Check permission
      const canModify =
        order.server_id === userId ||
        ["admin", "moderator"].includes(req.user.role_name);

      if (!canModify) {
        throw ApiError.forbidden("You can only modify your own orders");
      }

      // Get item
      const [[item]] = await connection.execute(
        `SELECT oi.*, p.track_stock, p.stock_quantity
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.id = ? AND oi.order_id = ?`,
        [itemId, orderId]
      );

      if (!item) {
        throw ApiError.notFound("Order item not found");
      }

      if (item.status === "cancelled") {
        throw ApiError.badRequest("Cannot modify cancelled item");
      }

      // Calculate quantity difference for stock
      const quantityDiff = quantity - item.quantity;

      // Check stock if increasing quantity
      if (
        item.track_stock &&
        quantityDiff > 0 &&
        item.stock_quantity < quantityDiff
      ) {
        throw ApiError.badRequest(
          `Insufficient stock. Only ${item.stock_quantity} more available.`
        );
      }

      // Update item
      const newSubtotal = parseFloat(item.unit_price) * quantity;

      await connection.execute(
        `UPDATE order_items 
         SET quantity = ?, subtotal = ?, notes = ?
         WHERE id = ?`,
        [
          quantity,
          newSubtotal,
          notes !== undefined ? notes : item.notes,
          itemId,
        ]
      );

      // Update stock if tracking
      if (item.track_stock) {
        await connection.execute(
          "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?",
          [quantityDiff, item.product_id]
        );
      }

      // Update order totals
      await updateOrderTotals(connection, orderId);
    });

    // Log audit
    await logAudit(userId, "ORDER_ITEM_UPDATED", "order_item", itemId, null, {
      order_id: orderId,
      quantity,
    });

    logger.info(
      `Order item ${itemId} updated in order ${orderId} by ${req.user.username}`
    );

    // Fetch updated order (LEFT JOIN for takeaway)
    const [order] = await db.query(
      `SELECT o.*, t.table_number
       FROM orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       WHERE o.id = ?`,
      [orderId]
    );

    res.json({
      success: true,
      message: "Item updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove item from order
 * DELETE /api/orders/:orderId/items/:itemId
 */
const removeOrderItem = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const userId = req.user.id;

    await db.transaction(async (connection) => {
      // Get order
      const [[order]] = await connection.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [orderId]
      );

      if (!order) {
        throw ApiError.notFound("Order not found");
      }

      if (order.status !== "open") {
        throw ApiError.badRequest("Cannot modify a closed order");
      }

      // Check permission
      const canModify =
        order.server_id === userId ||
        ["admin", "moderator"].includes(req.user.role_name);

      if (!canModify) {
        throw ApiError.forbidden("You can only modify your own orders");
      }

      // Get item
      const [[item]] = await connection.execute(
        `SELECT oi.*, p.track_stock
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.id = ? AND oi.order_id = ?`,
        [itemId, orderId]
      );

      if (!item) {
        throw ApiError.notFound("Order item not found");
      }

      // Mark as cancelled instead of deleting (for audit)
      await connection.execute(
        `UPDATE order_items SET status = 'cancelled' WHERE id = ?`,
        [itemId]
      );

      // Restore stock if tracking
      if (item.track_stock) {
        await connection.execute(
          "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }

      // Update order totals
      await updateOrderTotals(connection, orderId);
    });

    // Log audit
    await logAudit(userId, "ORDER_ITEM_REMOVED", "order_item", itemId, null, {
      order_id: orderId,
    });

    logger.info(
      `Order item ${itemId} removed from order ${orderId} by ${req.user.username}`
    );

    // Fetch updated order (LEFT JOIN for takeaway)
    const [order] = await db.query(
      `SELECT o.*, t.table_number
       FROM orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       WHERE o.id = ?`,
      [orderId]
    );

    res.json({
      success: true,
      message: "Item removed successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order notes/guest count
 * PATCH /api/orders/:orderId
 */
const updateOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { guest_count, notes } = req.body;
    const userId = req.user.id;

    // Get order
    const [order] = await db.query("SELECT * FROM orders WHERE id = ?", [
      orderId,
    ]);

    if (!order) {
      throw ApiError.notFound("Order not found");
    }

    if (order.status !== "open") {
      throw ApiError.badRequest("Cannot modify a closed order");
    }

    // Check permission
    const canModify =
      order.server_id === userId ||
      ["admin", "moderator"].includes(req.user.role_name);

    if (!canModify) {
      throw ApiError.forbidden("You can only modify your own orders");
    }

    // Update
    const updates = [];
    const values = [];

    if (guest_count !== undefined) {
      updates.push("guest_count = ?");
      values.push(guest_count);
    }

    if (notes !== undefined) {
      updates.push("notes = ?");
      values.push(notes);
    }

    if (updates.length > 0) {
      values.push(orderId);
      await db.query(
        `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }

    // Fetch updated order (LEFT JOIN for takeaway)
    const [updatedOrder] = await db.query(
      `SELECT o.*, t.table_number, u.full_name as server_name
       FROM orders o
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       JOIN users u ON o.server_id = u.id
       WHERE o.id = ?`,
      [orderId]
    );

    res.json({
      success: true,
      message: "Order updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel/void an order
 * POST /api/orders/:orderId/cancel
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    await db.transaction(async (connection) => {
      // Get order
      const [[order]] = await connection.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [orderId]
      );

      if (!order) {
        throw ApiError.notFound("Order not found");
      }

      if (order.status === "paid") {
        throw ApiError.badRequest(
          "Cannot cancel a paid order. Use refund instead."
        );
      }

      if (order.status === "cancelled" || order.status === "void") {
        throw ApiError.badRequest("Order is already cancelled");
      }

      // Only admin/moderator can cancel orders
      if (!["admin", "moderator"].includes(req.user.role_name)) {
        throw ApiError.forbidden("Only administrators can cancel orders");
      }

      // Restore stock for all items
      const [items] = await connection.execute(
        `SELECT oi.*, p.track_stock
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ? AND oi.status != 'cancelled'`,
        [orderId]
      );

      for (const item of items) {
        if (item.track_stock) {
          await connection.execute(
            "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?",
            [item.quantity, item.product_id]
          );
        }
      }

      // Cancel all items
      await connection.execute(
        `UPDATE order_items SET status = 'cancelled' WHERE order_id = ?`,
        [orderId]
      );

      // Cancel order
      await connection.execute(
        `UPDATE orders SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ' | Cancelled: ', ?), closed_at = NOW() WHERE id = ?`,
        [reason || "No reason provided", orderId]
      );

      // Free up table
      await connection.execute(
        `UPDATE restaurant_tables 
         SET status = 'available', current_order_id = NULL, locked_by_user_id = NULL, locked_at = NULL
         WHERE current_order_id = ?`,
        [orderId]
      );
    });

    // Log audit
    await logAudit(userId, "ORDER_CANCELLED", "order", orderId, null, {
      reason,
    });

    logger.info(
      `Order ${orderId} cancelled by ${req.user.username}. Reason: ${reason}`
    );

    res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to update order totals
 */
const updateOrderTotals = async (connection, orderId) => {
  const [[totals]] = await connection.execute(
    `SELECT 
       COALESCE(SUM(subtotal - discount_amount), 0) as subtotal
     FROM order_items 
     WHERE order_id = ? AND status != 'cancelled'`,
    [orderId]
  );

  const subtotal = parseFloat(totals.subtotal) || 0;
  const taxRate = 0; // No tax for now, can be configured
  const taxAmount = subtotal * taxRate;

  await connection.execute(
    `UPDATE orders 
     SET subtotal = ?, tax_amount = ?, total_amount = subtotal + tax_amount - discount_amount
     WHERE id = ?`,
    [subtotal, taxAmount, orderId]
  );
};

module.exports = {
  getOrders,
  getActiveOrders,
  getOrderById,
  createOrder,
  addOrderItem,
  updateOrderItem,
  removeOrderItem,
  updateOrder,
  cancelOrder,
};
