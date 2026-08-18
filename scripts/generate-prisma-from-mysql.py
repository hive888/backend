#!/usr/bin/env python3
"""Generate prisma/schema.prisma and config/pgTableMeta.json from hive888_db.sql."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DUMP = ROOT / "hive888_db.sql"
SCHEMA_PATH = ROOT / "prisma" / "schema.prisma"
META_PATH = ROOT / "config" / "pgTableMeta.json"

FIELD_OVERRIDES = {
    ("users", "username"): "varchar(255)",
}

EXTRA_COLUMNS = {
    "users": [("token_version", "int NOT NULL DEFAULT 0")],
    "courses": [
        ("price", "decimal(10,2) NOT NULL DEFAULT 0.00"),
        ("currency", "varchar(10) NOT NULL DEFAULT 'USD'"),
    ],
    "chapters": [("course_id", "bigint DEFAULT NULL")],
    "customer_profile_details": [
        ("position", "varchar(120) DEFAULT NULL"),
        ("organization", "varchar(120) DEFAULT NULL"),
        ("skills", "json DEFAULT NULL"),
        ("experience", "text DEFAULT NULL"),
        ("documents", "json DEFAULT NULL"),
    ],
    "talent_pool_registration": [
        ("certifications", "json DEFAULT NULL"),
        ("projects", "json DEFAULT NULL"),
    ],
}

EXTRA_TABLES = {
    "project_pool": """
CREATE TABLE `project_pool` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creator_id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `deliverables` json NOT NULL,
  `timeline` varchar(100) NOT NULL,
  `team_structure` varchar(255) NOT NULL,
  `budget` varchar(100) NOT NULL,
  `funding_goal` varchar(100) DEFAULT NULL,
  `funding_raised` varchar(100) DEFAULT '0',
  `mentor_needed` tinyint(1) DEFAULT 0,
  `required_skills` json NOT NULL,
  `project_logo_url` varchar(512) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
)
""",
    "project_applications": """
