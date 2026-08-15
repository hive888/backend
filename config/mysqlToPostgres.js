const tableMeta = require('./pgTableMeta.json');

function expandSetClause(sql, params) {
  const values = Array.isArray(params) ? [...params] : params == null ? [] : [params];
  let text = sql;

  const insertSet = text.match(/^\s*INSERT\s+INTO\s+([`"']?[\w.]+[`"']?)\s+SET\s+\?\s*$/i);
  if (insertSet) {
    const data = values.shift() || {};
    const keys = Object.keys(data);
    if (!keys.length) {
      throw new Error('INSERT SET ? requires a non-empty object');
    }
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    text = `INSERT INTO ${insertSet[1]} (${cols}) VALUES (${placeholders})`;
    values.unshift(...keys.map((k) => data[k]));
    return { text, values };
  }

  const updateSet = text.match(/^(\s*UPDATE\s+[`"']?[\w.]+[`"']?\s+SET\s+)\?(\s+WHERE\s+[\s\S]+)$/i);
  if (updateSet) {
    const data = values.shift() || {};
    const keys = Object.keys(data);
    if (!keys.length) {
      throw new Error('UPDATE SET ? requires a non-empty object');
    }
    const assignments = keys.map((k) => `"${k}" = ?`).join(', ');
    text = `${updateSet[1]}${assignments}${updateSet[2]}`;
    values.unshift(...keys.map((k) => data[k]));
  }

  return { text, values };
}

function stripBackticks(sql) {
  return sql.replace(/`([^`]+)`/g, '"$1"');
}

function tableNameFromSql(sql) {
  const insert = sql.match(/INSERT\s+(?:IGNORE\s+)?INTO\s+"?([a-zA-Z0-9_]+)"?/i);
  if (insert) return insert[1];
  const update = sql.match(/UPDATE\s+"?([a-zA-Z0-9_]+)"?/i);
  if (update) return update[1];
  const del = sql.match(/DELETE\s+FROM\s+"?([a-zA-Z0-9_]+)"?/i);
  if (del) return del[1];
  const from = sql.match(/FROM\s+"?([a-zA-Z0-9_]+)"?/i);
  if (from) return from[1];
  return null;
}

function pickConflictTarget(table, sql) {
  const meta = tableMeta[table];
  if (!meta || !meta.uniques || !meta.uniques.length) return null;

  const insertCols = [];
  const colMatch = sql.match(/INSERT\s+INTO\s+"?[a-zA-Z0-9_]+"?\s*\(([^)]+)\)/i);
  if (colMatch) {
    insertCols.push(
      ...colMatch[1]
        .split(',')
        .map((c) => c.replace(/["`]/g, '').trim())
        .filter(Boolean)
    );
  }

  const candidates = meta.uniques.filter((cols) => cols.length && !(cols.length === 1 && cols[0] === meta.pk));
  const pool = candidates.length ? candidates : meta.uniques;
  const match = pool.find((cols) => !insertCols.length || cols.every((c) => insertCols.includes(c)));
  return (match || pool[0] || []).join(', ');
}

function translateOnDuplicate(sql) {
  if (!/ON DUPLICATE KEY UPDATE/i.test(sql)) return sql;

  const table = tableNameFromSql(sql);
  const target = pickConflictTarget(table, sql);
  if (!target) {
    throw new Error(`Cannot translate ON DUPLICATE KEY UPDATE for table ${table}`);
  }

  return sql.replace(/ON DUPLICATE KEY UPDATE/i, `ON CONFLICT (${target}) DO UPDATE SET`);
}

