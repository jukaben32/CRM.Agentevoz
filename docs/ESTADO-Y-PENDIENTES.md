# Estado del proyecto y pendientes

> Documento vivo. Refleja la realidad del despliegue en cada momento — actualízalo en la misma tanda de trabajo en que cambie algo relevante (mismo criterio que `CLAUDE.md`/`AGENTS.md`, ver §0.3 del prompt original).
>
> Última actualización: **19 de septiembre de 2026**.

---

## 1. Desviación principal respecto al plan original

Este proyecto se generó siguiendo `PROMPT-crm-agente-voz.md`, que asumía un despliegue **autoalojado**: Postgres en Docker (local y en producción) + túnel Tailscale + VPS con Dokploy.

**Lo que realmente se usa en producción hoy es otro camino, más ligero:**

| Pieza | Plan original | Lo que hay ahora |
|---|---|---|
| Base de datos | Postgres 18 en Docker, en el propio VPS | **Supabase** (Postgres gestionado, proyecto `sslcqyxjxihzgedydebi`, región `ca-central-1`) |
| Hosting de la app | VPS de Hostinger + Dokploy + Traefik | **Vercel** (`https://crm-agentevoz.vercel.app`, proyecto `crm-agentevoz`) |
| Exposición pública del webhook | Tailscale Funnel (necesario porque local no tiene HTTPS público) | No hace falta: Vercel ya da una URL HTTPS pública real. Tailscale solo sigue siendo útil para **probar en local** antes de desplegar. |
| Despliegue | `git push` a Dokploy vía GitHub App | `git push origin main` → Vercel redespliega solo (ya vinculado al repo) |

El código sigue siendo compatible con la vía autoalojada (Docker Compose + Dokploy siguen en el repo y funcionan), pero **la vía real y probada es Vercel + Supabase**. `PROMPT-crm-agente-voz.md` se actualizó para documentar ambas, con Vercel+Supabase como principal.

---

## 2. Estado actual de cada pieza

### ✅ Aplicación
- Desplegada en `https://crm-agentevoz.vercel.app`, commit `787e82a` en adelante.
- Login funcionando (`demo@taller.es` / `demo1234`).
- Modo oscuro (toggle "Tema") y menú lateral colapsable implementados en todas las vistas.
- Build de producción (`next build`) limpio, sin errores de tipos.

### ✅ Base de datos (Supabase)
- 16 tablas, RLS, triggers y semillero del taller demo aplicados.
- **Corre Postgres 17, no 18.** El prompt original pedía Postgres 18 por su `uuidv7()` nativo. Supabase (a fecha de creación del proyecto) ofrece Postgres 17, así que la migración base (`db/migrations/0001_initial_schema.sql`) **implementa `uuidv7()` como función propia** (`plpgsql`, RFC 9562) en vez de depender de la nativa. Funciona igual, pero si algún día se migra a un Postgres 18 real, esa función personalizada puede convivir sin problema con la nativa (mismo nombre, mismo comportamiento) — no hace falta tocar nada.
- Conexión vía **pooler de Supabase** (`aws-0-ca-central-1.pooler.supabase.com`), puerto `6543` para la app (transacción) y `5432` para migraciones (sesión).

### ✅ VAPI
- Asistente **"Agente Taller"** creado y publicado: `de6b7b15-09fa-4c86-b510-90a86683cc66`.
- Modelo: `openai` / `gpt-4.1-mini` (ver §3 más abajo — el valor original del prompt no era válido).
- Voz: ElevenLabs, `UOIqAnmS11Reiei1Ytkc` ("Carolina").
- 7 tools compartidas registradas y vinculadas (`registrarHandoff`, `datosDelNegocio`, `anularCita`, `reprogramarCita`, `reservarCita`, `consultarHuecos`, `identificarLlamante`).
- `server.url` del asistente y de las 7 tools apuntando a `https://crm-agentevoz.vercel.app/api/vapi/webhook`.
- Ping de salud (`/api/health`) respondiendo `200`.

### ❌ Pendiente: número de teléfono
No hay ningún número vinculado al asistente (`vapi_phone_number_id` es `NULL`). Requiere que el dueño del negocio importe un número real desde **Twilio, Telnyx o Vonage** (ver §14.3 del prompt original) y lo vincule en VAPI. Es el único paso que no se puede hacer sin una cuenta de telefonía propia del usuario.

