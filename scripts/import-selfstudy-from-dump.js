#!/usr/bin/env node
/**
 * Import self-study curriculum (chapters, sections, subsections, quizzes)
 * from hive888_db.sql into PostgreSQL.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DUMP = path.join(__dirname, '..', 'hive888_db.sql');

const TABLES = [
  'chapters',
  'sections',
  'subsections',
  'subsection_quiz_questions',
  'subsection_quiz_options',
];

const COLUMNS = {
  chapters: ['id', 'title', 'sort_order', 'created_at', 'updated_at'],
  sections: [
    'id', 'chapter_id', 'title', 'subtitle', 'sort_order',
    'created_at', 'updated_at', 'quiz_required', 'quiz_pass_score',
  ],
  subsections: [
    'id', 'section_id', 'title', 'content_html', 'sort_order',
    'quiz_required', 'quiz_pass_score', 'created_at', 'updated_at',
  ],
  subsection_quiz_questions: [
    'id', 'subsection_id', 'prompt_html', 'sort_order', 'created_at', 'updated_at',
  ],
  subsection_quiz_options: [
    'id', 'question_id', 'text_html', 'is_correct', 'sort_order', 'created_at', 'updated_at',
  ],
};

const CHAPTER_COURSE_SLUG = {
  11: 'blockchain-ecosystem',
  13: 'blockchain-mechanisms-applications',
  14: 'crypto-ecosystem',
  15: 'decentralized-finance',
  16: 'web3',
};

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

function parseMysqlValues(sql) {
  const marker = 'VALUES';
  const idx = sql.search(/\bVALUES\b/i);
  if (idx < 0) return [];
  let i = idx + marker.length;
  const rows = [];
  const s = sql;

  while (i < s.length) {
    while (i < s.length && (s[i] === ' ' || s[i] === '\n' || s[i] === '\r' || s[i] === '\t' || s[i] === ',')) i += 1;
    if (i >= s.length || s[i] === ';' ) break;
    if (s[i] !== '(') break;
    i += 1;
    const row = [];
    while (i < s.length) {
      while (i < s.length && (s[i] === ' ' || s[i] === '\n' || s[i] === '\r' || s[i] === '\t')) i += 1;
      if (s[i] === ')') {
        i += 1;
        break;
      }
      if (s.slice(i, i + 4).toUpperCase() === 'NULL' && /[\s,)]/.test(s[i + 4] || ')')) {
        row.push(null);
        i += 4;
      } else if (s[i] === "'" || s[i] === '"') {
        const quote = s[i];
        i += 1;
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
            i += 1;
            break;
          }
          out += ch;
          i += 1;
        }
        row.push(unescapeMysql(out));
      } else {
        let start = i;
        while (i < s.length && s[i] !== ',' && s[i] !== ')') i += 1;
        const raw = s.slice(start, i).trim();
        row.push(raw === '' ? null : raw);
      }
      while (i < s.length && (s[i] === ' ' || s[i] === '\n' || s[i] === '\r' || s[i] === '\t')) i += 1;
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
    let end = start;
    let inStr = false;
    let quote = '';
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
    const stmt = dump.slice(start, end);
    rows.push(...parseMysqlValues(stmt));
    from = end;
  }
  return rows;
}

function coerce(value, column) {
  if (value == null) return null;
  if (['id', 'chapter_id', 'section_id', 'subsection_id', 'question_id', 'sort_order', 'quiz_required', 'quiz_pass_score', 'is_correct'].includes(column)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (column.endsWith('_at')) {
    const d = new Date(String(value).replace(' ', 'T') + 'Z');
    return Number.isNaN(d.getTime()) ? value : d;
  }
  return value;
}

async function main() {
  console.log('Reading dump...');
  const dump = fs.readFileSync(DUMP, 'utf8');

  const data = {};
  for (const table of TABLES) {
    data[table] = extractInserts(dump, table);
    console.log(`  ${table}: ${data[table].length} rows`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE
        subsection_quiz_options,
        subsection_quiz_questions,
        subsections,
        sections,
        chapters
      RESTART IDENTITY CASCADE
    `);

    for (const table of TABLES) {
      const cols = COLUMNS[table];
      const rows = data[table];
      for (const row of rows) {
        if (row.length !== cols.length) {
          throw new Error(`${table} expected ${cols.length} cols, got ${row.length} (id=${row[0]})`);
        }
        const values = cols.map((col, i) => coerce(row[i], col));
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
      console.log(`Inserted ${rows.length} into ${table}`);
    }

    for (const [chapterId, slug] of Object.entries(CHAPTER_COURSE_SLUG)) {
      const res = await client.query(
        `UPDATE chapters SET course_id = (SELECT id FROM courses WHERE slug = $1) WHERE id = $2`,
        [slug, Number(chapterId)]
      );
      console.log(`Mapped chapter ${chapterId} -> ${slug} (${res.rowCount} row)`);
    }

    for (const table of ['chapters', 'sections', 'subsections', 'subsection_quiz_questions', 'subsection_quiz_options']) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
        [table]
      );
    }

    await client.query('COMMIT');

    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM chapters) AS chapters,
        (SELECT COUNT(*) FROM sections) AS sections,
        (SELECT COUNT(*) FROM subsections) AS subsections,
        (SELECT COUNT(*) FROM subsection_quiz_questions) AS questions,
        (SELECT COUNT(*) FROM subsection_quiz_options) AS options,
        (SELECT COUNT(*) FROM subsections WHERE content_html ILIKE '%<img%') AS subsections_with_images
    `);
    console.log('Import complete:', stats.rows[0]);

    const imgs = await client.query(`
      SELECT id, title
      FROM subsections
      WHERE content_html ILIKE '%<img%'
      ORDER BY id
    `);
    const htmls = await client.query(`SELECT content_html FROM subsections WHERE content_html ILIKE '%<img%'`);
    const srcs = new Set();
    for (const row of htmls.rows) {
      const re = /<img[^>]+src=["']([^"']+)["']/gi;
      let m;
      while ((m = re.exec(row.content_html))) srcs.add(m[1]);
    }
    console.log(`Subsections with <img>: ${imgs.rowCount}`);
    console.log('Unique image srcs:');
    for (const src of srcs) console.log(' ', src.slice(0, 180));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
