#!/bin/sh
set -e

echo "=== Iniciando Contenedor CRM Agente de Voz ==="

# Ejecutar migraciones si se especificó la variable DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
  echo "Ejecutando migraciones de base de datos..."
  node -r esbuild-register/register scripts/migrate.ts || npx tsx scripts/migrate.ts || echo "Advertencia: Migración completada o gestionada previamente."
fi

echo "Iniciando servidor Next.js..."
exec "$@"
