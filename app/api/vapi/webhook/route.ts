import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { pool } from "@/lib/db";
import { withTenant, withoutTenant } from "@/lib/db/tenant";
import {
  calls,
  callMessages,
  webhookEvents,
  contacts,
  contactNotes,
  businesses,
  businessHours,
  services,
  businessFacts,
  voiceAgents,
  appointments,
} from "@/lib/db/schema";
import { eq, and, gte, ne, desc } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { getAvailableSlots } from "@/lib/scheduling/availability";
import {
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
} from "@/lib/scheduling/booking";
import { env } from "@/lib/env";

/**
 * Verificación segura de token Bearer con timingSafeEqual
 */
function verifyBearerToken(req: NextRequest): boolean {
  const expectedToken = env.VAPI_WEBHOOK_TOKEN;
  if (!expectedToken) return true; // Si no hay token configurado en local, permitir

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const providedToken = authHeader.slice(7).trim();

  // Normalizar mediante hash para comparar buffers de idéntica longitud de forma segura
  const expectedHash = crypto.createHash("sha256").update(expectedToken).digest();
  const providedHash = crypto.createHash("sha256").update(providedToken).digest();

  return crypto.timingSafeEqual(expectedHash, providedHash);
}

/**
 * Extractor universal de nombre de herramienta y argumentos JSON (§9.4)
 */
export function extractToolCallDetails(tc: any): { name: string | null; args: Record<string, any> } {
  const name = tc.function?.name ?? tc.name ?? null;
  let args = tc.function?.arguments ?? tc.parameters ?? tc.arguments ?? {};

  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      args = {};
    }
  }

  return { name, args };
}

