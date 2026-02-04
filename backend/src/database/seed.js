/**
 * Database Seeder
 * Creates default admin user with PIN: 1234
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { logger } = require('../utils/logger');

async function seed() {
  logger.info('Starting database seeding...');
  
  try {
    // Hash default PINs
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
    
    // Default users with their PINs
    const defaultUsers = [
      { username: 'admin', full_name: 'System Administrator', pin: '1234', role_id: 1 },
      { username: 'manager', full_name: 'Restaurant Manager', pin: '5678', role_id: 2 },
      { username: 'server1', full_name: 'John Server', pin: '1111', role_id: 3 },
      { username: 'server2', full_name: 'Jane Server', pin: '2222', role_id: 3 },
      { username: 'cashier1', full_name: 'Cash Master', pin: '9999', role_id: 4 },
    ];
    
    // Check if users already exist
    const existingUsers = await db.query('SELECT username FROM users');
    const existingUsernames = existingUsers.map(u => u.username);
    
    for (const userData of defaultUsers) {
      if (existingUsernames.includes(userData.username)) {
        logger.info(`User "${userData.username}" already exists, skipping...`);
        continue;
      }
      
      const pinHash = await bcrypt.hash(userData.pin, saltRounds);
      
      await db.query(
        `INSERT INTO users (username, full_name, pin_hash, role_id)
         VALUES (?, ?, ?, ?)`,
        [userData.username, userData.full_name, pinHash, userData.role_id]
      );
      
      logger.info(`Created user: ${userData.username} (PIN: ${userData.pin})`);
    }
    
    logger.info('Database seeding completed successfully!');
    logger.info('');
    logger.info('Default credentials:');
    logger.info('-------------------');
    logger.info('Admin:   username=admin, PIN=1234');
    logger.info('Manager: username=manager, PIN=5678');
    logger.info('Server:  username=server1, PIN=1111');
    logger.info('Server:  username=server2, PIN=2222');
    logger.info('Cashier: username=cashier1, PIN=9999');
    
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

seed();
