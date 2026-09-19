import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatAppointmentStatus,
  appointmentBadgeClasses,
  formatContactStatus,
  contactBadgeClasses,
  formatContactSource,
  formatRole,
  roleBadgeClasses,
  formatCallStatus,
  callBadgeClasses,
  formatEndedReason,
} from "../lib/labels";

describe("Labels y Diccionario de Traducciones en Español", () => {
  it("debe formatear los estados de citas correctamente", () => {
    assert.equal(formatAppointmentStatus("agendada"), "Agendada");
    assert.equal(formatAppointmentStatus("confirmada"), "Confirmada");
    assert.equal(formatAppointmentStatus("completada"), "Completada");
    assert.equal(formatAppointmentStatus("anulada"), "Anulada");
    assert.equal(formatAppointmentStatus("no_show"), "No presentado");
    assert.equal(formatAppointmentStatus("otro_desconocido"), "otro_desconocido");
  });

  it("debe asignar clases de badges pastel para citas", () => {
    assert.match(appointmentBadgeClasses("confirmada"), /emerald/);
    assert.match(appointmentBadgeClasses("anulada"), /red/);
    assert.match(appointmentBadgeClasses("agendada"), /blue/);
  });

  it("debe formatear los estados de contactos", () => {
    assert.equal(formatContactStatus("lead"), "Lead");
    assert.equal(formatContactStatus("cliente"), "Cliente");
    assert.equal(formatContactStatus("inactivo"), "Inactivo");
  });

  it("debe formatear los orígenes de contactos", () => {
    assert.equal(formatContactSource("agente_voz"), "Agente de voz");
    assert.equal(formatContactSource("manual"), "Manual");
    assert.equal(formatContactSource("importado"), "Importado");
  });

  it("debe formatear los roles de usuario", () => {
    assert.equal(formatRole("owner"), "Propietario");
    assert.equal(formatRole("staff"), "Personal");
  });

  it("debe formatear los motivos de finalización de llamadas VAPI", () => {
    assert.equal(
      formatEndedReason("assistant-ended-call"),
      "El asistente completó y finalizó la llamada"
    );
    assert.equal(
      formatEndedReason("customer-hung-up"),
      "El cliente colgó la llamada"
    );
    assert.equal(
      formatEndedReason("silence-timed-out"),
      "Llamada finalizada por inactividad o silencio prolongado"
    );
  });
});
