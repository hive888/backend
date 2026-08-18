#!/usr/bin/env node
/**
 * Import every table from the MySQL dump (hive888_db.sql) into PostgreSQL.
 * Then restore the 5 self-study module courses used by the current Education UI.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DUMP_PATH = path.join(__dirname, '..', 'hive888_db.sql');
const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const SKIP_TABLES = new Set(['project_pool', 'project_applications']);

const MODULE_COURSES = [
  {
    slug: 'blockchain-ecosystem',
    title: 'Blockchain Ecosystem',
    short_description: 'A deep dive into the history, structure, and fundamentals of the blockchain ecosystem.',
    detailed_description: 'This course covers the essentials of blockchain technology, major networks, and how the global ecosystem operates.',
    thumbnail_url: '/images/blockchain-ecosystem.png',
  },
  {
    slug: 'blockchain-mechanisms-applications',
    title: 'Blockchain Mechanisms & Applications',
    short_description: 'Understand how consensus mechanisms work and where blockchain is applied.',
    detailed_description: 'Learn about Proof of Work, Proof of Stake, consensus protocols, and real-world industrial and corporate use cases.',
    thumbnail_url: '/images/blockchain-mechanisms.png',
  },
  {
    slug: 'crypto-ecosystem',
    title: 'Crypto Ecosystem',
    short_description: 'Explore cryptocurrencies, tokens, wallets, and asset types.',
    detailed_description: 'An introduction to crypto assets, tokenomics, cryptography, secure transactions, wallet configurations, and key networks.',
    thumbnail_url: '/images/crypto-ecosystem.png',
  },
  {
    slug: 'decentralized-finance',
    title: 'Decentralized Finance (DeFi)',
    short_description: 'Introduction to smart contracts, lending protocols, AMMs, and yield generation.',
    detailed_description: 'Learn how DeFi replaces traditional financial systems using automated smart contracts, liquidity pools, and staking.',
    thumbnail_url: '/images/decentralized-finance.png',
  },
  {
    slug: 'web3',
    title: 'Web 3.0',
    short_description: 'The evolution of the internet towards ownership, DAOs, and NFTs.',
    detailed_description: 'Discover the new internet layer: user ownership, decentralized autonomous organizations, digital identity, and NFTs.',
    thumbnail_url: '/images/web3.png',
  },
];

const CHAPTER_COURSE_SLUG = {
  11: 'blockchain-ecosystem',
  13: 'blockchain-mechanisms-applications',
  14: 'crypto-ecosystem',
  15: 'decentralized-finance',
  16: 'web3',
};

function parsePrismaTables(schemaText) {
  const tables = {};
  const modelRe = /model\s+\w+\s*\{([\s\S]*?)@@map\("([^"]+)"\)/g;
  let m;
  while ((m = modelRe.exec(schemaText))) {
    const body = m[1];
    const table = m[2];
    const fields = {};
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
      const fm = trimmed.match(/^(\w+)\s+(\S+)/);
      if (!fm) continue;
      const name = fm[1];
      const type = fm[2].replace('?', '');
      const varchar = trimmed.match(/@db\.VarChar\((\d+)\)/);
      const char = trimmed.match(/@db\.Char\((\d+)\)/);
      fields[name] = {
        type,
        maxLen: varchar ? Number(varchar[1]) : char ? Number(char[1]) : null,
      };
    }
    tables[table] = fields;
  }
  return tables;
}

function parseCreateColumns(dump, table) {
  const start = dump.indexOf(`CREATE TABLE \`${table}\``);
  if (start < 0) return null;
  const open = dump.indexOf('(', start);
  if (open < 0) return null;
  let depth = 0;
  let end = open;
  for (let i = open; i < dump.length; i += 1) {
    if (dump[i] === '(') depth += 1;
    else if (dump[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = dump.slice(open + 1, end);
  const cols = [];
  for (const line of body.split('\n')) {
    const cm = line.match(/^\s*`([^`]+)`\s+/);
    if (!cm) continue;
    cols.push(cm[1]);
  }
  return cols;
}

function unescapeMysql(str) {
  return str.replace(/\\(.)/g, (_, ch) => {
    switch (ch) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case '0': return '\0';
      case 'b': return '\b';
      case 'Z': return '\x1a';
      default: return ch;
    }
  });
}

function parseQuoted(s, start) {
  const quote = s[start];
  let i = start + 1;
  let out = '';
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      out += ch + (s[i + 1] || '');
      i += 2;
      continue;
    }
    if (ch === quote) {
      if (s[i + 1] === quote) {
        out += quote;
        i += 2;
        continue;
      }
      return { value: unescapeMysql(out), next: i + 1 };
    }
    out += ch;
    i += 1;
  }
  return { value: unescapeMysql(out), next: i };
}

function parseMysqlValues(sql) {
  const idx = sql.search(/\bVALUES\b/i);
  if (idx < 0) return [];
  let i = idx + 6;
  const rows = [];
  const s = sql;

  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i += 1;
    if (i >= s.length || s[i] === ';') break;
    if (s[i] !== '(') break;
    i += 1;
    const row = [];
    while (i < s.length) {
      while (i < s.length && /[ \t\n\r]/.test(s[i])) i += 1;
      if (s[i] === ')') {
        i += 1;
        break;
      }

      if (s.slice(i, i + 8).toUpperCase() === '_BINARY') {
        i += 8;
        while (i < s.length && /[ \t]/.test(s[i])) i += 1;
      }

      if (s[i] === 'X' && s[i + 1] === "'") {
        i += 2;
        let hex = '';
        while (i < s.length && s[i] !== "'") {
          hex += s[i];
          i += 1;
        }
        if (s[i] === "'") i += 1;
        row.push(Buffer.from(hex, 'hex'));
      } else if (s.slice(i, i + 2) === '0x') {
        i += 2;
        let hex = '';
        while (i < s.length && /[0-9a-fA-F]/.test(s[i])) {
          hex += s[i];
          i += 1;
        }
        row.push(Buffer.from(hex, 'hex'));
      } else if (s.slice(i, i + 4).toUpperCase() === 'NULL' && /[\s,)]/.test(s[i + 4] || ')')) {
        row.push(null);
        i += 4;
      } else if (s[i] === "'" || s[i] === '"') {
        const parsed = parseQuoted(s, i);
        row.push(parsed.value);
        i = parsed.next;
      } else {
        let start = i;
        while (i < s.length && s[i] !== ',' && s[i] !== ')') i += 1;
        const raw = s.slice(start, i).trim();
        row.push(raw === '' ? null : raw);
      }

      while (i < s.length && /[ \t\n\r]/.test(s[i])) i += 1;
      if (s[i] === ',') i += 1;
    }
    rows.push(row);
  }
  return rows;
}

function extractInserts(dump, table) {
  const rows = [];
  const needle = `INSERT INTO \`${table}\``;
  let from = 0;
  while (true) {
    const start = dump.indexOf(needle, from);
    if (start < 0) break;
    let inStr = false;
    let quote = '';
    let end = start;
    for (let i = start; i < dump.length; i += 1) {
      const ch = dump[i];
      if (inStr) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === quote) {
          if (dump[i + 1] === quote) {
            i += 1;
            continue;
          }
          inStr = false;
        }
        continue;
      }
      if (ch === "'" || ch === '"') {
        inStr = true;
        quote = ch;
        continue;
      }
      if (ch === ';') {
        end = i + 1;
        break;
      }
    }
    rows.push(...parseMysqlValues(dump.slice(start, end)));
    from = end;
  }
  return rows;
}

function coerce(value, field) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) {
    if (field.type === 'String') return value.toString('latin1');
    return value;
  }

  if (typeof value === 'string') {
    if (value === '0000-00-00' || value.startsWith('0000-00-00')) return null;
  }

  if (['Int', 'BigInt'].includes(field.type)) {
    if (value === '' || value === 'NULL') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  if (field.type === 'Decimal' || field.type === 'Float') {
    if (value === '' || value === 'NULL') return null;
    return String(value);
  }

  if (field.type === 'DateTime') {
    const d = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  if (field.type === 'Json') {
    if (value === '' || value === 'NULL') return field.type.endsWith('?') ? null : '[]';
    let parsed = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        try {
          parsed = JSON.parse(unescapeMysql(value));
        } catch {
          parsed = [];
        }
      }
    }
    // JS arrays are encoded as Postgres arrays by node-pg; send JSON text instead.
    return JSON.stringify(parsed);
  }

  let str = String(value);
  if (field.maxLen && str.length > field.maxLen) {
    str = str.slice(0, field.maxLen);
  }
  return str;
}

const MODULE_SLUGS = MODULE_COURSES.map((c) => c.slug);

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  if (!fs.existsSync(DUMP_PATH)) throw new Error(`Dump not found: ${DUMP_PATH}`);

  console.log('Reading dump and Prisma schema...');
  const dump = fs.readFileSync(DUMP_PATH, 'utf8');
  const prismaTables = parsePrismaTables(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  const dumpTables = [];
  const createRe = /CREATE TABLE `([^`]+)`/g;
  let cm;
  while ((cm = createRe.exec(dump))) dumpTables.push(cm[1]);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const stats = {};
  try {
    const parentFirst = [
      'roles',
      'universities',
      'courses',
      'customers',
      'users',
      'products',
      'product_bundles',
      'contests',
      'chapters',
      'sections',
      'subsections',
      'subsection_quiz_questions',
      'subsection_quiz_options',
      'access_codes',
      'interests',
      'skills',
      'languages',
      'talent_profiles',
      'projects',
      'events',
    ];
    const toImport = [
      ...parentFirst.filter((t) => dumpTables.includes(t) && prismaTables[t]),
      ...dumpTables.filter((t) => prismaTables[t] && !SKIP_TABLES.has(t) && !parentFirst.includes(t)),
    ];
    const truncateList = toImport.map((t) => `"${t}"`).join(', ');
    console.log(`Truncating ${toImport.length} tables...`);
    await client.query(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`);

    for (const table of toImport) {
      const dumpCols = parseCreateColumns(dump, table);
      const prismaFields = prismaTables[table];
      if (!dumpCols || !dumpCols.length) {
        console.warn(`  skip ${table}: no CREATE columns parsed`);
        continue;
      }

      const shared = dumpCols.filter((c) => prismaFields[c]);
      const rows = extractInserts(dump, table);
      stats[table] = rows.length;
      if (!rows.length) {
        console.log(`  ${table}: 0 rows`);
        continue;
      }

      let inserted = 0;
      let errors = 0;
      for (const row of rows) {
        const values = [];
        const cols = [];
        for (let i = 0; i < dumpCols.length; i += 1) {
          const col = dumpCols[i];
          if (!prismaFields[col]) continue;
          cols.push(col);
          values.push(coerce(row[i], prismaFields[col]));
        }
        if (!cols.length) continue;
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const quoted = cols.map((c) => `"${c}"`).join(', ');
        try {
          await client.query(
            `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`,
            values
          );
          inserted += 1;
        } catch (err) {
          errors += 1;
          if (errors <= 3) {
            console.warn(`  ${table} row id=${row[0]} failed: ${err.message}`);
          }
        }
      }
      console.log(`  ${table}: inserted ${inserted}/${rows.length}` + (errors ? ` (${errors} failed)` : ''));
    }

    console.log('Resetting serial sequences...');
    const serials = await client.query(`
      SELECT
        pg_get_serial_sequence(format('%I', table_name), column_name) AS seq,
        table_name,
        column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_default LIKE 'nextval%'
    `);
    for (const row of serials.rows) {
      if (!row.seq) continue;
      await client.query(
        `SELECT setval($1::regclass, COALESCE((SELECT MAX("${row.column_name}") FROM "${row.table_name}"), 1), true)`,
        [row.seq]
      ).catch(() => {});
    }

    console.log('Ensuring 5 module courses exist (self-study parent stays active)...');
    for (const course of MODULE_COURSES) {
      await client.query(
        `INSERT INTO courses (slug, title, short_description, detailed_description, thumbnail_url, is_active)
         VALUES ($1, $2, $3, $4, $5, 1)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           short_description = EXCLUDED.short_description,
           detailed_description = EXCLUDED.detailed_description,
           thumbnail_url = EXCLUDED.thumbnail_url,
           is_active = 1`,
        [course.slug, course.title, course.short_description, course.detailed_description, course.thumbnail_url]
      );
    }

    await client.query(`UPDATE courses SET is_active = 1 WHERE slug = 'self-study'`);
    await client.query(`UPDATE courses SET is_active = 0 WHERE slug = 'tet'`);

    for (const [chapterId, slug] of Object.entries(CHAPTER_COURSE_SLUG)) {
      const res = await client.query(
        `UPDATE chapters SET course_id = (SELECT id FROM courses WHERE slug = $1) WHERE id = $2`,
        [slug, Number(chapterId)]
      );
      console.log(`  mapped chapter ${chapterId} -> ${slug} (${res.rowCount} row)`);
    }

    const accessCopy = await client.query(
      `INSERT INTO customer_course_access (customer_id, course_id, status, granted_via, access_code_id, expires_at)
       SELECT cca.customer_id, c.id, cca.status, cca.granted_via, cca.access_code_id, cca.expires_at
       FROM customer_course_access cca
       JOIN courses parent ON parent.id = cca.course_id AND parent.slug = 'self-study'
       CROSS JOIN courses c
       WHERE c.slug = ANY($1::text[])
       ON CONFLICT (customer_id, course_id) DO NOTHING`,
      [MODULE_SLUGS]
    );
    console.log(`Copied self-study access onto modules: ${accessCopy.rowCount} rows`);

    const pkFixes = [
      ['customers', 'customer_id'],
      ['events', 'event_id'],
      ['users', null],
    ];
    for (const [table, pk] of pkFixes) {
      if (!pk) continue;
      await client.query(`
        SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${pk}) FROM ${table}), 1), true)
      `, [table, pk]).catch(() => {});
    }

    console.log('Dump load finished (autocommit).');

    const check = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM courses) AS courses,
        (SELECT COUNT(*) FROM courses WHERE slug = 'self-study' AND is_active = 1) AS self_study_active,
        (SELECT COUNT(*) FROM customers) AS customers,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM chapters) AS chapters,
        (SELECT COUNT(*) FROM sections) AS sections,
        (SELECT COUNT(*) FROM subsections) AS subsections,
        (SELECT COUNT(*) FROM customer_course_access) AS access_rows,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM access_codes) AS access_codes
    `);
    console.log('Import complete:', check.rows[0]);
    const courseRows = await client.query('SELECT id, slug, is_active FROM courses ORDER BY id');
    console.log('Courses:', courseRows.rows);
  } catch (err) {
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
