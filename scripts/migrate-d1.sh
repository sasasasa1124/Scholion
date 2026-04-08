#!/bin/sh
# Apply pending D1 migrations in order, skipping already-applied ones.
# Usage:
#   scripts/migrate-d1.sh           # remote (production)
#   scripts/migrate-d1.sh --local   # local dev DB

FLAG="--remote"
if [ "$1" = "--local" ]; then
  FLAG="--local"
fi

DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

# Ensure the migration-tracking table exists
npx wrangler d1 execute quiz-db $FLAG --command \
  "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')))" \
  2>/dev/null || true

for f in $(ls "$DIR"/*.sql | sort); do
  name=$(basename "$f")
  # Check if this migration has already been applied
  result=$(npx wrangler d1 execute quiz-db $FLAG \
    --command "SELECT COUNT(*) as c FROM d1_migrations WHERE name='${name}'" 2>/dev/null \
    | grep '"c"' | grep -o '[0-9]*')
  if [ "$result" = "1" ]; then
    echo "[migrate-d1] Skipping ${name} (already applied)"
    continue
  fi
  echo "[migrate-d1] Applying ${name}..."
  if npx wrangler d1 execute quiz-db $FLAG --file="$f"; then
    npx wrangler d1 execute quiz-db $FLAG \
      --command "INSERT OR IGNORE INTO d1_migrations (name) VALUES ('${name}')" 2>/dev/null
    echo "[migrate-d1] Applied ${name}"
  else
    echo "[migrate-d1] ERROR: ${name} failed. Stopping."
    exit 1
  fi
done

echo "[migrate-d1] Done."
