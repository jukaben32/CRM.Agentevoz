# 🚗 VoiceOps CRM — Recepcionista Telefónico con IA + CRM

> **Plataforma SaaS multi-tenant de Recepcionista Telefónico con Inteligencia Artificial y CRM integrada**, diseñada y adaptada especialmente para **talleres mecánicos y centros de servicio del automóvil**.

> 🟢 **Producción actual:** [`crm-agentevoz.vercel.app`](https://crm-agentevoz.vercel.app), desplegado en **Vercel** con base de datos en **Supabase**. El proyecto también soporta la vía autoalojada original (Docker + VPS + Dokploy, §"Despliegue"), pero esa no es la que está en producción hoy. Detalle completo del estado en [`docs/ESTADO-Y-PENDIENTES.md`](docs/ESTADO-Y-PENDIENTES.md).

---

## 🌟 Características Principales

- **🤖 Recepcionista IA Especializado:** Configurado por defecto con **Deepgram Nova 3** (`es`), **OpenAI GPT-4.1 Mini** y **ElevenLabs Turbo v2.5** (Voz Carolina, español de España).
- **🛠️ Herramientas de Voz (Function Calling):** 7 herramientas nativas sincronizadas con VAPI:
  - `consultar_disponibilidad`: Cálculo inteligente de franjas horarias libres.
  - `reservar_cita`: Bloqueo atómico y reserva con `pg_advisory_xact_lock`.
  - `consultar_cita_por_telefono`: Búsqueda de citas activas por número de teléfono.
  - `anular_cita`: Cancelación de citas con liberación inmediata de franja.
  - `consultar_servicios_precios`: Catálogo de servicios y precios en lenguaje natural.
  - `consultar_preguntas_frecuentes`: Respuestas directas a dudas comunes (horarios, ubicación, sustitución).
  - `transferir_llamada_humano`: Transferencia en vivo al número de guardia o recepción.
- **📅 Agenda y Calendario Interactivo:** Vista semanal y diaria de citas con capacidad de modificación de estado, detalles del servicio y enlace directo al contacto y grabación.
- **👥 CRM de Contactos Automático:** Creación y enriquecimiento de contactos en cada llamada con notas automáticas, historial y búsqueda rápida trigram (`pg_trgm`) insensible a acentos (`f_unaccent`).
- **🎙️ Conversaciones y Reproductor de Audio:** Transcripción turno a turno (`assistant`, `user`, `tool`), resumen estructurado de la llamada, métricas de coste/duración y proxy de audio con caché segura de URLs firmadas.
- **🎨 Estudio del Agente:** Personalización del tono, primera frase, selector visual de modelos de IA con estimación de coste/latencia, catálogo de servicios, horarios semanales, preguntas frecuentes y vista previa en tiempo real del prompt del sistema.
- **🔌 Conexiones & Webhook Inspector:** Herramientas de diagnóstico para re-alinear el `server.url` en VAPI, probar el ping del webhook y reejecutar (replay) eventos recibidos.
- **🔒 Seguridad y Aislamiento Multi-Tenant:** Base de datos **PostgreSQL 18** con Row Level Security (RLS) forzado en todas las tablas de negocio y rol restringido `app_user` (`NOBYPASSRLS`).
- **🎨 Estética "Naranja Piedra":** Paleta cálida `#F2F1EE`, acentos `#E8490C`, botones de tinta `#201E1C`, bordes suaves y tarjetas `rounded-2xl` sin sombras pesadas.

---

## 🏗️ Arquitectura del Sistema

```mermaid
graph TD
    UserPhone([📞 Teléfono del Cliente]) -->|Llamada PSTN/SIP| VAPI[☁️ Plataforma VAPI]
    VAPI -->|ASR: Deepgram Nova 3| LLM[🧠 OpenAI GPT-4.1 Mini]
    LLM -->|TTS: ElevenLabs Carolina| VAPI
    LLM -->|Function Calling| Webhook[⚡ Next.js 16 Webhook API /api/vapi/webhook]
    Webhook -->|withTenant RLS| DB[(🐘 PostgreSQL 18 Multi-Tenant)]
    
    WebUser([💻 Taller Mecánico / Administrador]) -->|Browser / Dashboard| App[🖥️ Next.js 16 App Router]
    App -->|Drizzle ORM + Sessions| DB
    App -->|Proxy 302 Seguro| AudioProxy[🎧 /api/calls/:id/recording]
    AudioProxy -->|Fetch mono-recording| VAPI
```

---

## 🚀 Inicio Rápido en Local

> Puedes usar Postgres local en Docker (como describen los pasos de abajo) **o** apuntar directamente a un proyecto de Supabase desde el arranque — en ese caso, salta el paso 3 y pon `DATABASE_URL`/`DATABASE_DIRECT_URL` en tu `.env` (sin `sslmode` en la query string).

### 1. Requisitos Previos
- **Node.js:** v22 o v24
- **pnpm:** v11 (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker & Docker Compose:** para PostgreSQL local (opcional si usas Supabase directamente, ver nota arriba)

### 2. Clonar y Configurar Entorno
```bash
# Copiar archivo de variables de entorno
cp .env.example .env
```

Edita `.env` con tus credenciales (claves de VAPI, clave secreta de webhook y URLs).

### 3. Levantar Base de Datos
```bash
docker compose up -d
```
> Esto iniciará PostgreSQL 18 en el puerto `5432` y Adminer en el puerto `8080`.

### 4. Instalar Dependencias y Aplicar Migraciones
```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```
> El semillero crea el taller demo **"Agente Taller"** con el usuario `demo@taller.es` y contraseña `demo1234`.

### 5. Sincronizar Herramientas con VAPI
```bash
pnpm vapi:tools:sync
```

### 6. Iniciar Servidor de Desarrollo
```bash
pnpm dev
```
Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con `demo@taller.es` / `demo1234`.

### 7. Exponer Webhook Localmente para VAPI
En una terminal separada, inicia el túnel:
```bash
pnpm tunnel
```
Copia la URL pública generada (ejemplo: `https://tu-tunel.tailscale.net`), asígnala a `APP_URL` en tu `.env` y sincroniza las URLs de VAPI:
```bash
pnpm vapi:sync
```

---

## 📋 Variables de Entorno

| Variable | Descripción | Local (Docker) | Producción (Supabase + Vercel) |
|---|---|---|---|
| `NODE_ENV` | Entorno de ejecución | `development` | `production` (lo fija Vercel) |
| `DATABASE_URL` | Conexión de la app (pool de transacción) | `postgresql://app_user:...@localhost:5432/voiceops` | `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` |
| `DATABASE_DIRECT_URL` | Conexión para migraciones (pool de sesión) | `postgresql://postgres:...@localhost:5432/voiceops` | igual que arriba con el puerto `5432` |
| `APP_URL` | URL pública base (webhooks VAPI) | `https://<equipo>.<tailnet>.ts.net` (túnel, §Tailscale) | `https://crm-agentevoz.vercel.app` |
| `VAPI_API_KEY` | Clave API privada de VAPI | igual | igual |
| `VAPI_WEBHOOK_SECRET` / `VAPI_WEBHOOK_TOKEN` | Token del webhook (misma Custom Credential) | igual | igual |
| `DEFAULT_TIMEZONE` / `DEFAULT_COUNTRY_CODE` | Localización por defecto | `America/Santo_Domingo` / `DO` | según negocio |

> ⚠️ **No incluyas `?sslmode=require` en `DATABASE_URL`/`DATABASE_DIRECT_URL` contra Supabase.** `pg` 8.x lo trata como `verify-full` e ignora la opción `ssl` que pone el código, y la conexión falla con `self-signed certificate in certificate chain`. El código (`lib/env.ts` → `toPgConnectionOptions()`) ya limpia ese parámetro si aparece, pero es más simple no ponerlo. Ver `docs/ESTADO-Y-PENDIENTES.md` §3.

Plantilla completa y comentada en `.env.example`.

---

## 📞 Configuración de Números Telefónicos en España (+34)

Para asociar un número telefónico español al agente de voz:

1. **Adquisición en VAPI / Twilio:**
   - En el panel de VAPI o Twilio, adquiere un número con prefijo de España (`+34 91...`, `+34 93...` o numeración móvil/nacional).
2. **Asignación del Asistente:**
   - Asigna el asistente de voz generado por el CRM al número telefónico.
3. **Configuración del Webhook del Número:**
   - Asegúrate de que el webhook de servidor del número apunte a:
     `https://tu-dominio.com/api/vapi/webhook`
   - Configura el header de autorización con tu `VAPI_WEBHOOK_SECRET`.
4. **Desvío de Llamadas del Taller:**
   - En el teléfono fijo o móvil del taller, puedes activar un desvío condicional (cuando no contesta o comunica) o incondicional hacia el número del agente de voz:
     - En España: `**61*NUMERO_AGENTE**20#` (desvío tras 20 segundos sin contestar).

---

## 🚢 Despliegue en Producción

El proyecto soporta dos vías. **La que está realmente en producción hoy es la A.**

### A. Vercel + Supabase (la que usamos)

1. **Base de datos en Supabase:** crea un proyecto en [supabase.com](https://supabase.com), aplica `db/init/00-roles.sql` y `db/migrations/0001_initial_schema.sql` desde el SQL Editor (o `pnpm db:migrate` apuntando `DATABASE_DIRECT_URL` al proyecto), y siembra con `pnpm db:seed`.
2. **Proyecto en Vercel:** importa el repositorio de GitHub. Vercel detecta Next.js automáticamente (no hace falta tocar `output: "standalone"`, que es para la vía Docker; Vercel lo ignora).
3. **Variables de entorno en Vercel** (Project Settings → Environment Variables): `DATABASE_URL`, `DATABASE_DIRECT_URL` (ver formato Supabase en la tabla de arriba, **sin** `sslmode` en la query string), `APP_URL` (el dominio que asigne Vercel), `VAPI_API_KEY`, `VAPI_WEBHOOK_SECRET`/`VAPI_WEBHOOK_TOKEN`, `DEFAULT_TIMEZONE`, `DEFAULT_COUNTRY_CODE`.
4. **Deploy.** Cada `git push origin main` redespliega solo (integración GitHub ya vinculada al crear el proyecto).
5. **Sincronizar VAPI:** entra a **Conexiones** en el panel y pulsa **"Re-alinear con APP_URL"** y luego **"Provisionar Asistente"** (o `pnpm vapi:sync` / `pnpm vapi:tools:sync` en local apuntando a la base de producción).
6. Un cambio de variable de entorno en Vercel **no** afecta a un deployment ya construido — hace falta un redeploy (`vercel --prod` o un nuevo push) para que la función serverless la recoja.

### B. Docker + VPS + Dokploy (autoalojado, alternativa)

El repositorio incluye soporte nativo para esta vía mediante Docker Compose y Traefik, pensada para quien prefiera tener el Postgres y la app en un servidor propio en vez de servicios gestionados:

1. **Crear Servicio en Dokploy:**
   - Crea un nuevo servicio tipo **Compose** en Dokploy.
   - Vincula el repositorio de Git y selecciona el archivo `docker-compose.dokploy.yml`.
2. **Variables de Entorno en Dokploy:**
   - Configura `APP_DOMAIN=crm.tudominio.com`.
   - Configura `APP_URL=https://crm.tudominio.com`.
   - Configura `VAPI_API_KEY` y `VAPI_WEBHOOK_SECRET`.
   - **No** configures `DATABASE_URL`/`DATABASE_DIRECT_URL` aquí: esta vía usa el Postgres del propio `docker-compose.dokploy.yml` (variables `POSTGRES_*` + `DB_HOST=db`), no Supabase.
3. **Desplegar:**
   - Dokploy construirá la imagen multi-etapa con Node.js 24 Alpine, aplicará las migraciones automáticas al iniciar el contenedor mediante `docker-entrypoint.sh` y provisionará los certificados SSL automáticamente con Let's Encrypt mediante Traefik.
4. **Sincronizar VAPI en Producción:**
   - Una vez desplegado, accede a la sección **Conexiones** en el CRM y pulsa **"Re-alinear URLs en VAPI"** o ejecuta `pnpm vapi:sync` en la consola del contenedor.

---

## 🩺 Tabla de Diagnóstico y Resolución de Problemas

| Síntoma / Error | Causa Raíz Probable | Solución Inmediata |
|---|---|---|
| **Webhook devuelve 401 Unauthorized** | El `VAPI_WEBHOOK_SECRET` configurado en VAPI no coincide con el del `.env`. | Revisa `.env` y pulsa "Re-alinear URLs" en la sección de Conexiones del CRM. |
| **VAPI responde "Error running tool"** | `server.url` de las tools compartidas apunta a una URL inaccesible o caducada. | Ejecuta `pnpm vapi:sync` o verifica que el túnel esté activo. |
| **El audio no reproduce en Conversaciones** | La URL directa de VAPI expiró o requiere autenticación Bearer. | El reproductor usa la ruta proxy `/api/calls/[id]/recording` con caché firmada de 20 min. |
| **RLS Error: `permission denied for table ...`** | Se intentó ejecutar una consulta como `app_user` sin establecer `app.business_id`. | Envuelve la operación en `withTenant(businessId, async (tx) => ...)`. |
| **Horarios no coinciden en citas agendadas** | Desfase de zona horaria entre servidor y cliente. | Todas las horas se normalizan y procesan en `Europe/Madrid` con Luxon. |

---

## 📐 Registro de Decisiones y Desviaciones Técnicas

1. **Anti-colisión de Reservas mediante `pg_advisory_xact_lock`:** En lugar de un constraint rígido `EXCLUDE` a nivel de base de datos, se implementó bloqueo consultivo por negocio dentro de una transacción serializable. Esto permite que talleres con múltiples elevadores/mecánicos configuren libremente `slot_capacity >= 1` sin bloqueos erróneos.
2. **Proxy de Grabaciones con Caché en Memoria:** VAPI devuelve URLs protegidas para las grabaciones mono de llamada. Se construyó el endpoint `/api/calls/[id]/recording` que autentica la petición contra la API de VAPI, almacena en memoria la URL firmada durante 20 minutos y emite un `302 Found`, reduciendo drásticamente llamadas redundantes a la API de VAPI.
3. **Filtrado de Mensajes de Sistema en Transcripciones:** VAPI envía el prompt del sistema como primer mensaje con rol `system`. Para mantener el historial de chat limpio para los operarios del taller, los mensajes de rol `system` se descartan y los de rol `bot` se normalizan a `assistant`.
4. **Unificación de Modelos por Defecto:** Se preservó la combinación de modelos fijada en la especificación técnica en transcriptor y voz — **Deepgram Nova 3** (`es`) y **ElevenLabs Turbo v2.5** (Carolina) —, pero el LLM especificado (`gpt-5.6-luna`) resultó no ser un modelo real de OpenAI (VAPI lo acepta al crear el asistente sin validarlo, y falla recién en la primera llamada real). Se sustituyó por **OpenAI GPT-4.1 Mini**, verificado contra un asistente real en la misma cuenta de VAPI. Detalle en `docs/ESTADO-Y-PENDIENTES.md`.
5. **Postgres 17 en vez de 18:** el proyecto de Supabase usado en producción corre Postgres 17, no el 18 que pide la especificación para tener `uuidv7()` nativo. La migración base ya traía una implementación propia de `uuidv7()` (función `plpgsql`, RFC 9562), así que no hubo que tocar nada — solo se documenta la desviación.

---

## 🧪 Pruebas Automatizadas

Ejecuta la suite de pruebas unitarias y de integración:
```bash
pnpm test
```
Las pruebas cubren:
- Diccionario y etiquetas en español (`tests/labels.test.ts`).
- Payloads, tool extraction, prompt generator y seguridad de tokens (`tests/vapi-payload.test.ts`).
- Aislamiento multi-tenant bajo Row Level Security (`tests/rls.test.ts`).

---

## 📄 Licencia

Software privado y de código abierto para despliegue autoalojado bajo licencia MIT.
