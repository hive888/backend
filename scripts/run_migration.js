// Script to run database migrations
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

async function runMigration(migrationFile) {
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    logger.info(`Running migration: ${migrationFile}`);
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        await db.query(statement);
        logger.info(`Executed: ${statement.substring(0, 50)}...`);
      }
    }
    
    logger.info(`✅ Migration ${migrationFile} completed successfully`);
    process.exit(0);
  } catch (err) {
    logger.error(`❌ Migration ${migrationFile} failed:`, err);
    process.exit(1);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run_migration.js <migration_file.sql>');
  console.error('Example: node scripts/run_migration.js add_achievement_certificate.sql');
  process.exit(1);
}

runMigration(migrationFile);


