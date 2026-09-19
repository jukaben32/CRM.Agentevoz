-- ==============================================================================
-- Migración 0001: Esquema inicial con Aislamiento RLS en PostgreSQL 18
-- ==============================================================================
-- Convenciones:
-- 1. IDs primarios usan uuidv7() nativo de PostgreSQL 18 (ordenable en el tiempo).
-- 2. Marcas de tiempo usan timestamptz (UTC).
-- 3. Row Level Security (RLS) habilitado y FORZADO en todas las tablas de negocio.
--    El aislamiento se basa en current_setting('app.business_id', true)::uuid.
-- ==============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Función wrapper inmutable para unaccent
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text AS $$
    SELECT public.unaccent('public.unaccent', $1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 3. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para generar slugs únicos de negocio
CREATE OR REPLACE FUNCTION slugify_business_name(raw_name text)
RETURNS text AS $$
DECLARE
  clean_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  -- Limpiar caracteres especiales, acentos y espacios
  clean_slug := lower(regexp_replace(f_unaccent(raw_name), '[^a-zA-Z0-9]+', '-', 'g'));
  clean_slug := trim(both '-' from clean_slug);
  IF clean_slug = '' THEN
    clean_slug := 'taller';
  END IF;
  
  final_slug := clean_slug;
  WHILE EXISTS (SELECT 1 FROM businesses WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := clean_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- TABLAS PRINCIPALES
-- ==============================================================================

-- 1. Negocios (Inquilinos)
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  phone text,
  email text,
  website text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_businesses_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Usuarios del sistema
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Membresías (Relación Usuario - Negocio)
CREATE TABLE IF NOT EXISTS memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

-- 4. Sesiones opacas
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- 5. Agente de Voz (1:1 con el negocio)
CREATE TABLE IF NOT EXISTS voice_agents (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  system_prompt text NOT NULL,
  system_prompt_override text,
  first_message text NOT NULL,
  tone text NOT NULL DEFAULT 'cercano y resolutivo',
  voice_provider text NOT NULL DEFAULT '11labs',
  voice_id text NOT NULL DEFAULT 'UOIqAnmS11Reiei1Ytkc',
  voice_model text DEFAULT 'eleven_turbo_v2_5',
  voice_language text DEFAULT 'es',
  language text NOT NULL DEFAULT 'es',
  model jsonb NOT NULL DEFAULT '{"provider":"openai","model":"gpt-5.6-luna"}'::jsonb,
  transcriber jsonb NOT NULL DEFAULT '{"provider":"deepgram","model":"nova-3-general","language":"es"}'::jsonb,
  handoff_number text,
  handoff_message text NOT NULL DEFAULT 'Te transfiero con un compañero del taller para que te ayude.',
  slot_capacity integer NOT NULL DEFAULT 1,
  min_notice_minutes integer NOT NULL DEFAULT 60,
  booking_horizon_days integer NOT NULL DEFAULT 14,
  vapi_assistant_id text,
  vapi_phone_number_id text,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_voice_agents_updated_at
BEFORE UPDATE ON voice_agents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Preguntas frecuentes del negocio (business_facts)
CREATE TABLE IF NOT EXISTS business_facts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_facts_tenant ON business_facts(business_id, sort_order);

-- 7. Catálogo de Servicios
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  price_cents integer,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(business_id, is_active, sort_order);
CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON services
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. Horarios semanales
CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  is_closed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_business_hours_tenant ON business_hours(business_id, weekday);

-- 9. Cierres y festivos
CREATE TABLE IF NOT EXISTS closures (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closures_tenant ON closures(business_id, starts_at, ends_at);

-- 10. Contactos (CRM)
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  company text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'cliente', 'inactivo')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('agente_voz', 'manual', 'importado')),
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  outbound_consent boolean NOT NULL DEFAULT false,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único parcial por negocio y teléfono (E.164 normalizado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_phone_unique
ON contacts(business_id, phone)
WHERE phone IS NOT NULL;

-- Índice GIN de trigramas para búsqueda por nombre sin acentos
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
ON contacts USING gin (f_unaccent(full_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_status ON contacts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON contacts(business_id, created_at DESC);

CREATE TRIGGER trg_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. Notas del contacto
CREATE TABLE IF NOT EXISTS contact_notes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_tenant ON contact_notes(business_id, contact_id, created_at DESC);

-- 12. Llamadas
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  vapi_call_id text UNIQUE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('scheduled', 'queued', 'ringing', 'in-progress', 'forwarding', 'ended')),
  ended_reason text,
  summary text,
  cost_cents integer NOT NULL DEFAULT 0,
  recording_url text,
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_tenant_started ON calls(business_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_contact ON calls(business_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_vapi_id ON calls(vapi_call_id);

-- 13. Mensajes de transcripción (turno a turno)
CREATE TABLE IF NOT EXISTS call_messages (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('assistant', 'user', 'system', 'tool')),
  content text NOT NULL,
  seconds_from_start integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_messages_tenant_call ON call_messages(business_id, call_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_call_messages_content_trgm ON call_messages USING gin (f_unaccent(content) gin_trgm_ops);

-- 14. Citas (Appointments)
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'confirmada', 'completada', 'anulada', 'no_show')),
  notes text,
  created_via text NOT NULL DEFAULT 'panel' CHECK (created_via IN ('agente_voz', 'panel')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_starts ON appointments(business_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_contact ON appointments(business_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON appointments(business_id, status);

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 15. Registro de Eventos Webhook (Idempotencia y Auditoría)
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'vapi',
  event_type text NOT NULL,
  external_id text UNIQUE NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  error text
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant ON webhook_events(business_id, processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON webhook_events(external_id);

-- 16. Tools Compartidas de VAPI (Infraestructura de Plataforma, Sin RLS)
CREATE TABLE IF NOT EXISTS vapi_tools (
  name text PRIMARY KEY,
  vapi_tool_id text NOT NULL,
  checksum text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- 1. Habilitar y forzar RLS en todas las tablas dependientes de inquilino
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agents FORCE ROW LEVEL SECURITY;

ALTER TABLE business_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_facts FORCE ROW LEVEL SECURITY;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;

ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours FORCE ROW LEVEL SECURITY;

ALTER TABLE closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE closures FORCE ROW LEVEL SECURITY;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls FORCE ROW LEVEL SECURITY;

ALTER TABLE call_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;

-- 2. Crear las Políticas RLS basadas en la variable de sesión 'app.business_id'

-- businesses
CREATE POLICY tenant_isolation_businesses ON businesses
  FOR ALL
  USING (id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- memberships
CREATE POLICY tenant_isolation_memberships ON memberships
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- voice_agents
CREATE POLICY tenant_isolation_voice_agents ON voice_agents
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- business_facts
CREATE POLICY tenant_isolation_business_facts ON business_facts
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- services
CREATE POLICY tenant_isolation_services ON services
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- business_hours
CREATE POLICY tenant_isolation_business_hours ON business_hours
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- closures
CREATE POLICY tenant_isolation_closures ON closures
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- contacts
CREATE POLICY tenant_isolation_contacts ON contacts
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- contact_notes
CREATE POLICY tenant_isolation_contact_notes ON contact_notes
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- calls
CREATE POLICY tenant_isolation_calls ON calls
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- call_messages
CREATE POLICY tenant_isolation_call_messages ON call_messages
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- appointments
CREATE POLICY tenant_isolation_appointments ON appointments
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);

-- webhook_events
CREATE POLICY tenant_isolation_webhook_events ON webhook_events
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid OR business_id IS NULL)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid OR business_id IS NULL);
