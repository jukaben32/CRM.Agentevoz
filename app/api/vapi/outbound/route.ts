import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant";
import { voiceAgents, contacts, calls } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { contactId, reason } = body;

  if (!contactId) {
    return NextResponse.json({ error: "Falta el ID del contacto" }, { status: 400 });
  }

  let result: any = null;

  await withTenant(session.businessId, async (tx) => {
    // 1. Obtener datos del contacto y verificar consentimiento RGPD
    const [contact] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.businessId, session.businessId), eq(contacts.id, contactId)))
      .limit(1);

    if (!contact || !contact.phone) {
      throw new Error("El contacto no tiene un teléfono válido registrado.");
    }

    if (!contact.outboundConsent) {
      throw new Error(
        "El contacto no tiene marcada la casilla de consentimiento RGPD/LSSI para recibir llamadas automatizadas."
      );
    }

    // 2. Obtener asistente y número de VAPI configurados
    const [agent] = await tx
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.businessId, session.businessId))
      .limit(1);

    if (!agent || !agent.vapiAssistantId) {
      throw new Error("El asistente de voz no está provisionado o publicado en VAPI.");
    }

    if (!agent.vapiPhoneNumberId) {
      throw new Error("El asistente no tiene ningún número de teléfono vinculado en VAPI.");
    }

    if (!env.VAPI_API_KEY) {
      throw new Error("VAPI_API_KEY no está configurada en las variables de entorno.");
    }

    // 3. Crear llamada saliente en VAPI
    const res = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: agent.vapiAssistantId,
        phoneNumberId: agent.vapiPhoneNumberId,
        customer: {
          number: contact.phone,
          name: contact.fullName,
        },
        metadata: {
          businessId: session.businessId,
          contactId: contact.id,
          reason: reason || "Seguimiento o recordatorio de cita",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error de VAPI al iniciar llamada saliente (${res.status}): ${errText}`);
    }

    const vapiCallData = await res.json();

    // 4. Registrar llamada en la base de datos
    const [newCall] = await tx
      .insert(calls)
      .values({
        businessId: session.businessId,
        contactId: contact.id,
        vapiCallId: vapiCallData.id,
        direction: "outbound",
        fromNumber: contact.phone,
        status: "queued",
        startedAt: new Date(),
      })
      .returning();

    result = {
      success: true,
      callId: newCall.id,
      vapiCallId: vapiCallData.id,
    };
  });

  return NextResponse.json(result);
}
