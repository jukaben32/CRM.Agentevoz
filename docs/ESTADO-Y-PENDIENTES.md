# Estado del proyecto y pendientes

> Documento vivo. Refleja la realidad del despliegue en cada momento — actualízalo en la misma tanda de trabajo en que cambie algo relevante (mismo criterio que `CLAUDE.md`/`AGENTS.md`, ver §0.3 del prompt original).
>
> Última actualización: **25 de septiembre de 2026**.

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

### ❌ Pendiente: número de teléfono — ⏸ en stand by
No hay ningún número vinculado al asistente (`vapi_phone_number_id` es `NULL`). Requiere importar un número real en VAPI desde **Twilio, Telnyx o Vonage** (ver §14.3 del prompt original). **Pendiente de decidir**: número dominicano (809/829/849 — poca disponibilidad de números de voz en Twilio para RD) o número norteamericano (+1 EE. UU., mucha más disponibilidad). Es el único paso que no se puede hacer sin una cuenta de telefonía propia del usuario.

Mientras tanto, el asistente se puede probar directamente desde el dashboard de VAPI (botón "Talk"), o simulando el webhook (ver §5).

---

## 3. Bugs reales encontrados y corregidos (primera ronda, hasta el 19 de septiembre)

Estos no estaban en el plan original — aparecieron al pasar de "generado por IA" a "funcionando de verdad en producción". Se documentan aquí porque son el tipo de fallo silencioso que el propio prompt (§14.6) pide recoger.

| Bug | Causa | Fix |
|---|---|---|
| Login devolvía 500 en producción | El pool de `pg` se conectaba a `localhost` (valor por defecto) porque `DATABASE_URL` no estaba seteada la primera vez, y luego, al setearla, `sslmode=require` en la cadena de conexión hace que `pg` 8.x trate el modo como `verify-full` e **ignore** la opción `ssl: { rejectUnauthorized: false }` pasada por código — error `self-signed certificate in certificate chain` contra el pooler de Supabase. | `lib/env.ts` expone `toPgConnectionOptions()`, que quita `sslmode` de la URL y controla el SSL solo por la opción `ssl`. Aplicado en `lib/db/index.ts`, `scripts/migrate.ts` y `scripts/seed.ts`. |
| Modelo LLM inválido (`gpt-5.6-luna`) | No es un modelo real de OpenAI — probablemente alucinado en una sesión anterior. VAPI lo acepta al crear el asistente sin validarlo (no comprueba contra OpenAI hasta la primera llamada real), así que el fallo no aparece hasta que un cliente real llama. | Reemplazado por `gpt-4.1-mini` en todo el código (`lib/vapi/defaults.ts`, `lib/vapi/actions.ts`, `lib/db/schema.ts`, `components/agent-settings-view.tsx`, semilleros, catálogo) y corregido también el dato ya guardado en producción. Confirmado que `gpt-4.1-mini` funciona de verdad en esta cuenta de VAPI. |
| `vapi_tools` vacía en producción | El script `vapi:tools:sync` nunca se ejecutó contra la base de Supabase (solo contra una base local, o no se ejecutó). Las 7 tools sí existían ya en VAPI (creadas manualmente o en otra sesión), pero la tabla que las rastrea estaba vacía. | Se completó `vapi_tools` con los IDs reales ya existentes en VAPI, en vez de dejar que el sync creara 7 tools duplicadas. |
| Modo oscuro a medias | El CSS ya tenía variables para tema oscuro (`.dark { ... }`), pero Tailwind 4 no tenía configurado el variante `dark:` por clase (usaba `prefers-color-scheme`, no la clase `.dark`), así que el interruptor de tema no controlaba nada. Además, "Conexiones", "Mi perfil" y el inspector de webhooks usaban colores fijos sin variante oscura. | `@custom-variant dark (&:where(.dark, .dark *));` en `globals.css` + hook `lib/hooks/use-theme.ts` + arreglo de las 3 vistas sin cobertura. |
| Secreto de Supabase hardcodeado | `scripts/supabase-migrate.ts` tenía el Personal Access Token de Supabase como constante en el código. GitHub Push Protection bloqueó el primer intento de `git push`. | Movido a variables de entorno `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF`, con validación al arrancar. |

---

## 4. Notas para quien retome esto (primera ronda)

- El **rate limit de login** se dejó en 20 intentos/5 min (el prompt original no especifica un número; era 6 en el código generado). Si se quiere más estricto, es una línea en `app/api/auth/login/route.ts`.
- `scripts/supabase-migrate.ts` es un script de aprovisionamiento inicial (crea extensiones, aplica el schema y siembra el negocio demo directamente vía la API de gestión de Supabase, sin necesitar conexión Postgres directa). Útil para provisionar un proyecto Supabase nuevo desde cero; no es parte del flujo normal de `pnpm db:migrate` / `pnpm db:seed`.
- Si se despliega una segunda instancia (otro negocio, otro entorno), recordar: (1) `DATABASE_URL`/`DATABASE_DIRECT_URL` sin `sslmode` en la query string — el código ya lo limpia solo si se le pasa, pero es más claro no incluirlo; (2) correr `pnpm vapi:tools:sync` **una vez**, contra la base de datos correcta, antes de provisionar ningún asistente, para que `vapi_tools` no quede vacía.

