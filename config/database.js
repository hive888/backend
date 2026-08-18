const { Pool, types } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { translateMysql, tableMeta } = require('./mysqlToPostgres');
// PostgreSQL + Prisma — MySQL is no longer used.
const logger = require('../utils/logger');

require('./loadEnv');

// Keep numeric results close to mysql2 (decimalNumbers: true).
types.setTypeParser(20, (val) => (val == null ? null : parseInt(val, 10))); // int8
types.setTypeParser(21, (val) => (val == null ? null : parseInt(val, 10))); // int2
types.setTypeParser(23, (val) => (val == null ? null : parseInt(val, 10))); // int4
types.setTypeParser(1700, (val) => (val == null ? null : parseFloat(val))); // numeric

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = encodeURIComponent(process.env.DB_USER || 'hive888_user');
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const db = process.env.DB_NAME || 'hive888_db';
  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
}

const connectionString = buildDatabaseUrl();

const prisma = new PrismaClient({
  datasources: { db: { url: connectionString } },
});

const pool = new Pool({
  connectionString,
  max: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
});

function wrapPgError(err) {
  if (!err) return err;
  if (err.code === '23505') {
    err.code = 'ER_DUP_ENTRY';
    err.sqlMessage = err.detail || err.message;
  }
  return err;
}

function coerceParams(values) {
  return (values || []).map((value) => {
    if (value === undefined) return null;
    if (Buffer.isBuffer(value)) return value;
    if (value && typeof value === 'object' && !(value instanceof Date)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return JSON.parse(trimmed);
        } catch (_) {
          return value;
        }
      }
    }
    return value;
  });
}

function toMysqlResult(kind, pgResult, sql) {
  if (kind === 'select') {
    return [pgResult.rows, pgResult.fields];
  }

  const table = sql && sql.match(/INSERT\s+INTO\s+"?([a-zA-Z0-9_]+)"?/i);
  const pk = table ? tableMeta[table[1]]?.pk : null;
  const row = pgResult.rows[0] || {};
  const insertId = pk ? row[pk] : undefined;

  return [
    {
      insertId,
      affectedRows: pgResult.rowCount || 0,
      changedRows: pgResult.rowCount || 0,
    },
    pgResult.fields,
  ];
}

async function runOnClient(client, sql, params) {
  try {
    const translated = translateMysql(sql, params);
    const values = coerceParams(translated.values);
    const pgResult = values.length
      ? await client.query(translated.text, values)
      : await client.query(translated.text);
    return toMysqlResult(translated.kind, pgResult, translated.text);
  } catch (err) {
    throw wrapPgError(err);
  }
}

function wrapConnection(client) {
  return {
    query: (sql, params) => runOnClient(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

async function query(sql, params) {
  return runOnClient(pool, sql, params);
}

async function getConnection() {
  const client = await pool.connect();
  return wrapConnection(client);
}

async function close() {
  await Promise.allSettled([pool.end(), prisma.$disconnect()]);
  logger.info('Database connections closed');
}

prisma
  .$connect()
  .then(async () => {
    logger.info('PostgreSQL / Prisma connection established');
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE courses ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NOT NULL DEFAULT 0.00'
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD'`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE subsections ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(1000)`
      );
    } catch (err) {
      logger.error('Database migration failed for courses columns:', err.message);
    }
  })
  .catch((err) => {
    logger.error('Database connection failed:', err.message, {
      code: err.code,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
    });
    process.exit(1);
  });

module.exports = {
  query,
  getConnection,
  close,
  prisma,
};
