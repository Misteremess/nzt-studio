#!/usr/bin/env bash
# ci-deploy.sh — Desplegado por GitHub Actions (workflow_dispatch).
# También se puede lanzar manualmente desde el VPS:
#     bash /opt/hyperfocus/nzt/deploy/scripts/ci-deploy.sh
set -euo pipefail

COMPOSE="docker compose --profile tools -f docker-compose.production.yml"
COMPOSE_BASE="docker compose -f docker-compose.production.yml"
APP_DIR="/opt/hyperfocus/nzt"

echo "▶ [1/5] Actualizando código..."
cd "$APP_DIR"
git pull --ff-only

echo "▶ [2/5] Construyendo imágenes (incluye servicio migrate)..."
$COMPOSE build

echo "▶ [3/5] Aplicando migraciones de base de datos..."
$COMPOSE run --rm migrate

echo "▶ [4/5] Reiniciando servicios..."
$COMPOSE_BASE up -d --remove-orphans

echo "▶ [5/5] Comprobando salud del contenedor app..."
MAX_ATTEMPTS=24   # 24 × 5s = 2 minutos máximo
ATTEMPT=0
while true; do
    CONTAINER_ID=$($COMPOSE_BASE ps -q app 2>/dev/null || true)
    if [ -n "$CONTAINER_ID" ]; then
        HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER_ID" 2>/dev/null || echo "unknown")
        if [ "$HEALTH" = "healthy" ]; then
            echo "✅ Deploy completado — app healthy"
            exit 0
        fi
        echo "   Esperando... intento $((ATTEMPT + 1))/$MAX_ATTEMPTS (estado: $HEALTH)"
    else
        echo "   Esperando a que el contenedor arranque... ($((ATTEMPT + 1))/$MAX_ATTEMPTS)"
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
        echo "❌ El contenedor no alcanzó estado healthy en $((MAX_ATTEMPTS * 5))s"
        echo "--- Últimos logs del contenedor ---"
        $COMPOSE_BASE logs app --tail=60
        exit 1
    fi
    sleep 5
done
