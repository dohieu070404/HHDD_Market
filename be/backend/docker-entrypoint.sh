#!/bin/sh
set -e

echo "[backend] Waiting for MySQL at mysql:3306..."
until nc -z mysql 3306; do
  sleep 1
done
echo "[backend] MySQL is reachable."

# Dev convenience: tự đồng bộ schema + seed nếu bật AUTO_DB_PUSH=true
# (db push idempotent cho môi trường dev).
if [ "${AUTO_DB_PUSH}" = "true" ]; then
  echo "[backend] AUTO_DB_PUSH=true -> Prisma db push..."
  npx prisma db push
  if [ -f prisma/seed.js ]; then
    echo "[backend] Seeding..."
    node prisma/seed.js || true
  fi
fi
echo "[backend] Starting server..."
exec "$@"
