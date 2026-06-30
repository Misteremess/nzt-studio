#!/bin/sh
# Arranque del contenedor de la app: primero aplica las migraciones pendientes
# contra la base de datos, luego levanta el servidor Next.
set -e

echo "→ Aplicando migraciones de base de datos (prisma migrate deploy)..."
node_modules/.bin/prisma migrate deploy

echo "→ Iniciando NZT Studio..."
exec npm run start