function translateMysqlFunctions(sql) {
  let text = sql;

  text = text.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
  text = text.replace(/\bCURDATE\s*\(\s*\)/gi, 'CURRENT_DATE');
  // MySQL date helpers used by the admin dashboard (must run before YEAR()).
  text = text.replace(
    /\bYEARWEEK\s*\(\s*([^)]+?)\s*\)/gi,
    '(EXTRACT(ISOYEAR FROM $1)::int * 100 + EXTRACT(WEEK FROM $1)::int)'
  );
  text = text.replace(/\bMONTH\s*\(\s*([^)]+?)\s*\)/gi, 'EXTRACT(MONTH FROM $1)');
  text = text.replace(/\bYEAR\s*\(\s*([^)]+?)\s*\)/gi, 'EXTRACT(YEAR FROM $1)');
  text = text.replace(/\bNOT\s+LIKE\b/gi, 'NOT ILIKE');
  text = text.replace(/\bLIKE\b/gi, 'ILIKE');

  text = text.replace(
    /GROUP_CONCAT\s*\(\s*([\s\S]+?)\s+ORDER\s+BY\s+([\s\S]+?)\s+SEPARATOR\s+'([^']+)'\s*\)/gi,
    'STRING_AGG($1, \'$3\' ORDER BY $2)'
  );
  text = text.replace(
    /GROUP_CONCAT\s*\(\s*([\s\S]+?)\s+SEPARATOR\s+'([^']+)'\s*\)/gi,
    'STRING_AGG($1, \'$2\')'
  );

  text = text.replace(
    /FIND_IN_SET\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)\s*>\s*0/gi,
    '($1 = ANY(string_to_array($2, \',\')))'
  );
  text = text.replace(
    /FIND_IN_SET\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/gi,
    '(CASE WHEN $1 = ANY(string_to_array($2, \',\')) THEN 1 ELSE 0 END)'
  );

  text = text.replace(
    /DATE_SUB\s*\(\s*(NOW\s*\(\s*\)|CURRENT_DATE)\s*,\s*INTERVAL\s+(\?|\d+)\s+DAY\s*\)/gi,
    '($1 - (($2)::int * INTERVAL \'1 day\'))'
  );

  text = text.replace(/\bVALUES\s*\(\s*([a-zA-Z_][\w]*)\s*\)/gi, 'EXCLUDED.$1');

  text = text.replace(
    /\bIF\s*\(\s*([\s\S]+?)\s*,\s*([\s\S]+?)\s*,\s*([\s\S]+?)\s*\)/gi,
    'CASE WHEN $1 THEN $2 ELSE $3 END'
  );

  return text;
}

function toPositionalParams(sql, values) {
  let index = 0;
  const text = sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
  return { text, values };
}

function classify(sql) {
  const trimmed = sql.trim();
  if (/^insert\s+/i.test(trimmed)) return 'insert';
  if (/^update\s+/i.test(trimmed)) return 'update';
  if (/^delete\s+/i.test(trimmed)) return 'delete';
  return 'select';
}

function addReturning(sql, kind) {
  if (kind !== 'insert') return sql;
  if (/\bRETURNING\b/i.test(sql)) return sql;
  const table = tableNameFromSql(sql);
  const pk = tableMeta[table]?.pk;
  if (!pk) return `${sql} RETURNING *`;
  return `${sql} RETURNING "${pk}"`;
}

function translateShow(sql) {
  const columns = sql.match(/^\s*SHOW\s+COLUMNS\s+FROM\s+[`"]?(\w+)[`"]?\s*$/i);
  if (columns) {
    return {
      text: `SELECT column_name AS "Field", data_type AS "Type",
                    CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END AS "Null",
                    column_default AS "Default"
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1
             ORDER BY ordinal_position`,
      values: [columns[1]],
      kind: 'select',
    };
  }
  if (/^\s*SHOW\s+TABLES\s*$/i.test(sql)) {
    return {
      text: `SELECT tablename AS "Tables_in_db" FROM pg_catalog.pg_tables WHERE schemaname = 'public'`,
      values: [],
      kind: 'select',
    };
  }
  return null;
}

function translateMysql(sql, params) {
  const show = translateShow(sql);
  if (show) return show;

  const expanded = expandSetClause(sql, params);
  let text = stripBackticks(expanded.text);
  text = translateOnDuplicate(text);
  text = translateMysqlFunctions(text);
  const kind = classify(text);
  text = addReturning(text, kind);
  const positional = toPositionalParams(text, expanded.values);
  return { ...positional, kind, table: tableNameFromSql(positional.text) };
}

module.exports = {
  translateMysql,
  tableMeta,
};
