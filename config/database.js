const mysql = require('mysql2/promise');
require('dotenv').config();
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  timezone: 'Z',
  charset: 'utf8mb4',
  namedPlaceholders: true,
  decimalNumbers: true
});

pool.getConnection()
  .then(conn => {
    conn.release();
    logger.info('Database connection established');
  })
  .catch(err => {
    logger.error('Database connection failed:', err.message);
    process.exit(1);
  });

  module.exports = {
    query: (sql, params) => pool.query(sql, params), // return [rows, fields]
    getConnection: () => pool.getConnection(),
    close: () => pool.end().then(() => logger.info('Database connections closed'))
  };