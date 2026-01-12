#!/usr/bin/env node
/**
 * Database Connection Test Script
 * Run this script to verify your database connection is working
 * Usage: node scripts/test-db-connection.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('🔌 Testing database connection...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 1,
    charset: 'utf8mb4'
  };

  console.log('Configuration:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Database: ${config.database}`);
  console.log('');

  if (!config.user || !config.password || !config.database) {
    console.error('❌ Error: Missing required environment variables!');
    console.error('Please set DB_USER, DB_PASSWORD, and DB_NAME in your .env file');
    process.exit(1);
  }

  try {
    // Test connection
    const connection = await mysql.createConnection(config);
    console.log('✅ Connection established successfully!');

    // Test query
    const [rows] = await connection.query('SELECT VERSION() as version, DATABASE() as database');
    console.log(`✅ MySQL Version: ${rows[0].version}`);
    console.log(`✅ Connected to database: ${rows[0].database}`);

    // List tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n📊 Found ${tables.length} tables in database`);
    
    if (tables.length > 0) {
      console.log('Tables:');
      const tableKey = Object.keys(tables[0])[0];
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table[tableKey]}`);
      });
    } else {
      console.log('⚠️  Warning: No tables found. You may need to create the database schema.');
    }

    await connection.end();
    console.log('\n✅ Database connection test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Database connection failed!');
    console.error(`Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Possible issues:');
      console.error('  - MySQL server is not running');
      console.error('  - Wrong host or port');
      console.error('  - Firewall blocking connection');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Possible issues:');
      console.error('  - Incorrect username or password');
      console.error('  - User does not have permission to access the database');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Possible issues:');
      console.error('  - Database does not exist');
      console.error('  - Create the database first: CREATE DATABASE ptgr_db;');
    }
    
    process.exit(1);
  }
}

testConnection();

