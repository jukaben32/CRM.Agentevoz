-- Inicialización de extensiones y roles para VoiceOps
-- Este script se ejecuta al crear la base de datos por primera vez en PostgreSQL 18

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Función wrapper inmutable para unaccent
-- unaccent() por defecto es STABLE y no puede usarse directamente en índices GIN/B-tree.
-- Este wrapper con 2 argumentos fijando el diccionario 'unaccent' es IMMUTABLE.
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text AS $$
    SELECT public.unaccent('public.unaccent', $1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 3. Rol de aplicación app_user
-- IMPORTANTE: app_user NO tiene privilegios de superusuario ni BYPASSRLS.
-- El aislamiento por RLS se aplica estrictamente a este usuario.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_dev_pass' NOINHERIT;
  END IF;
END
$$;

-- Otorgar permisos sobre el esquema public
GRANT USAGE, CREATE ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;
