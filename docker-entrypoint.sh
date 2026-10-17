#!/bin/sh
set -e

echo "[Entrypoint] Comprobando sincronizacion con la base de datos..."
MAX_RETRIES=15
COUNT=0

until npx prisma db push --accept-data-loss; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "[Entrypoint] ERROR: No se pudo conectar a la base de datos despues de $MAX_RETRIES intentos."
    exit 1
  fi
  echo "[Entrypoint] Base de datos no disponible todavia. Reintentando en 2 segundos ($COUNT/$MAX_RETRIES)..."
  sleep 2
done

echo "[Entrypoint] Base de datos sincronizada con exito."
echo "[Entrypoint] Iniciando servidor del juego en puerto ${PORT:-8080}..."
exec node dist/index.js
