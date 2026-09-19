/**
 * Diccionario centralizado y tipado de etiquetas legibles en español (§12).
 * NINGÚN valor interno crudo (estados de VAPI, roles, estados de cita) se pinta directamente en la UI.
 */

export type CallStatus = "scheduled" | "queued" | "ringing" | "in-progress" | "forwarding" | "ended";
export type AppointmentStatus = "agendada" | "confirmada" | "completada" | "anulada" | "no_show";
export type ContactStatus = "lead" | "cliente" | "inactivo";
export type ContactSource = "agente_voz" | "manual" | "importado";
export type UserRole = "owner" | "staff";
export type CallDirection = "inbound" | "outbound";
export type CreatedVia = "agente_voz" | "panel";

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  scheduled: "Programada",
  queued: "En cola",
  ringing: "Sonando",
  "in-progress": "En curso",
  forwarding: "Transfiriendo",
  ended: "Finalizada",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  completada: "Completada",
  anulada: "Anulada",
  no_show: "No presentado",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  lead: "Lead",
  cliente: "Cliente",
  inactivo: "Inactivo",
};

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  agente_voz: "Agente de voz",
  manual: "Manual",
  importado: "Importado",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: "Propietario",
  staff: "Personal",
};

export const CALL_DIRECTION_LABELS: Record<CallDirection, string> = {
  inbound: "Entrante",
  outbound: "Saliente",
};

export const CREATED_VIA_LABELS: Record<CreatedVia, string> = {
  agente_voz: "Agente de voz",
  panel: "Panel de control",
};

export function formatAppointmentStatus(status: string): string {
  return APPOINTMENT_STATUS_LABELS[status as AppointmentStatus] || status;
}

export function appointmentBadgeClasses(status: string): string {
  switch (status) {
    case "confirmada":
    case "completada":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "agendada":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "anulada":
    case "no_show":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

export function formatContactStatus(status: string): string {
  return CONTACT_STATUS_LABELS[status as ContactStatus] || status;
}

export function contactBadgeClasses(status: string): string {
  switch (status) {
    case "cliente":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "lead":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "inactivo":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

export function formatContactSource(source: string): string {
  return CONTACT_SOURCE_LABELS[source as ContactSource] || source;
}

export function formatRole(role: string): string {
  return USER_ROLE_LABELS[role as UserRole] || role;
}

export function roleBadgeClasses(role: string): string {
  switch (role) {
    case "owner":
      return "bg-[#E8490C]/10 text-[#E8490C] border border-[#E8490C]/20";
    case "staff":
      return "bg-zinc-100 text-zinc-700 border border-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-700 border border-zinc-200";
  }
}

export function formatCallStatus(status: string): string {
  return CALL_STATUS_LABELS[status as CallStatus] || status;
}

export function callBadgeClasses(status: string): string {
  switch (status) {
    case "in-progress":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "forwarding":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "ended":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

/**
 * Traduce los códigos de motivo de fin de llamada de VAPI (endedReason) a frases claras
 */
export function formatEndedReason(rawReason?: string | null): string {
  if (!rawReason) return "Llamada finalizada normalmente";

  const r = rawReason.toLowerCase();

  const knownMap: Record<string, string> = {
    "customer-ended-call": "El cliente colgó la llamada",
    "customer-hung-up": "El cliente colgó la llamada",
    "assistant-ended-call": "El asistente completó y finalizó la llamada",
    "customer-did-not-answer": "El cliente no respondió",
    "customer-busy": "Línea ocupada",
    "silence-timed-out": "Llamada finalizada por inactividad o silencio prolongado",
    "max-duration-reached": "Llegó al tiempo máximo configurado",
    "assistant-forwarded-call": "Llamada transferida a una persona",
    "assistant-say-first-message-failed": "Fallo al emitir mensaje inicial",
    "voicemail": "Saltó el buzón de voz",
  };

  if (knownMap[r]) {
    return knownMap[r];
  }

  if (r.includes("error") || r.includes("failed")) {
    return "Incidencia técnica durante la llamada";
  }

  if (r.includes("twilio") || r.includes("vonage") || r.includes("telnyx") || r.includes("sip")) {
    return "Incidencia de la operadora de telefonía";
  }

  return "Finalizada";
}

/**
 * Devuelve el estilo de color pastel para distintivos (badges) según el estado
 */
export function getStatusBadgeStyle(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case "confirmada":
    case "completada":
    case "cliente":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-800",
      };
    case "agendada":
    case "in-progress":
    case "ringing":
    case "lead":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/40",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-800",
      };
    case "anulada":
    case "no_show":
    case "inactivo":
      return {
        bg: "bg-rose-50 dark:bg-rose-950/40",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-200 dark:border-rose-800",
      };
    case "forwarding":
    case "agente_voz":
      return {
        bg: "bg-orange-50 dark:bg-orange-950/40",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-200 dark:border-orange-800",
      };
    default:
      return {
        bg: "bg-zinc-100 dark:bg-zinc-800/60",
        text: "text-zinc-700 dark:text-zinc-300",
        border: "border-zinc-200 dark:border-zinc-700",
      };
  }
}
