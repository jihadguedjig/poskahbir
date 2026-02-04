/**
 * Database Configuration and Connection Pool
 * Uses mysql2 with promise support for async/await
 */

const mysql = require('mysql2/promise');
const { logger } = require('../utils/logger');

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'showaya_pos',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Timezone handling
  timezone: '+00:00',
  // Return dates as strings for consistent handling
  dateStrings: true
});

// Test connection on startup
pool.getConnection()
  .then(connection => {
    logger.info('MySQL pool connected successfully');
    connection.release();
  })
  .catch(err => {
    logger.error('MySQL pool connection failed:', err.message);
  });

/**
 * Execute a query with automatic connection handling
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    logger.error('Database query error:', { sql, error: error.message });
    throw error;
  }
};

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function receiving connection
 * @returns {Promise<any>} Transaction result
 */
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('Transaction failed, rolled back:', error.message);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get a raw connection from the pool
 * Remember to release it after use
 */
const getConnection = () => pool.getConnection();

/**
 * Close all connections in the pool
 */
const end = () => pool.end();

module.exports = {
  pool,
  query,
  transaction,
  getConnection,
  end
};
