#!/bin/sh
set -e

echo "[entrypoint] Syncing database schema (prisma db push)..."
# Retry a few times in case the DB container is still coming up.
n=0
until npx prisma db push --skip-generate --accept-data-loss; do
  n=$((n + 1))
  if [ "$n" -ge 10 ]; then
    echo "[entrypoint] prisma db push failed after $n attempts — starting anyway."
    break
  fi
  echo "[entrypoint] DB not ready yet (attempt $n/10) — retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Starting server..."
exec npx tsx server/index.ts
