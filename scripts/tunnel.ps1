# Script PowerShell para iniciar un túnel de desarrollo local con Tailscale Funnel / Cloudflared
# y actualizar VAPI automáticamente.
Param(
    [int]$Port = 3000
)

Write-Host "=== Iniciando túnel para VAPI Webhook ===" -ForegroundColor Cyan
Write-Host "Puerto local: $Port" -ForegroundColor Yellow

# Comprobar si tailscale está disponible
if (Get-Command "tailscale" -ErrorAction SilentlyContinue) {
    Write-Host "Usando Tailscale Funnel..." -ForegroundColor Green
    tailscale funnel $Port
} elseif (Get-Command "cloudflared" -ErrorAction SilentlyContinue) {
    Write-Host "Usando Cloudflared Tunnel..." -ForegroundColor Green
    cloudflared tunnel --url http://localhost:$Port
} elseif (Get-Command "ngrok" -ErrorAction SilentlyContinue) {
    Write-Host "Usando ngrok..." -ForegroundColor Green
    ngrok http $Port
} else {
    Write-Host "No se encontró tailscale, cloudflared ni ngrok en PATH." -ForegroundColor Red
    Write-Host "Por favor instala tailscale o cloudflared, o expón el puerto 3000 a internet y actualiza APP_URL en tu .env" -ForegroundColor Yellow
}
