#!/usr/bin/env node
/**
 * Database Connection Test Script
 * Usage: node scripts/test-db-connection.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = encodeURIComponent(process.env.DB_USER || '');
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const db = process.env.DB_NAME || 'hive888_db';
  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
}

async function testConnection() {
  console.log('Testing PostgreSQL / Prisma connection...\n');

  const url = databaseUrl();
  if (!process.env.DATABASE_URL && (!process.env.DB_USER || !process.env.DB_NAME)) {
    console.error('Missing DATABASE_URL or DB_USER/DB_NAME in .env');
    process.exit(1);
  }

  console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`  Port: ${process.env.DB_PORT || 5432}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log('');

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$connect();
    console.log('Connection established successfully!');

    const rows = await prisma.$queryRawUnsafe('SELECT version() AS version, current_database() AS database');
    console.log(`PostgreSQL: ${rows[0].version.split(',')[0]}`);
    console.log(`Connected to database: ${rows[0].database}`);

    const tables = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    console.log(`\nFound ${tables.length} tables`);
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.tablename}`);
    });

    await prisma.$disconnect();
    console.log('\nDatabase connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\nDatabase connection failed!');
    console.error(`Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nPostgreSQL is not running, or host/port is wrong.');
      console.error('Create the database with: sudo bash scripts/setup-postgres.sh');
    } else if (String(error.message).includes('password authentication failed')) {
      console.error('\nWrong username/password. Run: sudo bash scripts/setup-postgres.sh');
    } else if (String(error.message).includes('does not exist')) {
      console.error('\nDatabase or role is missing. Run: sudo bash scripts/setup-postgres.sh');
    }
    try { await prisma.$disconnect(); } catch (_) {}
    process.exit(1);
  }
}

testConnection();
