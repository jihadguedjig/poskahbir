/**
 * Winston Logger Configuration
 * Provides structured logging for the application
 */

const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  return log;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  defaultMeta: { service: 'showaya-pos' },
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    })
  ]
});

// Add file transports: error.log always (dev + prod), combined.log in production only
const logsDir = process.env.LOGS_DIR || path.join(__dirname, '../../logs');
try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch (e) {
  // ignore if dir exists or cannot create
}

logger.add(new winston.transports.File({
  filename: path.join(logsDir, 'error.log'),
  level: 'error',
  maxsize: 5242880, // 5MB
  maxFiles: 5
}));

if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

module.exports = { logger };
