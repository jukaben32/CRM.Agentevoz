# VoiceOps CRM — Guía para Asistentes y Desarrolladores

## 1. Visión General del Proyecto
Plataforma SaaS multi-tenant autoalojable de Recepcionista Telefónico con Inteligencia Artificial (VAPI) y CRM integrada, especializada en talleres mecánicos y centros de servicio del automóvil.

## 2. Stack Tecnológico Obligatorio
- **Framework:** Next.js 16 (App Router, Turbopack, `proxy.ts` como middleware).
- **Frontend:** React 19, TypeScript (modo estricto), Tailwind CSS 4 (`@theme`), Phosphor Icons (`@phosphor-icons/react`), Recharts.
- **Base de Datos:** PostgreSQL 18 (Alpine) con `uuidv7()` nativo, extensiones `unaccent`, `pg_trgm`, `btree_gist`, y Row Level Security (RLS) forzado en todas las tablas de negocio.
- **ORM & Conexión:** Drizzle ORM 0.45.x con `node-postgres` (`pg`).
- **Autenticación:** Sesiones opacas personalizadas con cookies `httpOnly`, hashing SHA-256 y contraseñas con `bcryptjs`.
- **Integración Telefónica:** VAPI Server SDK 1.2.x, Webhook unificado con validación `timingSafeEqual`.
- **Fechas & Teléfonos:** Luxon (`Europe/Madrid`), `libphonenumber-js` (E.164 internacional y formato local español).

## 3. Principios de Diseño y Estética "Naranja Piedra"
- **Fondo de aplicación:** Piedra cálida `#F2F1EE` (no usar fondos blancos puros en pantallas principales).
- **Tarjetas y Contenedores:** Fondo blanco `#FFFFFF`, borde sutil `#E4E1DC`, `rounded-2xl`, sin sombras (`shadow-none`).
- **Acento Primario:** Naranja `#E8490C` para botones de acción principal, badges y estados activos.
- **Botones de Contraste / Tinta:** Tinta oscura `#201E1C` con texto blanco.
- **Iconografía:** Phosphor Icons exclusivamente.
- **Badges de Estado:** Colores pastel suaves con texto contrastado y bordes sutiles según el diccionario de `lib/labels.ts`.

## 4. Arquitectura Multi-Tenant y Seguridad RLS
- Todas las consultas de negocio **DEBEN** envolverse en `withTenant(businessId, async (tx) => { ... })`.
- El rol `app_user` en PostgreSQL tiene forzado RLS (`NOBYPASSRLS`) y solo accede a filas donde `business_id = current_setting('app.business_id', true)::uuid`.
- El superusuario `postgres` solo se utiliza en migraciones DDL (`scripts/migrate.ts`).
- Anti-colisión en reservas: usar `pg_advisory_xact_lock(hashtextextended(business_id::text, 0))` dentro de la transacción para soportar concurrencia `slot_capacity >= 1`.

## 5. Modelos de Voz e Integración con VAPI
- **Transcriptor:** Deepgram Nova 3 General (`es`).
- **LLM / Razonamiento:** OpenAI GPT 5.6 Luna (`openai` / `gpt-5.6-luna`).
- **Síntesis de Voz (TTS):** ElevenLabs Turbo v2.5 (`eleven_turbo_v2_5`), voz Carolina (`UOIqAnmS11Reiei1Ytkc`), idioma `es`.
- **Herramientas (Function Calling):** 7 tools compartidas registradas en VAPI con timeout de 20s y mensajes de relleno silencioso en español.
- **Webhook:** Endpoint universal `app/api/vapi/webhook/route.ts` autenticado con `Bearer VAPI_WEBHOOK_SECRET`.

## 6. Comandos de Desarrollo y Operación
- `pnpm dev`: Inicia el servidor de desarrollo local en http://localhost:3000.
- `pnpm build`: Compila la aplicación en modo producción standalone.
- `pnpm db:migrate`: Aplica las migraciones DDL mediante `pg_advisory_lock`.
- `pnpm db:seed`: Puebla la base de datos con el taller demo ("Agente Taller") y credenciales `demo@taller.es` / `demo1234`.
- `pnpm vapi:tools:sync`: Registra o actualiza las 7 herramientas compartidas en VAPI.
- `pnpm vapi:sync`: Re-alinea el `server.url` del asistente y de las tools con el `APP_URL` actual.
- `pnpm tunnel`: Inicia el túnel local (Tailscale / Cloudflared / ngrok) para recibir webhooks de VAPI.
- `pnpm test`: Ejecuta la suite de pruebas automatizadas (labels, payloads, rls).

## 7. Reglas Críticas para la IA
1. Responder siempre en **español**.
2. **NUNCA** ejecutar `git add`, `git commit` o `git push` de forma autónoma. Solo se permite `git init`.
3. Mantener `CLAUDE.md` y `AGENTS.md` exactamente idénticos (mismo hash SHA-256).
4. No usar Tailwind v3 ni librerías obsoletas; respetar Tailwind v4 `@theme`.
