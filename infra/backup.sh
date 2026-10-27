#!/usr/bin/env sh
# Daily Postgres backup with rotation. Run from cron on the VPS, e.g.:
#   15 3 * * * /opt/shift-smith/infra/backup.sh >> /var/log/planner-backup.log 2>&1
# Environment: BACKUP_DIR (default ./backups), KEEP_DAYS (default 14).
set -eu

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file .env"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/planner-$(date +%Y%m%d-%H%M%S).sql.gz"

# Plain SQL dump (with DROP statements) so it restores onto an existing database.
$COMPOSE exec -T postgres pg_dump -U planner -d planner --clean --if-exists --no-owner \
  | gzip > "$file.tmp"
mv "$file.tmp" "$file"

find "$BACKUP_DIR" -name 'planner-*.sql.gz' -type f -mtime +"$KEEP_DAYS" -delete

echo "$(date -Iseconds) backup written: $file ($(du -h "$file" | cut -f1))"
