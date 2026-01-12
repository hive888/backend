const winston = require('winston');
const { format } = winston;
const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
  if (metadata && Object.keys(metadata).length) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: combine(
        timestamp(),
        logFormat
      )
    })
  ]
});

// Add security log method
logger.security = function(message, meta) {
  this.info(`[SECURITY] ${message}`, meta);
};

// Add audit log method
logger.audit = function(message, meta) {
  this.info(`[AUDIT] ${message}`, meta);
};

module.exports = logger;