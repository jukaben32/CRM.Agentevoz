import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { getEffectivePrompt } from "../lib/vapi/prompt";

describe("Procesamiento de Payloads y Prompt de VAPI", () => {
  it("debe ensamblar el prompt efectivo en español con servicios y horarios", () => {
    const business: any = {
      name: "Taller Hermanos Pérez",
      phone: "+34910000000",
      address: "Calle Alcalá 120, Madrid",
      timezone: "Europe/Madrid",
    };

    const agent: any = {
      tone: "cercano y resolutivo",
      handoffNumber: "+34910000001",
      handoffMessage: "Te paso con el jefe de taller.",
    };

    const hours: any[] = [
      { weekday: 1, opensAt: "08:30:00", closesAt: "19:00:00", isClosed: false },
      { weekday: 0, opensAt: "00:00:00", closesAt: "00:00:00", isClosed: true },
    ];

    const services: any[] = [
      { name: "Cambio de aceite y filtro", durationMinutes: 45, priceCents: 8500, description: "Sintético 5W30", isActive: true },
    ];

    const facts: any[] = [
      { question: "¿Tenéis coche de sustitución?", answer: "Sí, disponemos de 2 vehículos bajo reserva previa." },
    ];

    const { prompt, isOverride } = getEffectivePrompt({
      business,
      agent,
      hours,
      services,
      facts,
    });

    assert.equal(isOverride, false);
    assert.match(prompt, /Taller Hermanos Pérez/);
    assert.match(prompt, /Calle Alcalá 120, Madrid/);
    assert.match(prompt, /Cambio de aceite y filtro/);
    assert.match(prompt, /coche de sustitución/);
    assert.match(prompt, /cercano y resolutivo/);
  });

  it("debe validar tokens con timingSafeEqual correctamente", () => {
    const secret = "vapi_secret_token_123456789";
    const headerValid = "Bearer vapi_secret_token_123456789";
    const headerInvalid = "Bearer vapi_wrong_token";

    const verifyToken = (header: string, expected: string): boolean => {
      const provided = header.replace(/^Bearer\s+/i, "");
      if (provided.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    };

    assert.equal(verifyToken(headerValid, secret), true);
    assert.equal(verifyToken(headerInvalid, secret), false);
  });

  it("debe mapear el rol bot de VAPI a assistant", () => {
    const mapRole = (vapiRole: string): "assistant" | "user" | "tool" | "discard" => {
      if (vapiRole === "bot" || vapiRole === "assistant") return "assistant";
      if (vapiRole === "user") return "user";
      if (vapiRole === "tool" || vapiRole === "tool_calls") return "tool";
      return "discard";
    };

    assert.equal(mapRole("bot"), "assistant");
    assert.equal(mapRole("user"), "user");
    assert.equal(mapRole("tool"), "tool");
    assert.equal(mapRole("system"), "discard");
  });
});
