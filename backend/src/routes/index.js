/**
 * Main Routes Index
 * Combines all route modules
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const tableRoutes = require('./tableRoutes');
const orderRoutes = require('./orderRoutes');
const productRoutes = require('./productRoutes');
const paymentRoutes = require('./paymentRoutes');
const uploadRoutes = require('./uploadRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tables', tableRoutes);
router.use('/orders', orderRoutes);
router.use('/products', productRoutes);
router.use('/categories', productRoutes); // Categories are in productRoutes
router.use('/payments', paymentRoutes);
router.use('/uploads', uploadRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Showaya POS API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      tables: '/api/tables',
      orders: '/api/orders',
      products: '/api/products',
      categories: '/api/categories',
      payments: '/api/payments'
    }
  });
});

module.exports = router;