---

## 5. Auditoría del 25 de septiembre de 2026: 4 bugs operativos encontrados y corregidos

Se hizo una revisión completa a petición del usuario ("dime qué le falta para estar operativo, examínalo"). Antes de esta sesión, **el asistente no podía completar ninguna operación real** aunque hubiera tenido número de teléfono: cualquier llamada real habría fallado en la primera herramienta. Se encontraron y corrigieron 4 problemas, verificados con llamadas simuladas reales contra el webhook de producción (`status-update` + `tool-calls`, la misma secuencia que manda VAPI):

| # | Bug | Cómo se detectó | Fix |
|---|---|---|---|
| 1 | Ni el asistente ni las 7 tools tenían `server.credentialId` en VAPI (`isServerUrlSecretSet: false`). El webhook exige `Authorization: Bearer` y sin credencial VAPI nunca la manda → **401 en cada tool-call**. | Lectura directa de la API de VAPI (`GET /assistant/:id`, `GET /tool`). | Se creó una Custom Credential Bearer en VAPI (`e49608dc-7821-4e46-b69d-07e02d757c70`) con el mismo valor que `VAPI_WEBHOOK_TOKEN`, se añadió `VAPI_SERVER_CREDENTIAL_ID` en Vercel (los 3 entornos) y se aplicó a las 7 tools + el asistente. `connections-actions.ts` y `vapi-sync.ts` ahora usan `credentialId` (antes `vapi-sync.ts` mandaba `server.secret`, que VAPI ignora para esta validación) y verifican `res.ok` antes de reportar éxito. |
| 2 | El asistente en VAPI no tenía ningún system prompt (`model.messages` vacío). | Misma lectura de `GET /assistant/:id`. | Se re-provisionó el prompt vía API con los datos reales del negocio demo. |
| 3 | `lib/vapi/prompt.ts` escribía la fecha/hora "de hoy" en el momento de provisionar el asistente, no en cada llamada. Al día siguiente el agente seguiría creyendo que es el día en que se generó el prompt. | Lectura del código. | La fecha/hora ahora son variables Liquid (`{{"now" \| date: ..., "<timezone>"}}`) que VAPI resuelve en cada llamada real. |
| 4 | **Crítico:** `reservarCita` fallaba siempre con "No se pudo completar la operación en la agenda en este momento" — sin dejar rastro visible para quien no mirase los logs. `appointments.call_id` es una FK a `calls.id` (UUID interno generado por nosotros), pero `bookAppointment` recibía y guardaba directamente el `vapiCallId` (ID externo de VAPI) sin resolverlo, así que el insert siempre violaba `appointments_call_id_fkey`. | Se probó `reservarCita` end-to-end simulando la secuencia real de eventos (`status-update` para crear la fila en `calls`, luego `tool-calls`) contra el webhook de producción y se leyó el error real en `vercel logs`. | `lib/scheduling/booking.ts`: antes de insertar la cita, se resuelve `calls.id` a partir de `calls.vapiCallId = callId`. |

**Verificado end-to-end tras el fix**: `datosDelNegocio`, `consultarHuecos` y `reservarCita` (con secuencia `status-update` → `tool-calls`) devuelven `200` y datos reales de la base de datos de producción. La cita de prueba creada (`Prueba Diagnostico Claude`, 28/sep 09:00) se **anuló** tras verificar. Queda un contacto de prueba (`Prueba Diagnostico Claude`, tel. `+34600000099`, origen "agente_voz") en **Contactos** — no había forma de borrarlo sin acceso directo a la base de datos desde esta sesión; se puede eliminar a mano desde el CRM cuando convenga.

**Nota sobre huecos ofrecidos "en el pasado":** durante la verificación, `consultarHuecos` devolvió alguna vez una franja horaria que, a simple vista, ya había pasado ese mismo día. No se investigó a fondo (fuera del alcance de esta auditoría) — si vuelve a observarse, revisar `lib/scheduling/availability.ts` (filtro `slotStart < earliestAllowed`) y el valor real de `min_notice_minutes` del agente en producción.

