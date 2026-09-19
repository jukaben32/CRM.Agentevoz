# VoiceOps CRM — Guía para Asistentes y Desarrolladores

## 1. Visión General del Proyecto
Plataforma SaaS multi-tenant de Recepcionista Telefónico con Inteligencia Artificial (VAPI) y CRM integrada, especializada en talleres mecánicos y centros de servicio del automóvil. Soporta dos vías de despliegue: **Vercel + Supabase** (la que está en producción hoy) y **Docker + Dokploy autoalojado** (alternativa, sigue funcionando). Ver `docs/ESTADO-Y-PENDIENTES.md` para el detalle de cuál se usa y por qué.

## 2. Stack Tecnológico Obligatorio
- **Framework:** Next.js 16 (App Router, Turbopack, `proxy.ts` como middleware).
- **Frontend:** React 19, TypeScript (modo estricto), Tailwind CSS 4 (`@theme` + `@custom-variant dark` por clase), Phosphor Icons (`@phosphor-icons/react`), Recharts.
- **Base de Datos:** PostgreSQL con `uuidv7()` (nativo en PG18; en Supabase/PG17 se implementa como función propia en la migración — mismo comportamiento), extensiones `unaccent`, `pg_trgm`, `btree_gist`, y Row Level Security (RLS) forzado en todas las tablas de negocio.
- **ORM & Conexión:** Drizzle ORM 0.45.x con `node-postgres` (`pg`). Ver §7 sobre SSL con Supabase.
- **Autenticación:** Sesiones opacas personalizadas con cookies `httpOnly`, hashing SHA-256 y contraseñas con `bcryptjs`.
- **Integración Telefónica:** VAPI Server SDK 1.2.x, Webhook unificado con validación `timingSafeEqual`.
- **Fechas & Teléfonos:** Luxon (zona horaria por negocio), `libphonenumber-js` (E.164 internacional y formato local).

## 3. Principios de Diseño y Estética "Naranja Piedra"
- **Fondo de aplicación:** Piedra cálida `#F2F1EE` (no usar fondos blancos puros en pantallas principales).
- **Tarjetas y Contenedores:** Fondo blanco `#FFFFFF`, borde sutil `#E4E1DC`, `rounded-2xl`, sin sombras (`shadow-none`).
- **Acento Primario:** Naranja `#E8490C` para botones de acción principal, badges y estados activos.
- **Botones de Contraste / Tinta:** Tinta oscura `#201E1C` con texto blanco (se invierte en tema oscuro).
- **Iconografía:** Phosphor Icons exclusivamente.
- **Badges de Estado:** Colores pastel suaves con texto contrastado y bordes sutiles según el diccionario de `lib/labels.ts`. Toda variante de color debe llevar su par `dark:` — ver trampa en §7.
- **Tema oscuro:** controlado por la clase `.dark` en `<html>` (no por `prefers-color-scheme`), vía el hook `lib/hooks/use-theme.ts` y un script inline en `app/layout.tsx` que evita parpadeo al cargar. Botón "Tema" y "Colapsar menú" al final del sidebar (`components/sidebar.tsx`), ambos persistidos en `localStorage`.

## 4. Arquitectura Multi-Tenant y Seguridad RLS
- Todas las consultas de negocio **DEBEN** envolverse en `withTenant(businessId, async (tx) => { ... })`.
- El rol de aplicación tiene forzado RLS y solo accede a filas donde `business_id = current_setting('app.business_id', true)::uuid`.
- El rol propietario/superusuario solo se utiliza en migraciones DDL (`scripts/migrate.ts`) y en el aprovisionamiento inicial de Supabase (`scripts/supabase-migrate.ts`).
- Anti-colisión en reservas: usar `pg_advisory_xact_lock(hashtextextended(business_id::text, 0))` dentro de la transacción para soportar concurrencia `slot_capacity >= 1`.

