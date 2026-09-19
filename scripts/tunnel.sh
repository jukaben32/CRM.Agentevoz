#!/usr/bin/env bash
set -e

PORT=${1:-3000}

echo "=== Iniciando túnel para VAPI Webhook ==="
echo "Puerto local: $PORT"

if command -v tailscale >/dev/null 2>&1; then
    echo "Usando Tailscale Funnel..."
    tailscale funnel "$PORT"
elif command -v cloudflared >/dev/null 2>&1; then
    echo "Usando Cloudflared Tunnel..."
    cloudflared tunnel --url "http://localhost:$PORT"
elif command -v ngrok >/dev/null 2>&1; then
    echo "Usando ngrok..."
    ngrok http "$PORT"
else
    echo "No se encontró tailscale, cloudflared ni ngrok en PATH."
    echo "Instala una herramienta de tunneling y configura APP_URL en tu .env"
    exit 1
fi
