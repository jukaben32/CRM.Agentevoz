-- ==============================================================================
-- Migración 0002: Eleven Flash v2.5 como modelo de voz por defecto
-- ==============================================================================
-- Cambia el DEFAULT de voice_agents.voice_model de 'eleven_turbo_v2_5' a
-- 'eleven_flash_v2_5': menor latencia (~75ms vs ~490ms) y es el único modelo
-- de ElevenLabs que VAPI documenta con soporte explícito para el campo
-- `language` en la configuración de voz.
--
-- Solo afecta filas NUEVAS creadas sin especificar voice_model explícito.
-- NO modifica negocios ya existentes (p.ej. el demo "Agente Taller" sigue
-- con 'eleven_turbo_v2_5' hasta que alguien lo cambie desde Estudio).
-- ==============================================================================

ALTER TABLE voice_agents ALTER COLUMN voice_model SET DEFAULT 'eleven_flash_v2_5';
