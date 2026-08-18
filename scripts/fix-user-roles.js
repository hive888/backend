#!/usr/bin/env node
/**
 * Align local users to two roles: administrator vs customer (users).
 * Usage: node scripts/fix-user-roles.js
 */
require('dotenv').config();
const db = require('../config/database');
const { ROLE_IDS, parseAdminEmails } = require('../config/roles');

async function main() {
  const adminEmails = parseAdminEmails();
  console.log('Administrator emails:', adminEmails.join(', ') || '(none)');

  await db.query(
    `UPDATE roles SET role_name = 'administrator' WHERE role_id = ?`,
    [ROLE_IDS.administrator]
  );
  await db.query(
    `UPDATE roles SET role_name = 'customer' WHERE role_id = ?`,
    [ROLE_IDS.customer]
  );
  await db.query(
    `ALTER TABLE users ALTER COLUMN role_id SET DEFAULT '${ROLE_IDS.customer}'`
  );

  const [allBefore] = await db.query(`
    SELECT r.role_name, COUNT(u.user_id)::int AS user_count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.role_id
    GROUP BY r.role_name
    ORDER BY r.role_name
  `);
  console.log('\nRoles before:');
  allBefore.forEach((row) => console.log(`  ${row.role_name}: ${row.user_count}`));

  if (adminEmails.length) {
    const placeholders = adminEmails.map(() => '?').join(', ');
    await db.query(
      `UPDATE users
       SET role_id = ?, token_version = COALESCE(token_version, 0) + 1
       WHERE LOWER(username) IN (${placeholders})`,
      [ROLE_IDS.administrator, ...adminEmails]
    );
    await db.query(
      `UPDATE users
       SET role_id = ?, token_version = COALESCE(token_version, 0) + 1
       WHERE LOWER(username) NOT IN (${placeholders})`,
      [ROLE_IDS.customer, ...adminEmails]
    );
  } else {
    await db.query(
      `UPDATE users
       SET role_id = ?, token_version = COALESCE(token_version, 0) + 1`,
      [ROLE_IDS.customer]
    );
  }

  const [admins] = await db.query(
    `SELECT username, role_id FROM users WHERE role_id = ? ORDER BY username`,
    [ROLE_IDS.administrator]
  );
  const [counts] = await db.query(`
    SELECT r.role_name, COUNT(u.user_id)::int AS user_count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.role_id
    GROUP BY r.role_name
    ORDER BY r.role_name
  `);

  console.log('\nAdministrators after:');
  if (!admins.length) {
    console.log('  (none — log in will be blocked until you add an administrator email)');
  } else {
    admins.forEach((row) => console.log(`  ${row.username}`));
  }
  console.log('\nRoles after:');
  counts.forEach((row) => console.log(`  ${row.role_name}: ${row.user_count}`));

  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to fix user roles:', err);
  process.exit(1);
});