## 5. Modelos de Voz e Integración con VAPI
- **Transcriptor:** Deepgram Nova 3 General (`es`).
- **LLM / Razonamiento:** OpenAI **GPT-4.1 Mini** (`openai` / `gpt-4.1-mini`). ⚠️ El plan original especificaba `gpt-5.6-luna`, que **no es un modelo real** — VAPI lo aceptaba al crear el asistente sin validar, pero fallaba en la primera llamada real. No reintroducir ese identificador; si se cambia de modelo, verificar primero contra un asistente real en el dashboard de VAPI (regla de `lib/vapi/defaults.ts`, nunca inventar IDs).
- **Síntesis de Voz (TTS):** ElevenLabs Turbo v2.5 (`eleven_turbo_v2_5`), voz Carolina (`UOIqAnmS11Reiei1Ytkc`), idioma `es`.
- **Herramientas (Function Calling):** 7 tools compartidas registradas en VAPI (`vapi_tools`), enganchadas por `toolIds`, con timeout y mensajes de relleno silencioso en español. Si `vapi_tools` está vacía pero las tools ya existen en VAPI, **no** relanzar `vapi:tools:sync` sin más — crearía duplicados; rellenar la tabla con los IDs reales primero.
- **Webhook:** Endpoint universal `app/api/vapi/webhook/route.ts` autenticado con `Bearer VAPI_WEBHOOK_SECRET`.

## 6. Comandos de Desarrollo y Operación
- `pnpm dev`: Servidor de desarrollo local en http://localhost:3000.
- `pnpm build`: Compila la aplicación en modo producción standalone.
- `pnpm db:migrate`: Aplica las migraciones DDL mediante `pg_advisory_lock` (usa `DATABASE_DIRECT_URL`).
- `pnpm db:seed`: Puebla la base de datos con el taller demo ("Agente Taller") y credenciales `demo@taller.es` / `demo1234`.
- `pnpm vapi:tools:sync`: Registra o actualiza las 7 herramientas compartidas en VAPI (idempotente por nombre).
- `pnpm vapi:sync`: Re-alinea el `server.url` del asistente y de las tools con el `APP_URL` actual.
- `pnpm tunnel`: Túnel local (Tailscale) para probar el webhook **en desarrollo**. No hace falta en producción: Vercel ya da HTTPS público.
- `pnpm test`: Ejecuta la suite de pruebas automatizadas (labels, payloads, rls).
- Despliegue a producción: `git push origin main` → Vercel redespliega solo (proyecto ya vinculado). Las variables de entorno se gestionan en el dashboard de Vercel, no en un `.env` del servidor.

## 7. Trampas conocidas
- **SSL con el pooler de Supabase:** `pg` 8.x trata `sslmode=require` en la cadena de conexión como `verify-full` e **ignora** la opción `ssl` pasada por código, dando `self-signed certificate in certificate chain`. Usa siempre `toPgConnectionOptions()` de `lib/env.ts` en vez de pasar la connection string a secas a `Pool`/`Client`.
- `db.execute` (Drizzle) devuelve `timestamptz` como `string`, no `Date`.
- El `server.url` hay que actualizarlo en el asistente **y** en las 7 tools (botón "Re-alinear con APP_URL" en Conexiones, o `pnpm vapi:sync`).
- Los teléfonos se normalizan a E.164 **antes** de tocar la base de datos.
- En Vercel, un cambio de variable de entorno **no** se aplica a un deployment ya construido: hace falta un redeploy.

## 8. Reglas Críticas para la IA
1. Responder siempre en **español**.
2. **NUNCA** ejecutar `git add`, `git commit` o `git push` de forma autónoma salvo que el usuario lo pida explícitamente en ese momento de la conversación. `git init` sí está permitido sin pedirlo.
3. Mantener `CLAUDE.md` y `AGENTS.md` exactamente idénticos (mismo contenido byte a byte).
4. No usar Tailwind v3 ni librerías obsoletas; respetar Tailwind v4 `@theme` + `@custom-variant`.
5. Nunca inventar identificadores de VAPI (modelo, `voiceId`, tool ID) — verificar contra la API o el dashboard antes de escribirlos en código o en base de datos.