### Localización a República Dominicana (pedido explícito del usuario)
Se cambiaron los **valores por defecto del código** (nuevas señales, nuevos negocios que se registren, y el semillero `pnpm db:seed`) a República Dominicana:
- `DEFAULT_TIMEZONE=America/Santo_Domingo`, `DEFAULT_COUNTRY_CODE=DO` (código y Vercel, los 3 entornos).
- Moneda: pesos dominicanos (`RD$`) en vez de euros, en todo el código (prompt, webhook, vista de Estudio).
- `lib/phone.ts` normaliza números dominicanos (809/829/849, 10 dígitos) a `+1...`.
- Selector de zona horaria en Estudio: `America/Santo_Domingo` ahora es la opción recomendada.

**Importante — esto NO tocó los datos ya existentes**: el negocio demo real "Agente Taller" en la base de datos de producción sigue con `timezone = Europe/Madrid` y precios en el formato antiguo (el asistente re-provisionado en esta sesión respeta ese dato real, no inventa uno nuevo). Si se quiere que el propio negocio demo pase a operar en RD, hay que entrar a **Estudio** (con sesión iniciada) y guardar ahí la zona horaria nueva — los cambios de código no migran filas ya existentes.

## 6. Notas para quien retome esto (segunda ronda, 25 de septiembre)

- El asistente y las 7 tools se re-provisionaron **directamente vía API de VAPI** en esta sesión (no se hizo clic en "Re-alinear"/"Provisionar Asistente" desde el CRM), porque no había acceso a `DATABASE_URL`/`DATABASE_DIRECT_URL` de producción desde este entorno de trabajo (bloqueo intencional de seguridad). La próxima vez que alguien use el botón "Provisionar Asistente" desde **Conexiones**, sobrescribirá el prompt con los datos reales actuales de la base de datos — es el camino normal y preferido a partir de ahora que `VAPI_SERVER_CREDENTIAL_ID` ya está configurada.
- Si en algún momento se rota `VAPI_WEBHOOK_TOKEN`, hay que crear una **nueva** Custom Credential en VAPI con el valor nuevo (o editar la existente, id `e49608dc-7821-4e46-b69d-07e02d757c70`) y volver a pulsar "Re-alinear con APP_URL" — la credencial no se actualiza sola.

## 7. Afinado de voz (Vapi + ElevenLabs) — 25 de septiembre, misma sesión

El usuario compartió un análisis comparativo Vapi-vs-ElevenLabs; el proyecto **ya implementaba** la arquitectura híbrida que recomienda (Vapi orquesta la llamada, ElevenLabs pone la voz). Se aplicaron las mejoras concretas que el análisis señala:

- **Voz: `eleven_turbo_v2_5` → `eleven_flash_v2_5`** (menor latencia, ~75ms según ElevenLabs, vs ~490ms de Turbo; además `language` explícito en la config de voz de VAPI solo está documentado como soportado en Flash v2.5). Cambiado en el asistente en vivo (vía API) y en todos los defaults de código: `lib/vapi/defaults.ts`, `lib/db/schema.ts` (con migración `db/migrations/0002_voice_model_flash_default.sql`, **aún sin aplicar a producción** — correr `pnpm db:migrate` contra `DATABASE_DIRECT_URL` de prod), `scripts/seed.ts`, `app/api/auth/signup/route.ts`.
- **`optimizeStreamingLatency: 3`** añadido a la voz (rango 0–4, prioriza velocidad de streaming).
- **`stopSpeakingPlan.numWords: 2`** en el asistente: evita que el agente se calle en seco si el cliente suelta un "sí"/"vale" de dos palabras mientras habla — mejora el manejo de interrupciones que el análisis destaca como fortaleza de Vapi, sin tocar los demás valores por defecto de la plataforma.
- **Tool nativo `endCall` añadido** (`lib/vapi/actions.ts`, y en vivo vía API): antes la llamada nunca colgaba sola tras la despedida, seguía "abierta" (y facturando minutos) hasta el límite de 10 minutos. El prompt (`lib/vapi/prompt.ts`) ahora instruye explícitamente colgar tras despedirse. Esto lo exige la skill `create-assistant` de VAPI ("Attach the native endCall tool to every newly built assistant") — se detectó al leerla tras instalar `VapiAI/skills` en este repo.

**Pendiente, requiere decisión/credencial del usuario**: VAPI usa su propia cuenta compartida de ElevenLabs por defecto (sin `credentialId` en el bloque `voice`). Se puede conectar una cuenta propia de ElevenLabs (Integrations → API key propia) para no depender del pool compartido de VAPI — mejora fiabilidad bajo carga y separa el coste/cuota de ElevenLabs del de VAPI. Necesita que el usuario aporte su propia clave de ElevenLabs.

**Nota sobre `stability`/`similarityBoost`/`style`/`useSpeakerBoost`**: no se tocaron (se dejaron en los valores por defecto de ElevenLabs/VAPI). Ajustarlos bien requiere escuchar audio real, y esta sesión no tiene forma de reproducir/verificar audio — si se afinan, hacerlo escuchando llamadas de prueba reales, no a ciegas.
