import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";
import { env } from "@/lib/env";

/**
 * Normaliza cualquier número de teléfono a formato estándar internacional E.164 (+34600123456)
 * Es la base fundamental para evitar duplicación de contactos en el CRM.
 */
export function normalizePhone(
  rawPhone?: string | null,
  defaultCountry: CountryCode = (env.DEFAULT_COUNTRY_CODE as CountryCode) || "ES"
): string | null {
  if (!rawPhone || !rawPhone.trim()) return null;

  const clean = rawPhone.trim();
  const parsed = parsePhoneNumberFromString(clean, defaultCountry);

  if (parsed && parsed.isValid()) {
    return parsed.number; // E.164 p.ej. +34612345678
  }

  // Fallback para números semi-válidos o nacionales
  const digitsOnly = clean.replace(/[^0-9+]/g, "");
  if (digitsOnly.startsWith("+")) {
    return digitsOnly;
  }
  if (digitsOnly.length === 9 && defaultCountry === "ES") {
    return `+34${digitsOnly}`;
  }

  return clean;
}

/**
 * Formatea un número E.164 para mostrarlo de forma legible al usuario humano (+34 612 34 56 78)
 */
export function formatPhoneForDisplay(phone?: string | null): string {
  if (!phone) return "—";
  const parsed = parsePhoneNumberFromString(phone);
  if (parsed && parsed.isValid()) {
    return parsed.formatInternational();
  }
  return phone;
}