CREATE TABLE `project_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `role_type` varchar(50) NOT NULL,
  `motivation` text NOT NULL,
  `contribution_details` text DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_role_project` (`user_id`,`project_id`,`role_type`)
)
""",
}

HEADER = """generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
"""


def to_model_name(table: str) -> str:
    return "".join(part.title() for part in table.split("_"))


def strip_mysql_noise(sql_type: str) -> str:
    sql_type = re.sub(r"character set \w+", "", sql_type, flags=re.I)
    sql_type = re.sub(r"collate \w+", "", sql_type, flags=re.I)
    sql_type = re.sub(r"unsigned", "", sql_type, flags=re.I)
    sql_type = re.sub(r"zerofill", "", sql_type, flags=re.I)
    return re.sub(r"\s+", " ", sql_type).strip()


def prisma_native(mysql_type: str) -> tuple[str, str]:
    t = strip_mysql_noise(mysql_type).lower()
    if t.startswith("tinyint(1)") or t == "boolean" or t == "bool":
        return "Int", "@db.SmallInt"
    if t.startswith("tinyint") or t.startswith("smallint"):
        return "Int", "@db.SmallInt"
    if t.startswith("bigint"):
        return "Int", ""
    if t.startswith("int") or t.startswith("mediumint") or t.startswith("year"):
        return "Int", ""
    if t.startswith("decimal") or t.startswith("numeric"):
        m = re.search(r"\((\d+),\s*(\d+)\)", t)
        if m:
            return "Decimal", f"@db.Decimal({m.group(1)}, {m.group(2)})"
        return "Decimal", "@db.Decimal"
    if t.startswith("float") or t.startswith("double") or t.startswith("real"):
        return "Float", ""
    if t.startswith("datetime") or t.startswith("timestamp"):
        return "DateTime", "@db.Timestamp(0)"
    if t == "date":
        return "DateTime", "@db.Date"
    if t == "time":
        return "DateTime", "@db.Time(0)"
    if t.startswith("json"):
        return "Json", ""
    if t.startswith("longtext") or t.startswith("mediumtext") or t.startswith("text"):
        return "String", "@db.Text"
    if t.startswith("blob") or t.startswith("longblob") or t.startswith("mediumblob"):
        return "Bytes", ""
    if t.startswith("enum(") or t.startswith("set("):
        return "String", "@db.VarChar(64)"
    m = re.match(r"varchar\((\d+)\)", t)
    if m:
        return "String", f"@db.VarChar({m.group(1)})"
    m = re.match(r"char\((\d+)\)", t)
    if m:
        return "String", f"@db.Char({m.group(1)})"
    return "String", "@db.Text"


def parse_default(rest: str, prisma_type: str) -> str | None:
    rest_u = rest.upper()
    if "DEFAULT (UUID())" in rest_u or "DEFAULT UUID()" in rest_u:
        return '@default(dbgenerated("gen_random_uuid()::text"))'
    m = re.search(r"DEFAULT\s+(.+)$", rest, flags=re.I)
    if not m:
        if "AUTO_INCREMENT" in rest_u:
            return "@default(autoincrement())"
        return None
    raw = m.group(1).strip().rstrip(",")
    raw = re.sub(r"\s+ON UPDATE CURRENT_TIMESTAMP", "", raw, flags=re.I).strip()
    raw = re.sub(r"\s+COMMENT\s+'.*'$", "", raw, flags=re.I).strip()
    raw = re.sub(r'\s+COMMENT\s+".*"$', "", raw, flags=re.I).strip()
    if raw.upper() in ("NULL",):
        return None
    if raw.upper() in ("CURRENT_TIMESTAMP", "CURRENT_TIMESTAMP()", "NOW()", "NOW()"):
        return "@default(now())"
    if raw.upper() in ("CURRENT_DATE", "CURDATE()", "CURRENT_DATE()"):
        return "@default(dbgenerated(\"CURRENT_DATE\"))"
    if raw.startswith("(") and raw.endswith(")"):
        inner = raw[1:-1].strip()
        if inner.lower() in ("uuid()", "uuid"):
            return '@default(dbgenerated("gen_random_uuid()::text"))'
        return f'@default(dbgenerated("{inner}"))'
    if prisma_type == "Int":
        num = raw.strip("'\"")
        try:
            return f"@default({int(float(num))})"
        except ValueError:
            return None
    if prisma_type == "Float":
        return f"@default({raw.strip(chr(39))})"
    if prisma_type == "Decimal":
        return f'@default({raw.strip(chr(39))})'
    if prisma_type == "String":
        val = raw.strip("'\"")
        val = val.replace("\\", "\\\\").replace('"', '\\"')
        return f'@default("{val}")'
    if prisma_type == "Json":
        return None
    return None


def parse_create_table(sql: str) -> dict:
    m = re.search(r"CREATE TABLE `([^`]+)`\s*\((.*)\)\s*(?:ENGINE|;|$)", sql, flags=re.S | re.I)
    if not m:
        raise ValueError("Could not parse CREATE TABLE")
    table = m.group(1)
    body = m.group(2)
    columns = []
    pk = []
    uniques = []
    indexes = []

    # Split on commas that are not inside parentheses or quotes.
    parts = []
    buf = []
    depth = 0
    in_s = False
    in_d = False
    prev = ""
    for ch in body:
        if ch == "'" and not in_d and prev != "\\":
            in_s = not in_s
        elif ch == '"' and not in_s and prev != "\\":
            in_d = not in_d
        elif ch == "(" and not in_s and not in_d:
            depth += 1
        elif ch == ")" and not in_s and not in_d:
            depth -= 1
        if ch == "," and depth == 0 and not in_s and not in_d:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
        prev = ch
    if buf:
        parts.append("".join(buf).strip())

    for part in parts:
        if not part:
            continue
        if part.upper().startswith("PRIMARY KEY"):
            pk = re.findall(r"`([^`]+)`", part)
            continue
        if part.upper().startswith("UNIQUE KEY") or part.upper().startswith("UNIQUE INDEX"):
            cols = re.findall(r"`([^`]+)`", part)
            if cols:
                uniq_cols = cols[1:] or cols
                if uniq_cols not in uniques:
                    uniques.append(uniq_cols)
            continue
        if part.upper().startswith("KEY ") or part.upper().startswith("INDEX "):
            cols = re.findall(r"`([^`]+)`", part)
            if len(cols) > 1:
                indexes.append(cols[1:])
            continue
        if part.upper().startswith("CONSTRAINT") or part.upper().startswith("FOREIGN KEY"):
            continue
        col_m = re.match(r"`([^`]+)`\s+(.+)$", part)
        if not col_m:
            continue
        name, rest = col_m.group(1), col_m.group(2).strip()
        type_m = re.match(r"(\S+(?:\([^)]*\))?)", rest)
        mysql_type = type_m.group(1) if type_m else "text"
        rest_after = rest[len(mysql_type) :].strip()
        mysql_type = FIELD_OVERRIDES.get((table, name), mysql_type)
        columns.append(
            {
                "name": name,
                "mysql_type": mysql_type,
                "rest": rest_after,
                "not_null": bool(re.search(r"\bNOT NULL\b", rest_after, flags=re.I)),
                "auto": "AUTO_INCREMENT" in rest_after.upper(),
                "on_update": "ON UPDATE CURRENT_TIMESTAMP" in rest_after.upper(),
            }
        )

    existing = {c["name"] for c in columns}
    for extra_name, extra_def in EXTRA_COLUMNS.get(table, []):
        if extra_name in existing:
            continue
        type_m = re.match(r"(\S+(?:\([^)]*\))?)", extra_def.strip())
        mysql_type = type_m.group(1) if type_m else "text"
        rest_after = extra_def.strip()[len(mysql_type) :].strip()
        columns.append(
            {
                "name": extra_name,
                "mysql_type": mysql_type,
                "rest": rest_after,
                "not_null": bool(re.search(r"\bNOT NULL\b", rest_after, flags=re.I)),
                "auto": "AUTO_INCREMENT" in rest_after.upper(),
                "on_update": "ON UPDATE CURRENT_TIMESTAMP" in rest_after.upper(),
            }
        )

    return {
        "table": table,
        "columns": columns,
        "pk": pk,
        "uniques": uniques,
        "indexes": indexes,
    }


def render_model(parsed: dict) -> str:
    table = parsed["table"]
    model = to_model_name(table)
    lines = [f"model {model} {{"]
    pk = set(parsed["pk"])
    single_uniques = {u[0] for u in parsed["uniques"] if len(u) == 1}

    for col in parsed["columns"]:
        ptype, native = prisma_native(col["mysql_type"])
        attrs = []
        optional = "" if (col["not_null"] or col["name"] in pk or col["auto"]) else "?"
        if col["name"] in pk:
            attrs.append("@id")
        if col["name"] in single_uniques and col["name"] not in pk:
            attrs.append("@unique")
        default = parse_default(col["rest"], ptype)
        if col["auto"] and not default:
            default = "@default(autoincrement())"
        if default:
            attrs.append(default)
        if col["on_update"] and ptype == "DateTime" and "@updatedAt" not in attrs:
            # Keep a DB default; Prisma @updatedAt only applies to Prisma writes.
            if "@default(now())" not in attrs:
                attrs.append("@default(now())")
        if native:
            attrs.append(native)
        attr_s = (" " + " ".join(attrs)) if attrs else ""
        lines.append(f"  {col['name']} {ptype}{optional}{attr_s}")

    for uniq in parsed["uniques"]:
        if len(uniq) > 1:
            cols = ", ".join(uniq)
            lines.append(f"  @@unique([{cols}])")
    seen_idx = set()
    for idx in parsed["indexes"]:
        key = tuple(idx)
        if key in seen_idx:
            continue
        seen_idx.add(key)
        cols = ", ".join(idx)
        lines.append(f"  @@index([{cols}])")
    lines.append(f'  @@map("{table}")')
    lines.append("}")
    return "\n".join(lines)


def extract_create_tables(dump: str) -> list[str]:
    return re.findall(r"CREATE TABLE `[^`]+`\s*\(.*?\).*?;", dump, flags=re.S)


def main() -> None:
    dump = DUMP.read_text(errors="ignore")
    creates = extract_create_tables(dump)
    parsed_tables = []
    seen = set()
    for create in creates:
        parsed = parse_create_table(create)
        if parsed["table"] in seen:
            continue
        seen.add(parsed["table"])
        parsed_tables.append(parsed)

    for extra_sql in EXTRA_TABLES.values():
        parsed = parse_create_table(extra_sql)
        if parsed["table"] not in seen:
            parsed_tables.append(parsed)
            seen.add(parsed["table"])

    models = [render_model(p) for p in parsed_tables]
    SCHEMA_PATH.parent.mkdir(exist_ok=True)
    SCHEMA_PATH.write_text(HEADER + "\n" + "\n\n".join(models) + "\n")

    meta = {}
    for p in parsed_tables:
        pk = p["pk"][0] if p["pk"] else None
        uniques = p["uniques"][:]
        if pk and [pk] not in uniques:
            uniques = [[pk]] + uniques
        meta[p["table"]] = {"pk": pk, "uniques": uniques}
    META_PATH.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Wrote {SCHEMA_PATH} ({len(parsed_tables)} models)")
    print(f"Wrote {META_PATH}")


if __name__ == "__main__":
    main()
