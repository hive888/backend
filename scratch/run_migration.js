// run_migration.js
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../migrations/migrate_education_split.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL by semicolon, filtering out empty queries
    const queries = sql
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0);
      
    console.log(`Found ${queries.length} queries to run.`);
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`Running query ${i + 1}/${queries.length}...`);
      await db.query(query);
    }
    
    console.log('Migration successfully completed!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
