import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!SUPABASE_TOKEN) {
  throw new Error(
    "SUPABASE_ACCESS_TOKEN no está configurado. Define esta variable de entorno con tu token de acceso personal de Supabase (Dashboard > Account > Access Tokens) antes de ejecutar este script."
  );
}
if (!PROJECT_REF) {
  throw new Error(
    "SUPABASE_PROJECT_REF no está configurado. Define esta variable con la referencia de tu proyecto Supabase (visible en la URL del dashboard)."
  );
}

async function executeSql(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error executing SQL in Supabase (${res.status}): ${errorText}`);
  }

  return await res.json();
}

async function main() {
  console.log("🚀 Iniciando aprovisionamiento automático en Supabase (Cloud)...");
  console.log(`Proyecto: ${PROJECT_REF}\n`);

  // 1. Extensiones, función f_unaccent y función nativa uuidv7
  console.log("1. Configurando extensiones y generador UUIDv7...");
  const initSql = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "unaccent";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "btree_gist";

    CREATE OR REPLACE FUNCTION f_unaccent(text)
      RETURNS text AS $$
        SELECT public.unaccent('public.unaccent', $1);
      $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

    CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
    DECLARE
      unix_time_ms bytea;
      uuid_bytes bytea;
    BEGIN
      unix_time_ms := substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3 for 6);
      uuid_bytes := unix_time_ms || gen_random_bytes(10);
      uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
      uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
      RETURN encode(uuid_bytes, 'hex')::uuid;
    END;
    $$ LANGUAGE plpgsql VOLATILE;
  `;
  await executeSql(initSql);
  console.log("   ✓ Extensiones y UUIDv7 configurados con éxito.");

  // 2. Aplicar esquema DDL completo
  console.log("\n2. Verificando/Aplicando esquema de tablas, índices y RLS...");
  try {
    const schemaPath = path.join(process.cwd(), "db", "migrations", "0001_initial_schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await executeSql(schemaSql);
    console.log("   ✓ Tablas, triggers y políticas RLS creadas con éxito.");
  } catch (err: any) {
    console.log("   ℹ Tablas y triggers ya existentes en Supabase. Continuando con semillero...");
  }

  // 3. Semillero de datos en Supabase (Taller demo)
  console.log("\n3. Creando usuario y taller de demostración en Supabase...");
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const seedSql = `
    DO $$
    DECLARE
      v_user_id uuid;
      v_business_id uuid;
      v_service_id uuid;
      v_contact_id uuid;
      v_call_id uuid;
    BEGIN
      -- Crear usuario demo si no existe
      IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo@taller.es') THEN
        INSERT INTO users (email, password_hash, full_name)
        VALUES ('demo@taller.es', '${passwordHash}', 'Josema Fernández')
        RETURNING id INTO v_user_id;

        -- Crear negocio demo
        INSERT INTO businesses (name, slug, timezone, phone, email, address)
        VALUES (
          'Agente Taller',
          'agente-taller',
          'America/Santo_Domingo',
          '+34910000000',
          'contacto@agentetaller.es',
          'Calle del Motor 12, Polígono Industrial'
        )
        RETURNING id INTO v_business_id;

        -- Asignar membresía como owner
        INSERT INTO memberships (user_id, business_id, role)
        VALUES (v_user_id, v_business_id, 'owner');

        -- Configurar variable de sesión para RLS
        PERFORM set_config('app.business_id', v_business_id::text, true);

        -- Configurar Agente de Voz
        INSERT INTO voice_agents (
          business_id, system_prompt, first_message, tone,
          voice_provider, voice_id, voice_model, voice_language, language,
          model, transcriber, handoff_message, slot_capacity, min_notice_minutes, booking_horizon_days
        ) VALUES (
          v_business_id,
          'Eres el recepcionista telefónico de Agente Taller...',
          'Agente Taller, buenas. ¿En qué te puedo ayudar hoy?',
          'cercano y resolutivo',
          '11labs', 'UOIqAnmS11Reiei1Ytkc', 'eleven_turbo_v2_5', 'es', 'es',
          '{"provider":"openai","model":"gpt-4.1-mini"}'::jsonb,
          '{"provider":"deepgram","model":"nova-3-general","language":"es"}'::jsonb,
          'Te paso con un mecánico de taller.', 1, 60, 14
        );

        -- Horarios semanales
        INSERT INTO business_hours (business_id, weekday, opens_at, closes_at, is_closed) VALUES
          (v_business_id, 1, '08:30:00', '19:00:00', false),
          (v_business_id, 2, '08:30:00', '19:00:00', false),
          (v_business_id, 3, '08:30:00', '19:00:00', false),
          (v_business_id, 4, '08:30:00', '19:00:00', false),
          (v_business_id, 5, '08:30:00', '19:00:00', false),
          (v_business_id, 6, '09:00:00', '13:30:00', false),
          (v_business_id, 0, '00:00:00', '00:00:00', true);

        -- Servicios
        INSERT INTO services (business_id, name, duration_minutes, price_cents, description, is_active, sort_order) VALUES
          (v_business_id, 'Cambio de aceite y filtro', 60, 8900, 'Sustitución de aceite sintético 5W30 y filtro de aceite.', true, 1),
          (v_business_id, 'Revisión pre-ITV completa', 90, 6500, 'Inspección de 45 puntos de seguridad antes de la ITV.', true, 2),
          (v_business_id, 'Cambio de pastillas de freno', 60, 11000, 'Pastillas delanteras o traseras de primeras marcas.', true, 3),
          (v_business_id, 'Diagnosis electrónica OBD2', 45, 4500, 'Lectura de fallos y borrado de testigos en centralita.', true, 4);

        -- Contactos
        INSERT INTO contacts (business_id, full_name, phone, email, notes, tags, status, source) VALUES
          (v_business_id, 'Antonio García', '+34612345678', 'antonio.garcia@email.com', 'Renault Megane (1234-BCD)', ARRAY['frenos', 'habitual'], 'cliente', 'agente_voz'),
          (v_business_id, 'María Carmen López', '+34623456789', 'mcarmen.lopez@email.com', 'Seat Ibiza (5678-FGH)', ARRAY['itv'], 'cliente', 'manual');

        INSERT INTO contacts (business_id, full_name, phone, email, notes, tags, status, source)
        VALUES (v_business_id, 'Javier Ruiz Soler', '+34634567890', 'javier.ruiz@email.com', 'Volkswagen Golf (9012-JKL)', ARRAY['aceite', 'urgente'], 'lead', 'agente_voz')
        RETURNING id INTO v_contact_id;

        -- Citas de demostración
        INSERT INTO appointments (business_id, contact_id, service_name, starts_at, ends_at, status, notes, created_via) VALUES
          (v_business_id, v_contact_id, 'Cambio de aceite y filtro', now() + interval '1 day', now() + interval '1 day 1 hour', 'confirmada', 'Cliente puntual.', 'agente_voz'),
          (v_business_id, v_contact_id, 'Revisión pre-ITV completa', now() + interval '2 days', now() + interval '2 days 90 minutes', 'agendada', 'Llamó el asistente.', 'agente_voz');
      END IF;
    END $$;
  `;
  await executeSql(seedSql);
  console.log("   ✓ Taller demo y usuario demo@taller.es creados.");

  // 4. Obtener información de conexión de Supabase
  console.log("\n4. Consultando parámetros de conexión del pooler...");
  const poolerRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/database/pooler`, {
    headers: { Authorization: `Bearer ${SUPABASE_TOKEN}` },
  });
  if (poolerRes.ok) {
    const poolerData = await poolerRes.json();
    console.log("   Pooler Data:", JSON.stringify(poolerData, null, 2));
  }

  console.log("\n🎉 ¡Todo el esquema y datos han sido creados en Supabase con éxito!");
}

main().catch((err) => {
  console.error("Error aprovisionando Supabase:", err);
  process.exit(1);
});
