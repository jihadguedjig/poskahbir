/**
 * Payment Controller
 * Handles payment processing and validation
 */

const db = require("../config/database");
const { ApiError } = require("../middleware/errorHandler");
const { logger } = require("../utils/logger");
const { logAudit } = require("./authController");

/**
 * Generate unique payment number
 */
const generatePaymentNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `PAY-${dateStr}-${random}`;
};

/**
 * Get payment methods (active only for cashier; all if include_inactive and permission)
 * GET /api/payments/methods
 */
const getPaymentMethods = async (req, res, next) => {
  try {
    const includeInactive =
      req.query.include_inactive === "true" &&
      req.user.permissions?.payments?.includes("update");
    const query = includeInactive
      ? "SELECT * FROM payment_methods ORDER BY id"
      : "SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY id";
    const methods = await db.query(query);
    res.json({ success: true, data: methods });
  } catch (error) {
    next(error);
  }
};

/**
 * Create payment method
 * POST /api/payments/methods
 */
const createPaymentMethod = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const result = await db.query(
      "INSERT INTO payment_methods (name, description) VALUES (?, ?)",
      [name, description || null]
    );
    const id = result.insertId;
    await logAudit(
      req.user.id,
      "PAYMENT_METHOD_CREATED",
      "payment_method",
      id,
      null,
      { name }
    );
    logger.info(`Payment method "${name}" created by ${req.user.username}`);
    const [row] = await db.query("SELECT * FROM payment_methods WHERE id = ?", [
      id,
    ]);
    res
      .status(201)
      .json({ success: true, message: "Payment method created", data: row });
  } catch (error) {
    next(error);
  }
};

/**
 * Update payment method
 * PUT /api/payments/methods/:id
 */
const updatePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    const [existing] = await db.query(
      "SELECT * FROM payment_methods WHERE id = ?",
      [id]
    );
    if (!existing) throw ApiError.notFound("Payment method not found");
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(!!is_active);
    }
    if (updates.length === 0) throw ApiError.badRequest("No fields to update");
    values.push(id);
    await db.query(
      `UPDATE payment_methods SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
    await logAudit(
      req.user.id,
      "PAYMENT_METHOD_UPDATED",
      "payment_method",
      id,
      existing,
      req.body
    );
    const [row] = await db.query("SELECT * FROM payment_methods WHERE id = ?", [
      id,
    ]);
    res.json({ success: true, message: "Payment method updated", data: row });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete payment method (soft: set is_active = false)
 * DELETE /api/payments/methods/:id
 */
const deletePaymentMethod = async (req, res, next) => {
  try {
    const id = req.params.methodId || req.params.id;
    const [existing] = await db.query(
      "SELECT * FROM payment_methods WHERE id = ?",
      [id]
    );
    if (!existing) throw ApiError.notFound("Payment method not found");
    await db.query(
      "UPDATE payment_methods SET is_active = FALSE WHERE id = ?",
      [id]
    );
    await logAudit(
      req.user.id,
      "PAYMENT_METHOD_DELETED",
      "payment_method",
      id,
      null,
      null
    );
    logger.info(
      `Payment method "${existing.name}" deactivated by ${req.user.username}`
    );
    res.json({ success: true, message: "Payment method deactivated" });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payments with optional filters
 * GET /api/payments
 */
const getPayments = async (req, res, next) => {
  try {
    const {
      date,
      cashier_id,
      payment_method_id,
      page = 1,
      limit = 50,
    } = req.query;

    let query = `
      SELECT p.*, 
             o.order_number, o.table_id,
             t.table_number,
             pm.name as payment_method_name,
             u.full_name as cashier_name
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      JOIN payment_methods pm ON p.payment_method_id = pm.id
      JOIN users u ON p.cashier_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (date) {
      query += " AND DATE(p.paid_at) = ?";
      params.push(date);
    }

    if (cashier_id) {
      query += " AND p.cashier_id = ?";
      params.push(cashier_id);
    }

    if (payment_method_id) {
      query += " AND p.payment_method_id = ?";
      params.push(payment_method_id);
    }

    query += " ORDER BY p.paid_at DESC";

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const payments = await db.query(query, params);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment by ID
 * GET /api/payments/:id
 */
const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [payment] = await db.query(
      `SELECT p.*, 
              o.order_number, o.table_id, o.server_id,
              t.table_number,
              pm.name as payment_method_name,
              u.full_name as cashier_name,
              s.full_name as server_name
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       JOIN users u ON p.cashier_id = u.id
       JOIN users s ON o.server_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process payment for an order
 * POST /api/payments
 */
const processPayment = async (req, res, next) => {
  try {
    const {
      order_id,
      payment_method_id,
      amount_paid,
      tip_amount = 0,
      reference_number,
      notes,
    } = req.body;
    const cashierId = req.user.id;

    // Only cashiers and admins can process payments
    if (!["cashier", "admin"].includes(req.user.role_name)) {
      throw ApiError.forbidden("Only cashiers can process payments");
    }

    const result = await db.transaction(async (connection) => {
      // Get order with lock
      const [[order]] = await connection.execute(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [order_id]
      );

      if (!order) {
        throw ApiError.notFound("Order not found");
      }

      if (order.status === "paid") {
        throw ApiError.badRequest("Order is already paid");
      }

      if (order.status === "cancelled" || order.status === "void") {
        throw ApiError.badRequest("Cannot pay for a cancelled/void order");
      }

      // Verify payment method
      const [[paymentMethod]] = await connection.execute(
        "SELECT * FROM payment_methods WHERE id = ? AND is_active = TRUE",
        [payment_method_id]
      );

      if (!paymentMethod) {
        throw ApiError.badRequest("Invalid payment method");
      }

      // Calculate amounts
      const amountDue = parseFloat(order.total_amount);
      const totalRequired = amountDue + parseFloat(tip_amount);
      const amountPaidNum = parseFloat(amount_paid);

      if (amountPaidNum < totalRequired) {
        throw ApiError.badRequest(
          `Insufficient payment. Required: ${totalRequired.toFixed(
            2
          )}, Received: ${amountPaidNum.toFixed(2)}`
        );
      }

      const changeAmount = amountPaidNum - totalRequired;

      // Generate payment number
      const paymentNumber = generatePaymentNumber();

      // Create payment record
      const [paymentResult] = await connection.execute(
        `INSERT INTO payments (
          payment_number, order_id, payment_method_id, cashier_id,
          amount_due, amount_paid, change_amount, tip_amount,
          reference_number, notes, status, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW())`,
        [
          paymentNumber,
          order_id,
          payment_method_id,
          cashierId,
          amountDue,
          amountPaidNum,
          changeAmount,
          tip_amount,
          reference_number || null,
          notes || null,
        ]
      );

      const paymentId = paymentResult.insertId;

      // Update order status
      await connection.execute(
        `UPDATE orders SET status = 'paid', closed_at = NOW() WHERE id = ?`,
        [order_id]
      );

      // Update all order items to served
      await connection.execute(
        `UPDATE order_items SET status = 'served', served_at = NOW() 
         WHERE order_id = ? AND status != 'cancelled'`,
        [order_id]
      );

      // Free up the table (skip for takeaway – no table_id)
      if (order.table_id != null) {
        await connection.execute(
          `UPDATE restaurant_tables 
           SET status = 'available', 
               current_order_id = NULL,
               locked_by_user_id = NULL,
               locked_at = NULL
           WHERE id = ?`,
          [order.table_id]
        );
      }

      return {
        paymentId,
        paymentNumber,
        amountDue,
        amountPaid: amountPaidNum,
        changeAmount,
        tableId: order.table_id,
      };
    });

    // Log audit
    await logAudit(
      cashierId,
      "PAYMENT_PROCESSED",
      "payment",
      result.paymentId,
      null,
      {
        order_id,
        amount_due: result.amountDue,
        amount_paid: result.amountPaid,
        payment_method_id,
      }
    );

    logger.info(
      `Payment ${result.paymentNumber} processed for order ${order_id} by ${req.user.username}`
    );

    // Fetch complete payment info
    const [payment] = await db.query(
      `SELECT p.*, 
              o.order_number, o.table_id,
              t.table_number,
              pm.name as payment_method_name,
              u.full_name as cashier_name
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       LEFT JOIN restaurant_tables t ON o.table_id = t.id
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       JOIN users u ON p.cashier_id = u.id
       WHERE p.id = ?`,
      [result.paymentId]
    );

    res.status(201).json({
      success: true,
      message: "Payment processed successfully",
      data: {
        payment,
        change: result.changeAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get daily sales summary
 * GET /api/payments/summary/daily
 */
const getDailySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Sales summary
    const [summary] = await db.query(
      `SELECT 
         COUNT(DISTINCT p.order_id) as total_orders,
         SUM(p.amount_due) as gross_sales,
         SUM(p.tip_amount) as total_tips,
         AVG(p.amount_due) as average_order_value
       FROM payments p
       WHERE p.status = 'completed' AND DATE(p.paid_at) = ?`,
      [targetDate]
    );

    // Sales by payment method
    const byMethod = await db.query(
      `SELECT 
         pm.name as payment_method,
         COUNT(*) as transaction_count,
         SUM(p.amount_due) as total_amount
       FROM payments p
       JOIN payment_methods pm ON p.payment_method_id = pm.id
       WHERE p.status = 'completed' AND DATE(p.paid_at) = ?
       GROUP BY pm.id
       ORDER BY total_amount DESC`,
      [targetDate]
    );

    // Sales by hour
    const byHour = await db.query(
      `SELECT 
         HOUR(p.paid_at) as hour,
         COUNT(*) as order_count,
         SUM(p.amount_due) as total_amount
       FROM payments p
       WHERE p.status = 'completed' AND DATE(p.paid_at) = ?
       GROUP BY HOUR(p.paid_at)
       ORDER BY hour`,
      [targetDate]
    );

    // Top servers
    const topServers = await db.query(
      `SELECT 
         u.full_name as server_name,
         COUNT(DISTINCT o.id) as order_count,
         SUM(p.amount_due) as total_sales
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       JOIN users u ON o.server_id = u.id
       WHERE p.status = 'completed' AND DATE(p.paid_at) = ?
       GROUP BY o.server_id
       ORDER BY total_sales DESC
       LIMIT 10`,
      [targetDate]
    );

    res.json({
      success: true,
      data: {
        date: targetDate,
        summary: {
          totalOrders: parseInt(summary.total_orders) || 0,
          grossSales: parseFloat(summary.gross_sales) || 0,
          totalTips: parseFloat(summary.total_tips) || 0,
          averageOrderValue: parseFloat(summary.average_order_value) || 0,
        },
        byPaymentMethod: byMethod,
        byHour,
        topServers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sales report for date range
 * GET /api/payments/report
 */
const getSalesReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      throw ApiError.badRequest("Start date and end date are required");
    }

    // Daily breakdown
    const dailyData = await db.query(
      `SELECT 
         DATE(p.paid_at) as date,
         COUNT(DISTINCT p.order_id) as order_count,
         SUM(p.amount_due) as gross_sales,
         SUM(p.tip_amount) as tips
       FROM payments p
       WHERE p.status = 'completed' 
         AND DATE(p.paid_at) BETWEEN ? AND ?
       GROUP BY DATE(p.paid_at)
       ORDER BY date`,
      [start_date, end_date]
    );

    // Category breakdown
    const categoryData = await db.query(
      `SELECT 
         c.name as category_name,
         SUM(oi.quantity) as quantity_sold,
         SUM(oi.subtotal) as total_sales
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products pr ON oi.product_id = pr.id
       JOIN categories c ON pr.category_id = c.id
       WHERE p.status = 'completed' 
         AND DATE(p.paid_at) BETWEEN ? AND ?
         AND oi.status != 'cancelled'
       GROUP BY c.id
       ORDER BY total_sales DESC`,
      [start_date, end_date]
    );

    // Top products
    const topProducts = await db.query(
      `SELECT 
         pr.name as product_name,
         c.name as category_name,
         SUM(oi.quantity) as quantity_sold,
         SUM(oi.subtotal) as total_sales
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products pr ON oi.product_id = pr.id
       JOIN categories c ON pr.category_id = c.id
       WHERE p.status = 'completed' 
         AND DATE(p.paid_at) BETWEEN ? AND ?
         AND oi.status != 'cancelled'
       GROUP BY pr.id
       ORDER BY total_sales DESC
       LIMIT 20`,
      [start_date, end_date]
    );

    // Summary totals
    const [totals] = await db.query(
      `SELECT 
         COUNT(DISTINCT p.order_id) as total_orders,
         SUM(p.amount_due) as total_sales,
         SUM(p.tip_amount) as total_tips,
         AVG(p.amount_due) as average_order_value
       FROM payments p
       WHERE p.status = 'completed' 
         AND DATE(p.paid_at) BETWEEN ? AND ?`,
      [start_date, end_date]
    );

    // Server totals (orders and revenue per server)
    const serverTotals = await db.query(
      `SELECT 
         u.id as server_id,
         u.full_name as server_name,
         COUNT(DISTINCT o.id) as order_count,
         SUM(p.amount_due) as total_sales
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       JOIN users u ON o.server_id = u.id
       WHERE p.status = 'completed' 
         AND DATE(p.paid_at) BETWEEN ? AND ?
       GROUP BY o.server_id
       ORDER BY total_sales DESC`,
      [start_date, end_date]
    );

    res.json({
      success: true,
      data: {
        period: { startDate: start_date, endDate: end_date },
        summary: {
          totalOrders: parseInt(totals.total_orders) || 0,
          totalSales: parseFloat(totals.total_sales) || 0,
          totalTips: parseFloat(totals.total_tips) || 0,
          averageOrderValue: parseFloat(totals.average_order_value) || 0,
        },
        daily: dailyData,
        byCategory: categoryData,
        topProducts,
        serverTotals,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPayments,
  getPaymentById,
  processPayment,
  getDailySummary,
  getSalesReport,
};
