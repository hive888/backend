#!/usr/bin/env node
try {
  require('../config/loadEnv');
} catch (_) {
  try {
    require('dotenv').config();
  } catch {
    // Allow running on a host without local node_modules installed.
  }
}

const { Client } = require('pg');

const SOURCE_DATABASE_URL =
  process.env.SOURCE_DATABASE_URL ||
  'postgresql://hive888_user:NewStrongPassword123%21@localhost:5432/hive888_db';

const TARGET_DATABASE_URL =
  process.env.TARGET_DATABASE_URL ||
  'postgresql://hive888_user:NewStrongPassword123%21@localhost:55433/hive888_db';

async function main() {
  const source = new Client({ connectionString: SOURCE_DATABASE_URL });
  const target = new Client({ connectionString: TARGET_DATABASE_URL });

  await source.connect();
  await target.connect();

  try {
    const { rows } = await source.query(
      `
      SELECT id, title, pdf_url
      FROM subsections
      WHERE pdf_url IS NOT NULL
        AND BTRIM(pdf_url) <> ''
      ORDER BY id
      `
    );

    if (!rows.length) {
      console.log('No subsection pdf_url rows found in source database.');
      return;
    }

    console.log(`Found ${rows.length} subsection PDF rows in source DB.`);

    await target.query('BEGIN');

    let updated = 0;
    let missing = 0;
    const missingRows = [];

    for (const row of rows) {
      const result = await target.query(
        `
        UPDATE subsections
        SET pdf_url = $2
        WHERE id = $1
        `,
        [row.id, row.pdf_url]
      );

      if (result.rowCount > 0) {
        updated += result.rowCount;
        console.log(`Updated subsection ${row.id}: ${row.title}`);
      } else {
        missing += 1;
        missingRows.push({ id: row.id, title: row.title, pdf_url: row.pdf_url });
      }
    }

    await target.query('COMMIT');

    console.log('');
    console.log(`Updated ${updated} subsection PDF URLs in target DB.`);

    if (missingRows.length) {
      console.log(`Missing ${missing} subsection IDs in target DB:`);
      for (const row of missingRows) {
        console.log(`- ${row.id}: ${row.title}`);
      }
    }
  } catch (error) {
    await target.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error('Failed to sync subsection PDFs:', error.message);
  process.exit(1);
});
