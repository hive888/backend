#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_USER="${DB_USER:-hive888_user}"
DB_PASSWORD="${DB_PASSWORD:-NewStrongPassword123!}"
DB_NAME="${DB_NAME:-hive888_db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

if ! command -v psql >/dev/null 2>&1; then
  echo "Installing postgresql-client..."
  apt-get update -y
  apt-get install -y postgresql-client
fi

create_db_as() {
  local admin_user="$1"
  shift
  PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$admin_user" -d postgres "$@"
}

echo "Creating PostgreSQL role and database..."

created=0
if PGPASSWORD="${POSTGRES_SUPERUSER_PASSWORD:-password}" psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
  export PGPASSWORD="${POSTGRES_SUPERUSER_PASSWORD:-password}"
  psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
  psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
  created=1
elif sudo -n -u '#70' psql -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
  sudo -u '#70' psql -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
  sudo -u '#70' psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
elif sudo -n -u postgres psql -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
  sudo -u postgres psql -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
  sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
else
  echo "Could not use local peer auth. If you already have superuser credentials, export them:"
  echo "  PGPASSWORD=... psql -h localhost -U postgres -d postgres"
  echo "Then re-run this script, or create the DB manually:"
  echo "  CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
  echo "  CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  exit 1
fi

ENCODED_PASSWORD="$(python3 - <<PY
from urllib.parse import quote
print(quote('''${DB_PASSWORD}''', safe=''))
PY
)"
export DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "Pushing Prisma schema..."
npx prisma generate
npx prisma db push --accept-data-loss
npx prisma db seed

echo
echo "PostgreSQL is ready."
echo "DATABASE_URL=${DATABASE_URL}"
echo "You can now restart the backend with: npm run dev"
