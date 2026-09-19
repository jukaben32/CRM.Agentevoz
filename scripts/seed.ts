import bcrypt from "bcryptjs";
import pg from "pg";
import { getAdminDatabaseUrl } from "../lib/env";

const { Client } = pg;

async function seed() {
  console.log("🌱 Iniciando semillero de datos (pnpm db:seed)...");
  const client = new Client({
    connectionString: getAdminDatabaseUrl(),
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    // 1. Comprobar si el usuario demo ya existe
    const demoEmail = "demo@taller.es";
    const { rows: existingUser } = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [demoEmail]
    );

    if (existingUser.length > 0) {
      console.log("ℹ️ El usuario de demostración 'demo@taller.es' ya existe. Omitiendo semillero.");
      await client.query("ROLLBACK");
      return;
    }

    console.log("👤 Creando usuario demo: Josema Fernández (demo@taller.es / demo1234)...");
    const passwordHash = await bcrypt.hash("demo1234", 12);
    const { rows: userRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [demoEmail, passwordHash, "Josema Fernández"]
    );
    const userId = userRows[0].id;

    // 2. Crear negocio demo
    console.log("🏢 Creando negocio demo: Agente Taller...");
    const { rows: businessRows } = await client.query<{ id: string }>(
      `INSERT INTO businesses (name, slug, timezone, phone, email, website, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        "Agente Taller",
        "agente-taller",
        "Europe/Madrid",
        "+34910000000",
        "contacto@agentetaller.es",
        "https://agentetaller.es",
        "Calle del Motor 42, 28022 Madrid",
      ]
    );
    const businessId = businessRows[0].id;

    // 3. Crear membresía (Owner)
    await client.query(
      `INSERT INTO memberships (user_id, business_id, role)
       VALUES ($1, $2, 'owner')`,
      [userId, businessId]
    );

    // 4. Crear configuración de Agente de Voz (Stack §10.1 por defecto)
    console.log("🤖 Configurando Agente de Voz...");
    const systemPrompt = `# Identidad
Eres el asistente virtual de Agente Taller, un taller mecánico en Madrid.
Coges el teléfono cuando el equipo está trabajando y no puede atenderlo.
Tu único objetivo es resolver la llamada: informar o cerrar una cita.

# Cómo hablas
- Español de España. Tono: cercano y resolutivo. Cercano y resolutivo, nunca ceremonioso.
- Una o dos frases por turno. Jamás sueltes un párrafo.
- Una sola pregunta cada vez, y espera la respuesta antes de seguir.
- Hablas, no escribes. Nada de listas, viñetas, guiones ni símbolos.
- Di las cosas como se dicen: "el jueves catorce a las diez y media", "cuarenta y cinco euros", "una hora y media". Las matrículas, letra por letra.
- Si te interrumpen, para de hablar y escucha.
- Si no entiendes algo, pide que te lo repitan. No adivines.

# Lo que sabes
Dirección: Calle del Motor 42, 28022 Madrid
Teléfono del negocio: +34 910 00 00 00
Correo del negocio: contacto@agentetaller.es
Página web: https://agentetaller.es

# Reglas que no puedes saltarte
- No inventes precios, plazos, servicios ni disponibilidad. Si algo no está arriba, di que no lo sabes y ofrece que te devuelvan la llamada.
- No confirmes ninguna hora sin haberla comprobado antes con la agenda.
- Ya sabes desde qué número llaman. No lo pidas. Solo pide un teléfono si el cliente quiere dar otro distinto para el aviso.
- Nunca pidas datos bancarios, de tarjeta ni de pago. Si insisten, deriva.
- No des información de otros clientes ni de otras citas.
- Si te piden algo que no tiene que ver con taller mecánico, reconduce con amabilidad en una frase.`;

    await client.query(
      `INSERT INTO voice_agents (
         business_id, system_prompt, first_message, tone,
         voice_provider, voice_id, voice_model, voice_language, language,
         model, transcriber, handoff_number, handoff_message,
         slot_capacity, min_notice_minutes, booking_horizon_days
       ) VALUES (
         $1, $2, $3, $4,
         '11labs', 'UOIqAnmS11Reiei1Ytkc', 'eleven_turbo_v2_5', 'es', 'es',
         '{"provider":"openai","model":"gpt-5.6-luna"}'::jsonb,
         '{"provider":"deepgram","model":"nova-3-general","language":"es"}'::jsonb,
         '+34600112233', 'Te paso con un mecánico del taller un segundo.',
         2, 60, 14
       )`,
      [
        businessId,
        systemPrompt,
        "Agente Taller, buenas. Soy el asistente virtual, ¿en qué te puedo ayudar?",
        "cercano y resolutivo",
      ]
    );

    // 5. Horario semanal (Lunes a Viernes partido, Sábado mañana)
    console.log("🕒 Creando horarios semanales...");
    const schedules = [
      { weekday: 1, opens: "08:30:00", closes: "13:30:00" },
      { weekday: 1, opens: "15:30:00", closes: "19:00:00" },
      { weekday: 2, opens: "08:30:00", closes: "13:30:00" },
      { weekday: 2, opens: "15:30:00", closes: "19:00:00" },
      { weekday: 3, opens: "08:30:00", closes: "13:30:00" },
      { weekday: 3, opens: "15:30:00", closes: "19:00:00" },
      { weekday: 4, opens: "08:30:00", closes: "13:30:00" },
      { weekday: 4, opens: "15:30:00", closes: "19:00:00" },
      { weekday: 5, opens: "08:30:00", closes: "13:30:00" },
      { weekday: 5, opens: "15:30:00", closes: "19:00:00" },
      { weekday: 6, opens: "09:00:00", closes: "13:00:00" },
    ];

    for (const sch of schedules) {
      await client.query(
        `INSERT INTO business_hours (business_id, weekday, opens_at, closes_at, is_closed)
         VALUES ($1, $2, $3, $4, false)`,
        [businessId, sch.weekday, sch.opens, sch.closes]
      );
    }

    // 6. Catálogo de Servicios
    console.log("🛠️ Creando catálogo de servicios...");
    const services = [
      {
        name: "Cambio de aceite y filtro",
        duration: 60,
        price: 8900,
        desc: "Sustitución de aceite sintético 5W30/5W40 y filtro homologado.",
        sort: 1,
      },
      {
        name: "Revisión pre-ITV completa",
        duration: 90,
        price: 6500,
        desc: "Inspección de 45 puntos de seguridad, gases, frenos y luces.",
        sort: 2,
      },
      {
        name: "Cambio de pastillas de freno",
        duration: 60,
        price: 11000,
        desc: "Pastillas delanteras o traseras con comprobación de discos y líquido.",
        sort: 3,
      },
      {
        name: "Diagnosis electrónica y borrado de averías",
        duration: 45,
        price: 4500,
        desc: "Lectura por OBD2 de centralitas, diagnosis de fallos y reseteo.",
        sort: 4,
      },
    ];

    const serviceMap = new Map<string, string>();
    for (const s of services) {
      const { rows: sRows } = await client.query<{ id: string }>(
        `INSERT INTO services (business_id, name, duration_minutes, price_cents, description, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         RETURNING id`,
        [businessId, s.name, s.duration, s.price, s.desc, s.sort]
      );
      serviceMap.set(s.name, sRows[0].id);
    }

    // 7. Preguntas frecuentes (business_facts)
    console.log("❓ Añadiendo preguntas frecuentes...");
    const facts = [
      {
        q: "¿Tenéis vehículo de sustitución?",
        a: "Sí, disponemos de 2 vehículos de cortesía bajo reserva previa sin coste adicional para revisiones de más de 2 horas.",
        sort: 1,
      },
      {
        q: "¿Trabajáis con compañías de seguros?",
        a: "Trabajamos con todas las aseguradoras principales (Mapfre, Mutua Madrileña, Allianz, AXA, Línea Directa).",
        sort: 2,
      },
      {
        q: "¿Qué garantía tienen las reparaciones?",
        a: "Todas nuestras reparaciones tienen 1 año de garantía en mano de obra y 2 años en recambios originales.",
        sort: 3,
      },
    ];

    for (const f of facts) {
      await client.query(
        `INSERT INTO business_facts (business_id, question, answer, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [businessId, f.q, f.a, f.sort]
      );
    }

    // 8. Contactos de ejemplo (CRM)
    console.log("📇 Añadiendo contactos de ejemplo...");
    const contactsData = [
      {
        name: "Javier Ruiz Gómez",
        phone: "+34612345678",
        email: "jruiz@gmail.com",
        status: "cliente",
        source: "agente_voz",
        custom: { matricula: "1234FGH", vehiculo: "Volkswagen Golf VII 2.0 TDI" },
        tags: ["recurrente", "mantenimiento"],
      },
      {
        name: "Elena Martín Soria",
        phone: "+34698765432",
        email: "elena.martin@empresa.es",
        status: "cliente",
        source: "manual",
        custom: { matricula: "5678LMN", vehiculo: "Toyota Yaris Hybrid" },
        tags: ["flota", "frenos"],
      },
      {
        name: "Marcos Villanueva",
        phone: "+34655443322",
        email: "marcos.villa@outlook.com",
        status: "lead",
        source: "agente_voz",
        custom: { matricula: "9012KLP", vehiculo: "Peugeot 3008" },
        tags: ["pre-itv"],
      },
    ];

    const contactMap = new Map<string, string>();
    for (const c of contactsData) {
      const { rows: cRows } = await client.query<{ id: string }>(
        `INSERT INTO contacts (
           business_id, full_name, phone, email, status, source,
           custom_fields, tags, outbound_consent, last_contacted_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now() - interval '2 days')
         RETURNING id`,
        [
          businessId,
          c.name,
          c.phone,
          c.email,
          c.status,
          c.source,
          JSON.stringify(c.custom),
          c.tags,
        ]
      );
      contactMap.set(c.name, cRows[0].id);

      // Nota automática
      await client.query(
        `INSERT INTO contact_notes (business_id, contact_id, body, author_user_id)
         VALUES ($1, $2, $3, NULL)`,
        [
          businessId,
          cRows[0].id,
          `Ficha creada automáticamente por llamada del Agente de Voz para ${c.custom.vehiculo}.`,
        ]
      );
    }

    // 9. Llamadas de ejemplo con transcripción
    console.log("📞 Insertando llamadas de demostración...");
    const javierId = contactMap.get("Javier Ruiz Gómez");
    const { rows: callRows } = await client.query<{ id: string }>(
      `INSERT INTO calls (
         business_id, contact_id, vapi_call_id, direction, from_number,
         started_at, ended_at, duration_seconds, status, ended_reason,
         summary, cost_cents, needs_review
       ) VALUES (
         $1, $2, 'call_demo_javier_001', 'inbound', '+34612345678',
         now() - interval '3 hours', now() - interval '3 hours' + interval '104 seconds',
         104, 'ended', 'customer-ended-call',
         'El cliente Javier Ruiz solicita cita para cambio de aceite y filtro de su Volkswagen Golf con matrícula 1234FGH. Se agenda para el próximo jueves a las 10:00.',
         19, false
       ) RETURNING id`,
      [businessId, javierId]
    );
    const callId = callRows[0].id;

    // Mensajes de la conversación (roles traducidos: bot -> assistant)
    const messages = [
      { role: "assistant", text: "Agente Taller, buenas. Soy el asistente virtual, ¿en qué te puedo ayudar?", sec: 2 },
      { role: "user", text: "Hola, quería pedir cita para cambiar el aceite y los filtros de mi coche.", sec: 8 },
      { role: "assistant", text: "Claro. El cambio de aceite nos lleva una hora. ¿Qué día te vendría bien?", sec: 14 },
      { role: "user", text: "El jueves por la mañana a primera hora si es posible.", sec: 22 },
      { role: "assistant", text: "Déjame mirar la agenda un segundo. Para el jueves tengo a las nueve o a las diez de la mañana. ¿Cuál prefieres?", sec: 35 },
      { role: "user", text: "A las diez me viene perfecto.", sec: 42 },
      { role: "assistant", text: "Muy bien. ¿Me indicas tu nombre y la matrícula del coche, por favor?", sec: 48 },
      { role: "user", text: "Soy Javier Ruiz y la matrícula es 1234 FGH, un Golf.", sec: 58 },
      { role: "assistant", text: "Perfecto Javier. Cambio de aceite el jueves a las diez de la mañana para el Golf 1234 FGH. ¿Lo confirmamos?", sec: 72 },
      { role: "user", text: "Sí, perfecto.", sec: 80 },
      { role: "assistant", text: "Hecho. Te esperamos el jueves a las diez. ¡Hasta luego, Javier!", sec: 95 },
    ];

    let order = 1;
    for (const msg of messages) {
      await client.query(
        `INSERT INTO call_messages (business_id, call_id, role, content, seconds_from_start, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [businessId, callId, msg.role, msg.text, msg.sec, order++]
      );
    }

    // 10. Citas de ejemplo (Appointments)
    console.log("📅 Creando citas de demostración en agenda...");
    const serviceAceiteId = serviceMap.get("Cambio de aceite y filtro");
    const servicePreItvId = serviceMap.get("Revisión pre-ITV completa");

    // Cita 1: Próximo jueves a las 10:00 (derivada de la llamada)
    await client.query(
      `INSERT INTO appointments (
         business_id, contact_id, call_id, service_id, service_name,
         starts_at, ends_at, status, notes, created_via
       ) VALUES (
         $1, $2, $3, $4, 'Cambio de aceite y filtro',
         date_trunc('day', now() + interval '2 days') + interval '10 hours',
         date_trunc('day', now() + interval '2 days') + interval '11 hours',
         'agendada', 'Volkswagen Golf 1234FGH. Agendada por agente de voz.', 'agente_voz'
       )`,
      [businessId, javierId, callId, serviceAceiteId]
    );

    // Cita 2: Mañana a las 11:30 (Elena Martín, creada por panel)
    const elenaId = contactMap.get("Elena Martín Soria");
    await client.query(
      `INSERT INTO appointments (
         business_id, contact_id, call_id, service_id, service_name,
         starts_at, ends_at, status, notes, created_via
       ) VALUES (
         $1, $2, NULL, $3, 'Revisión pre-ITV completa',
         date_trunc('day', now() + interval '1 day') + interval '11 hours 30 minutes',
         date_trunc('day', now() + interval '1 day') + interval '13 hours',
         'confirmada', 'Toyota Yaris 5678LMN. Revisar estado de neumáticos.', 'panel'
       )`,
      [businessId, elenaId, servicePreItvId]
    );

    await client.query("COMMIT");
    console.log("✨ ¡Semillero completado con éxito!");
    console.log("📋 Credenciales de demostración:");
    console.log("   - Email: demo@taller.es");
    console.log("   - Contraseña: demo1234");
    console.log("   - Negocio: Agente Taller (agente-taller)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error durante el semillero:", err);
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
