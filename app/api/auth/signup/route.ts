import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { NICHO_CONFIG } from "@/lib/vapi/prompt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, businessName } = body;

    if (!email || !password || !fullName || !businessName) {
      return NextResponse.json(
        { error: "Por favor, completa todos los campos requeridos." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Verificar si el email ya existe
      const { rows: existingUser } = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [normalizedEmail]
      );
      if (existingUser.length > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Ya existe una cuenta registrada con este correo electrónico." },
          { status: 400 }
        );
      }

      // 2. Crear usuario
      const passwordHash = await hashPassword(password);
      const { rows: userRows } = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [normalizedEmail, passwordHash, fullName.trim()]
      );
      const userId = userRows[0].id;

      // 3. Generar ID y slug para el nuevo negocio y fijar el contexto de tenant para RLS
      const { rows: metaRows } = await client.query<{ id: string; slug: string }>(
        "SELECT uuidv7() AS id, slugify_business_name($1) AS slug",
        [businessName.trim()]
      );
      const businessId = metaRows[0].id;
      const slug = metaRows[0].slug;

      // Fijar variable de inquilino para que las políticas RLS permitan la inserción
      await client.query("SELECT set_config('app.business_id', $1, true)", [businessId]);

      await client.query(
        `INSERT INTO businesses (id, name, slug, timezone)
         VALUES ($1, $2, $3, 'Europe/Madrid')`,
        [businessId, businessName.trim(), slug]
      );

      // 4. Crear membresía como Propietario (owner)
      await client.query(
        `INSERT INTO memberships (user_id, business_id, role)
         VALUES ($1, $2, 'owner')`,
        [userId, businessId]
      );

      // 5. Crear Agente de Voz inicial con valores de NICHO
      const defaultPrompt = `# Identidad
Eres el asistente virtual de ${businessName.trim()}, un ${NICHO_CONFIG.tipoNegocio} en España.
Coges el teléfono cuando el equipo está trabajando y no puede atenderlo.
Tu único objetivo es resolver la llamada: informar o cerrar una cita.

# Cómo hablas
- Español de España. Tono: cercano y resolutivo. Cercano y resolutivo, nunca ceremonioso.
- Una o dos frases por turno. Jamás sueltes un párrafo.
- Una sola pregunta cada vez, y espera la respuesta antes de seguir.
- Hablas, no escribes. Nada de listas, viñetas, guiones ni símbolos.
- Di las cosas como se dicen: "el jueves catorce a las diez y media", "cuarenta y cinco euros".
- Si te interrumpen, para de hablar y escucha.
- Si no entiendes algo, pide que te lo repitan. No adivines.`;

      await client.query(
        `INSERT INTO voice_agents (
           business_id, system_prompt, first_message, tone,
           voice_provider, voice_id, voice_model, voice_language, language,
           model, transcriber, handoff_message, slot_capacity, min_notice_minutes, booking_horizon_days
         ) VALUES (
           $1, $2, $3, 'cercano y resolutivo',
           '11labs', 'UOIqAnmS11Reiei1Ytkc', 'eleven_turbo_v2_5', 'es', 'es',
           '{"provider":"openai","model":"gpt-5.6-luna"}'::jsonb,
           '{"provider":"deepgram","model":"nova-3-general","language":"es"}'::jsonb,
           'Te paso con un mecánico del taller un segundo.', 1, 60, 14
         )`,
        [
          businessId,
          defaultPrompt,
          `${businessName.trim()}, buenas. Soy el asistente virtual, ¿en qué te puedo ayudar?`,
        ]
      );

      // 6. Horarios semanales por defecto (Lunes a Viernes 08:30-13:30 y 15:30-19:00)
      for (let day = 1; day <= 5; day++) {
        await client.query(
          `INSERT INTO business_hours (business_id, weekday, opens_at, closes_at, is_closed)
           VALUES ($1, $2, '08:30:00', '13:30:00', false),
                  ($1, $2, '15:30:00', '19:00:00', false)`,
          [businessId, day]
        );
      }
      await client.query(
        `INSERT INTO business_hours (business_id, weekday, opens_at, closes_at, is_closed)
         VALUES ($1, 6, '09:00:00', '13:00:00', false),
                ($1, 0, '00:00:00', '00:00:00', true)`,
        [businessId]
      );

      // 7. Servicios iniciales del taller
      const initialServices = [
        { name: "Cambio de aceite y filtro", dur: 60, price: 8900, desc: "Sustitución de aceite sintético y filtro." },
        { name: "Revisión pre-ITV", dur: 90, price: 6500, desc: "Inspección completa de seguridad." },
        { name: "Cambio de pastillas de freno", dur: 60, price: 11000, desc: "Pastillas delanteras o traseras." },
        { name: "Diagnosis electrónica", dur: 45, price: 4500, desc: "Lectura de centralita OBD2." },
      ];

      for (let i = 0; i < initialServices.length; i++) {
        const s = initialServices[i];
        await client.query(
          `INSERT INTO services (business_id, name, duration_minutes, price_cents, description, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, true, $6)`,
          [businessId, s.name, s.dur, s.price, s.desc, i + 1]
        );
      }

      await client.query("COMMIT");

      // Iniciar sesión automáticamente
      const userAgent = req.headers.get("user-agent");
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      await createSession(userId, userAgent, ip);

      return NextResponse.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Error en registro:", err);
    return NextResponse.json(
      { error: "No se pudo completar el registro. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
