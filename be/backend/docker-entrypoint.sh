#!/bin/sh
set -e

echo "[backend] Waiting for MySQL at mysql:3306..."
until nc -z mysql 3306; do
  sleep 1
done
echo "[backend] MySQL is reachable."

# Migration-first approach (phù hợp production).
# - prisma migrate deploy: chỉ chạy các migration chưa áp dụng
# - seed (tuỳ chọn) để tạo dữ liệu demo

echo "[backend] Running Prisma migrate deploy..."
npx prisma migrate deploy

# Backward compatibility: nếu project cũ set AUTO_DB_PUSH=true thì coi như muốn seed demo.
if [ "${AUTO_DB_PUSH}" = "true" ] && [ -z "${AUTO_SEED}" ]; then
  export AUTO_SEED="true"
fi

if [ "${AUTO_SEED}" = "true" ]; then
  if [ -f prisma/seed.js ]; then
    echo "[backend] Seeding..."
    node prisma/seed.js || true
  fi
fi

echo "[backend] Starting server..."
exec "$@"