export async function POST(req: NextRequest) {
  // 1. Verificación de autenticidad del webhook
  if (!verifyBearerToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message || body;
  const messageType = message.type;
  const vapiCall = message.call || {};
  const vapiCallId = vapiCall.id || message.callId || `evt_${Date.now()}`;

  // 2. Resolución del Negocio (Inquilino)
  const assistantId = vapiCall.assistantId || message.assistantId;
  const phoneNumberId = vapiCall.phoneNumberId || message.phoneNumberId;
  const metadataBusinessId = vapiCall.metadata?.businessId;

  let businessId: string | null = metadataBusinessId || null;

  if (!businessId) {
    const client = await pool.connect();
    try {
      if (assistantId) {
        const { rows } = await client.query<{ business_id: string }>(
          "SELECT business_id FROM voice_agents WHERE vapi_assistant_id = $1 LIMIT 1",
          [assistantId]
        );
        if (rows.length > 0) businessId = rows[0].business_id;
      }
      if (!businessId && phoneNumberId) {
        const { rows } = await client.query<{ business_id: string }>(
          "SELECT business_id FROM voice_agents WHERE vapi_phone_number_id = $1 LIMIT 1",
          [phoneNumberId]
        );
        if (rows.length > 0) businessId = rows[0].business_id;
      }
    } finally {
      client.release();
    }
  }

  // Si no se encuentra el negocio y es un evento que no requiere BD, responder 200
  if (!businessId) {
    if (messageType === "tool-calls") {
      return NextResponse.json(
        { error: "No se pudo identificar el negocio asignado a este asistente" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, notice: "Unmatched business" });
  }

  // 3. Registro de auditoría del evento
  const externalEventId = `${vapiCallId}_${messageType}_${Date.now()}`;
  try {
    await withoutTenant(async (db) => {
      await db.insert(webhookEvents).values({
        businessId,
        provider: "vapi",
        eventType: messageType || "unknown",
        externalId: externalEventId,
        payload: body,
      });
    });
  } catch {
    // Ignorar duplicados en auditoría
  }

  const callerPhone = normalizePhone(vapiCall.customer?.number);

  // 4. Despacho según tipo de evento

  // ─────────────────────────────────────────────────────────────
  // A. TOOL CALLS (Invocación de herramientas)
  // ─────────────────────────────────────────────────────────────
  if (messageType === "tool-calls") {
    const toolCallList = message.toolCallList || [];
    const results: Array<{ toolCallId: string; result: string }> = [];

    await withTenant(businessId, async (tx) => {
      for (const tc of toolCallList) {
        const toolCallId = tc.id;
        const { name: toolName, args } = extractToolCallDetails(tc);

        if (!toolName) {
          results.push({ toolCallId, result: "Herramienta no especificada." });
          continue;
        }

        try {
          switch (toolName) {
            case "identificarLlamante": {
              if (!callerPhone) {
                results.push({
                  toolCallId,
                  result: "No se reconoce el número de teléfono del llamante.",
                });
                break;
              }

              const [contact] = await tx
                .select()
                .from(contacts)
                .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, callerPhone)))
                .limit(1);

              if (contact) {
                // Buscar si tiene próxima cita
                const [nextApp] = await tx
                  .select()
                  .from(appointments)
                  .where(
                    and(
                      eq(appointments.businessId, businessId),
                      eq(appointments.contactId, contact.id),
                      gte(appointments.startsAt, new Date()),
                      ne(appointments.status, "anulada")
                    )
                  )
                  .orderBy(appointments.startsAt)
                  .limit(1);

                let info = `Cliente fichado: ${contact.fullName}.`;
                if (nextApp) {
                  info += ` Tiene una cita próxima para ${nextApp.serviceName}.`;
                }
                results.push({ toolCallId, result: info });
              } else {
                results.push({
                  toolCallId,
                  result: "Cliente nuevo no registrado previamente.",
                });
              }
              break;
            }

            case "consultarHuecos": {
              const slots = await getAvailableSlots(tx, businessId, {
                serviceName: args.servicio,
                preferredDateIso: args.fechaPreferida,
                shift: args.franja,
                daysAhead: args.diasVista || 7,
                maxOptions: 3,
              });

              if (slots.length === 0) {
                results.push({
                  toolCallId,
                  result: "No hay huecos disponibles en esas fechas. Sugiere consultar otros días u horarios.",
                });
              } else {
                const opcionesTexto = slots.map((s) => s.textoHablado).join(", o ");
                results.push({
                  toolCallId,
                  result: `Tengo los siguientes huecos disponibles: ${opcionesTexto}.`,
                });
              }
              break;
            }

            case "reservarCita": {
              const res = await bookAppointment(tx, {
                businessId,
                callerPhone,
                customerName: args.nombre,
                customerEmail: args.email,
                serviceName: args.servicio,
                startIso: args.inicioIso,
                notes: args.notas,
                extraData: args.datosExtra,
                callId: vapiCallId,
              });

              results.push({ toolCallId, result: res.message });
              break;
            }

            case "reprogramarCita": {
              const res = await rescheduleAppointment(
                tx,
                businessId,
                callerPhone,
                args.nuevoInicioIso,
                args.citaId
              );
              results.push({ toolCallId, result: res.message });
              break;
            }

            case "anularCita": {
              const res = await cancelAppointment(
                tx,
                businessId,
                callerPhone,
                args.citaId,
                args.motivo
              );
              results.push({ toolCallId, result: res.message });
              break;
            }

            case "datosDelNegocio": {
              const [business] = await tx
                .select()
                .from(businesses)
                .where(eq(businesses.id, businessId))
                .limit(1);

              const factsList = await tx
                .select()
                .from(businessFacts)
                .where(eq(businessFacts.businessId, businessId));

              const servicesList = await tx
                .select()
                .from(services)
                .where(and(eq(services.businessId, businessId), eq(services.isActive, true)));

              const factsText = factsList.map((f) => `${f.question}: ${f.answer}`).join(". ");
              const srvText = servicesList
                .map((s) => `${s.name} (${s.durationMinutes} min, ${s.priceCents ? s.priceCents / 100 + "€" : "consultar"})`)
                .join(", ");

              const info = `Dirección: ${business?.address || "No especificada"}. Servicios: ${srvText}. Preguntas frecuentes: ${factsText}`;
              results.push({ toolCallId, result: info });
              break;
            }

            case "registrarHandoff": {
              const motivo = args.motivo || "Solicitud de hablar con personal humano";
              if (callerPhone) {
                const [contact] = await tx
                  .select()
                  .from(contacts)
                  .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, callerPhone)))
                  .limit(1);

                if (contact) {
                  await tx.insert(contactNotes).values({
                    businessId,
                    contactId: contact.id,
                    body: `Atención manual requerida: ${motivo}`,
                    authorUserId: null,
                  });
                }
              }

              await tx
                .update(calls)
                .set({ needsReview: true })
                .where(and(eq(calls.businessId, businessId), eq(calls.vapiCallId, vapiCallId)));

              results.push({
                toolCallId,
                result: "Se ha anotado la solicitud de transferencia o atención manual.",
              });
              break;
            }

            default:
              results.push({
                toolCallId,
                result: `Herramienta ${toolName} ejecutada con éxito.`,
              });
          }
        } catch (err: any) {
          console.error(`Error ejecutando tool ${toolName}:`, err);
          results.push({
            toolCallId,
            result: "No se pudo completar la operación en la agenda en este momento.",
          });
        }
      }
    });

    return NextResponse.json({ results });
  }

  // ─────────────────────────────────────────────────────────────
  // B. END-OF-CALL-REPORT (Informe final de fin de llamada)
  // ─────────────────────────────────────────────────────────────
  if (messageType === "end-of-call-report") {
    const analysis = message.analysis || {};
    const artifact = message.artifact || {};

    const summary = analysis.summary || artifact.summary || null;
    const recordingUrl = artifact.recordingUrl || vapiCall.recordingUrl || null;
    const endedReason = message.endedReason || vapiCall.endedReason || null;
    const costCents = Math.round((message.cost || vapiCall.cost || 0) * 100);
    const durationSeconds =
      message.durationSeconds ||
      vapiCall.durationSeconds ||
      (message.startedAt && message.endedAt
        ? Math.round((new Date(message.endedAt).getTime() - new Date(message.startedAt).getTime()) / 1000)
        : null);

    const startedAt = message.startedAt ? new Date(message.startedAt) : new Date();
    const endedAt = message.endedAt ? new Date(message.endedAt) : new Date();

    await withTenant(businessId, async (tx) => {
      // Localizar o asociar contacto
      let contactId: string | null = null;
      if (callerPhone) {
        const [contact] = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, callerPhone)))
          .limit(1);
        if (contact) contactId = contact.id;
      }

      // Upsert de la llamada
      const [existingCall] = await tx
        .select({ id: calls.id })
        .from(calls)
        .where(and(eq(calls.businessId, businessId), eq(calls.vapiCallId, vapiCallId)))
        .limit(1);

      let savedCallId: string;
      if (existingCall) {
        savedCallId = existingCall.id;
        await tx
          .update(calls)
          .set({
            contactId: contactId || undefined,
            status: "ended",
            startedAt,
            endedAt,
            durationSeconds,
            summary,
            costCents,
            recordingUrl,
            endedReason,
          })
          .where(eq(calls.id, existingCall.id));
      } else {
        const [newCall] = await tx
          .insert(calls)
          .values({
            businessId,
            contactId,
            vapiCallId,
            direction: vapiCall.type === "outboundPhoneCall" ? "outbound" : "inbound",
            fromNumber: callerPhone,
            startedAt,
            endedAt,
            durationSeconds,
            status: "ended",
            endedReason,
            summary,
            costCents,
            recordingUrl,
          })
          .returning();
        savedCallId = newCall.id;
      }

      // Procesar y guardar la transcripción turno a turno (§14.1)
      const rawMessages: any[] = artifact.messages || [];
      if (rawMessages.length > 0) {
        // Eliminar mensajes previos si es un reprocesado
        await tx
          .delete(callMessages)
          .where(and(eq(callMessages.businessId, businessId), eq(callMessages.callId, savedCallId)));

        let order = 1;
        for (const m of rawMessages) {
          // Mapeo estricto de roles (§14.1):
          // bot -> assistant
          // user -> user
          // system -> NO GUARDAR
          // tool_calls / tool_call_result -> tool
          let mappedRole: "assistant" | "user" | "tool" | null = null;
          let content = m.message || m.content || m.result || "";

          if (m.role === "bot") {
            mappedRole = "assistant";
          } else if (m.role === "user") {
            mappedRole = "user";
          } else if (m.role === "tool_calls" || m.role === "tool_call_result") {
            mappedRole = "tool";
            if (!content && m.toolCalls) {
              content = JSON.stringify(m.toolCalls);
            }
          } else if (m.role === "system") {
            // Se descarta el system prompt para no contaminar la conversación
            continue;
          }

          if (mappedRole && content && typeof content === "string") {
            await tx.insert(callMessages).values({
              businessId,
              callId: savedCallId,
              role: mappedRole,
              content: content.trim(),
              secondsFromStart: m.secondsFromStart || null,
              sortOrder: order++,
            });
          }
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  // ─────────────────────────────────────────────────────────────
  // C. STATUS-UPDATE (Actualización de estado de llamada)
  // ─────────────────────────────────────────────────────────────
  if (messageType === "status-update") {
    const rawStatus = message.status || vapiCall.status || "in-progress";
    // 6 estados válidos de VAPI: scheduled, queued, ringing, in-progress, forwarding, ended
    const validStatuses = ["scheduled", "queued", "ringing", "in-progress", "forwarding", "ended"] as const;
    const status = validStatuses.includes(rawStatus) ? rawStatus : "in-progress";

    await withTenant(businessId, async (tx) => {
      const [existing] = await tx
        .select({ id: calls.id })
        .from(calls)
        .where(and(eq(calls.businessId, businessId), eq(calls.vapiCallId, vapiCallId)))
        .limit(1);

      if (existing) {
        await tx
          .update(calls)
          .set({ status })
          .where(eq(calls.id, existing.id));
      } else {
        await tx.insert(calls).values({
          businessId,
          vapiCallId,
          direction: vapiCall.type === "outboundPhoneCall" ? "outbound" : "inbound",
          fromNumber: callerPhone,
          status,
          startedAt: new Date(),
        });
      }
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
