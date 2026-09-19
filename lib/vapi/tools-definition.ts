import crypto from "crypto";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  messages?: Array<{
    type: "request-start" | "request-failed" | "request-response-delayed";
    content: string;
    timingMilliseconds?: number;
  }>;
}

/**
 * Catálogo de las 7 herramientas de tipo función que resuelven contra nuestro webhook
 * Cumplen con la regla de oro §9.1: NUNCA piden el teléfono del llamante ni el ID de negocio al modelo.
 */
export const SHARED_FUNCTION_TOOLS: ToolDefinition[] = [
  {
    name: "identificarLlamante",
    description:
      "Busca la ficha del cliente en el CRM a partir de su número de teléfono. Llámala al inicio de la llamada para saber su nombre y si tiene citas próximas.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    messages: [],
  },
  {
    name: "consultarHuecos",
    description:
      "Consulta los huecos reales disponibles en la agenda del taller según horario, duración del servicio y citas existentes. Devuelve hasta 3 opciones hablables.",
    parameters: {
      type: "object",
      properties: {
        servicio: {
          type: "string",
          description: "Nombre del servicio solicitado (ej: cambio de aceite, revision pre-ITV, frenos).",
        },
        fechaPreferida: {
          type: "string",
          description: "Fecha preferida por el cliente en formato ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss).",
        },
        franja: {
          type: "string",
          enum: ["manana", "tarde", "cualquiera"],
          description: "Preferencia de franja horaria: manana (antes de las 14h), tarde (desde las 14h) o cualquiera.",
        },
        diasVista: {
          type: "integer",
          description: "Número de días a evaluar en el futuro (de 1 a 30, por defecto 7).",
        },
      },
      required: [],
    },
    messages: [
      { type: "request-start", content: "Déjame mirar la agenda un segundo." },
      { type: "request-response-delayed", content: "Sigo consultando los huecos, un momento.", timingMilliseconds: 3000 },
      { type: "request-failed", content: "Ahora mismo no puedo entrar en la agenda. ¿Te parece que te llamemos nosotros?" },
    ],
  },
  {
    name: "reservarCita",
    description:
      "Reserva definitivamente una cita en la agenda e introduce o enriquece la ficha del cliente en el CRM. Llámala SOLO cuando el cliente haya confirmado explícitamente el día y la hora.",
    parameters: {
      type: "object",
      properties: {
        inicioIso: {
          type: "string",
          description: "Fecha y hora exacta de inicio de la cita en formato ISO 8601 (ej: 2026-08-20T10:00:00).",
        },
        servicio: {
          type: "string",
          description: "Nombre del servicio a realizar (ej: cambio de aceite y filtro).",
        },
        nombre: {
          type: "string",
          description: "Nombre y apellidos del cliente.",
        },
        email: {
          type: "string",
          description: "Correo electrónico del cliente si lo facilita para la confirmación.",
        },
        notas: {
          type: "string",
          description: "Observaciones o detalles de la avería/revisión.",
        },
        datosExtra: {
          type: "object",
          description: "Datos del vehículo como matrícula, marca o modelo (ej: {'matricula': '1234FGH', 'vehiculo': 'Golf'}).",
        },
      },
      required: ["inicioIso", "servicio", "nombre"],
    },
    messages: [
      { type: "request-start", content: "Un momento mientras confirmo la reserva en el sistema." },
      { type: "request-response-delayed", content: "Estoy terminando de agendarla.", timingMilliseconds: 3000 },
      { type: "request-failed", content: "Ha habido un problema al registrar la cita. Déjame tus datos y te llamamos en cuanto podamos." },
    ],
  },
  {
    name: "reprogramarCita",
    description:
      "Modifica la fecha y hora de una cita ya existente para el cliente que llama. Revalida el nuevo hueco y conserva el histórico.",
    parameters: {
      type: "object",
      properties: {
        nuevoInicioIso: {
          type: "string",
          description: "Nueva fecha y hora solicitada en formato ISO 8601.",
        },
        citaId: {
          type: "string",
          description: "ID de la cita si se conoce previamente.",
        },
      },
      required: ["nuevoInicioIso"],
    },
    messages: [
      { type: "request-start", content: "Voy a cambiar la fecha de tu cita, un segundo." },
      { type: "request-response-delayed", content: "Un momento mientras actualizo la agenda.", timingMilliseconds: 3000 },
      { type: "request-failed", content: "No consigo cambiar la cita ahora mismo. ¿Te llamamos luego?" },
    ],
  },
  {
    name: "anularCita",
    description:
      "Anula una cita futura del cliente que llama y libera el hueco en la agenda.",
    parameters: {
      type: "object",
      properties: {
        citaId: {
          type: "string",
          description: "ID de la cita a anular si se conoce.",
        },
        motivo: {
          type: "string",
          description: "Motivo por el que el cliente cancela la cita.",
        },
      },
      required: [],
    },
    messages: [
      { type: "request-start", content: "Voy a anular la cita en la agenda, un momento." },
      { type: "request-failed", content: "No he podido anular la cita en este instante. Tomo nota para avisar al taller." },
    ],
  },
  {
    name: "datosDelNegocio",
    description:
      "Consulta información del taller: dirección exacta, cómo llegar, horarios, precios orientativos, servicios o preguntas frecuentes.",
    parameters: {
      type: "object",
      properties: {
        tema: {
          type: "string",
          description: "Tema a consultar (ej: direccion, precios, garantia, vehiculo_sustitucion, horarios).",
        },
      },
      required: [],
    },
    messages: [],
  },
  {
    name: "registrarHandoff",
    description:
      "Anota en el sistema que el cliente necesita hablar con una persona del taller o que la consulta requiere atención humana.",
    parameters: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          description: "Motivo detallado por el que se transfiere o deriva la llamada.",
        },
      },
      required: ["motivo"],
    },
    messages: [],
  },
];

/**
 * Calcula un checksum SHA-256 de la definición de una herramienta para detectar cambios
 */
export function getToolChecksum(tool: ToolDefinition): string {
  const str = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    messages: tool.messages,
  });
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}