Mientras tanto, el asistente se puede probar directamente desde el dashboard de VAPI (botón "Talk").

---

## 3. Bugs reales encontrados y corregidos

Estos no estaban en el plan original — aparecieron al pasar de "generado por IA" a "funcionando de verdad en producción". Se documentan aquí porque son el tipo de fallo silencioso que el propio prompt (§14.6) pide recoger.

| Bug | Causa | Fix |
|---|---|---|
| Login devolvía 500 en producción | El pool de `pg` se conectaba a `localhost` (valor por defecto) porque `DATABASE_URL` no estaba seteada la primera vez, y luego, al setearla, `sslmode=require` en la cadena de conexión hace que `pg` 8.x trate el modo como `verify-full` e **ignore** la opción `ssl: { rejectUnauthorized: false }` pasada por código — error `self-signed certificate in certificate chain` contra el pooler de Supabase. | `lib/env.ts` expone `toPgConnectionOptions()`, que quita `sslmode` de la URL y controla el SSL solo por la opción `ssl`. Aplicado en `lib/db/index.ts`, `scripts/migrate.ts` y `scripts/seed.ts`. |
| Modelo LLM inválido (`gpt-5.6-luna`) | No es un modelo real de OpenAI — probablemente alucinado en una sesión anterior. VAPI lo acepta al crear el asistente sin validarlo (no comprueba contra OpenAI hasta la primera llamada real), así que el fallo no aparece hasta que un cliente real llama. | Reemplazado por `gpt-4.1-mini` en todo el código (`lib/vapi/defaults.ts`, `lib/vapi/actions.ts`, `lib/db/schema.ts`, `components/agent-settings-view.tsx`, semilleros, catálogo) y corregido también el dato ya guardado en producción. Confirmado que `gpt-4.1-mini` funciona de verdad en esta cuenta de VAPI. |
| `vapi_tools` vacía en producción | El script `vapi:tools:sync` nunca se ejecutó contra la base de Supabase (solo contra una base local, o no se ejecutó). Las 7 tools sí existían ya en VAPI (creadas manualmente o en otra sesión), pero la tabla que las rastrea estaba vacía. | Se completó `vapi_tools` con los IDs reales ya existentes en VAPI, en vez de dejar que el sync creara 7 tools duplicadas. |
| Modo oscuro a medias | El CSS ya tenía variables para tema oscuro (`.dark { ... }`), pero Tailwind 4 no tenía configurado el variante `dark:` por clase (usaba `prefers-color-scheme`, no la clase `.dark`), así que el interruptor de tema no controlaba nada. Además, "Conexiones", "Mi perfil" y el inspector de webhooks usaban colores fijos sin variante oscura. | `@custom-variant dark (&:where(.dark, .dark *));` en `globals.css` + hook `lib/hooks/use-theme.ts` + arreglo de las 3 vistas sin cobertura. |
| Secreto de Supabase hardcodeado | `scripts/supabase-migrate.ts` tenía el Personal Access Token de Supabase como constante en el código. GitHub Push Protection bloqueó el primer intento de `git push`. | Movido a variables de entorno `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF`, con validación al arrancar. |

---

## 4. Notas para quien retome esto

- El **rate limit de login** se dejó en 20 intentos/5 min (el prompt original no especifica un número; era 6 en el código generado). Si se quiere más estricto, es una línea en `app/api/auth/login/route.ts`.
- `scripts/supabase-migrate.ts` es un script de aprovisionamiento inicial (crea extensiones, aplica el schema y siembra el negocio demo directamente vía la API de gestión de Supabase, sin necesitar conexión Postgres directa). Útil para provisionar un proyecto Supabase nuevo desde cero; no es parte del flujo normal de `pnpm db:migrate` / `pnpm db:seed`.
- Si se despliega una segunda instancia (otro negocio, otro entorno), recordar: (1) `DATABASE_URL`/`DATABASE_DIRECT_URL` sin `sslmode` en la query string — el código ya lo limpia solo si se le pasa, pero es más claro no incluirlo; (2) correr `pnpm vapi:tools:sync` **una vez**, contra la base de datos correcta, antes de provisionar ningún asistente, para que `vapi_tools` no quede vacía.
