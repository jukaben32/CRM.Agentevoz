"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import {
  businesses,
  voiceAgents,
  services,
  businessHours,
  closures,
  businessFacts,
  vapiTools,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getEffectivePrompt, composeSystemPrompt } from "@/lib/vapi/prompt";
import { env } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";

/**
 * Server Action: Guardar información del negocio y personalidad del agente
 */
export async function saveBusinessAndAgentAction(data: {
  name: string;
  timezone: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  tone: string;
  firstMessage: string;
  handoffNumber?: string;
  handoffMessage: string;
  slotCapacity: number;
  minNoticeMinutes: number;
  bookingHorizonDays: number;
  promptOverride?: string | null;
}) {
  const session = await requireSession();

  await withTenant(session.businessId, async (tx) => {
    // 1. Actualizar negocio
    await tx
      .update(businesses)
      .set({
        name: data.name.trim(),
        timezone: data.timezone,
        phone: normalizePhone(data.phone) || data.phone || null,
        email: data.email || null,
        website: data.website || null,
        address: data.address || null,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, session.businessId));

    // 2. Actualizar configuración del agente
    const promptOverrideVal =
      data.promptOverride && data.promptOverride.trim().length > 0
        ? data.promptOverride.trim()
        : null;

    await tx
      .update(voiceAgents)
      .set({
        tone: data.tone,
        firstMessage: data.firstMessage,
        handoffNumber: normalizePhone(data.handoffNumber) || data.handoffNumber || null,
        handoffMessage: data.handoffMessage,
        slotCapacity: data.slotCapacity || 1,
        minNoticeMinutes: data.minNoticeMinutes || 60,
        bookingHorizonDays: data.bookingHorizonDays || 14,
        systemPromptOverride: promptOverrideVal,
        updatedAt: new Date(),
      })
      .where(eq(voiceAgents.businessId, session.businessId));
  });

  revalidatePath("/estudio");
  revalidatePath("/");
  return { success: true };
}

/**
 * Server Action: Guardar selección de modelos del agente (STT, LLM, TTS)
 */
export async function saveAgentModelsAction(data: {
  transcriber: { provider: string; model?: string; language?: string };
  model: { provider: string; model?: string };
  voice: { provider: string; voiceId?: string; model?: string; language?: string };
}) {
  const session = await requireSession();

  await withTenant(session.businessId, async (tx) => {
    await tx
      .update(voiceAgents)
      .set({
        transcriber: data.transcriber,
        model: data.model,
        voiceProvider: data.voice.provider,
        voiceId: data.voice.voiceId || "UOIqAnmS11Reiei1Ytkc",
        voiceModel: data.voice.model || null,
        voiceLanguage: data.voice.language || "es",
        updatedAt: new Date(),
      })
      .where(eq(voiceAgents.businessId, session.businessId));
  });

  revalidatePath("/estudio");
  return { success: true };
}

/**
 * Server Action: Guardar o actualizar un servicio del taller
 */
export async function saveServiceAction(data: {
  id?: string;
  name: string;
  durationMinutes: number;
  priceCents?: number | null;
  description?: string;
  isActive: boolean;
  sortOrder?: number;
}) {
  const session = await requireSession();

  await withTenant(session.businessId, async (tx) => {
    if (data.id) {
      await tx
        .update(services)
        .set({
          name: data.name,
          durationMinutes: data.durationMinutes,
          priceCents: data.priceCents,
          description: data.description || null,
          isActive: data.isActive,
          sortOrder: data.sortOrder || 0,
          updatedAt: new Date(),
        })
        .where(and(eq(services.businessId, session.businessId), eq(services.id, data.id)));
    } else {
      await tx.insert(services).values({
        businessId: session.businessId,
        name: data.name,
        durationMinutes: data.durationMinutes,
        priceCents: data.priceCents,
        description: data.description || null,
        isActive: data.isActive,
        sortOrder: data.sortOrder || 0,
      });
    }
  });

  revalidatePath("/estudio");
  return { success: true };
}

/**
 * Server Action: Guardar o actualizar una pregunta frecuente (business_facts)
 */
export async function saveBusinessFactAction(data: {
  id?: string;
  question: string;
  answer: string;
}) {
  const session = await requireSession();

  await withTenant(session.businessId, async (tx) => {
    if (data.id) {
      await tx
        .update(businessFacts)
        .set({
          question: data.question,
          answer: data.answer,
        })
        .where(and(eq(businessFacts.businessId, session.businessId), eq(businessFacts.id, data.id)));
    } else {
      await tx.insert(businessFacts).values({
        businessId: session.businessId,
        question: data.question,
        answer: data.answer,
      });
    }
  });

  revalidatePath("/estudio");
  return { success: true };
}

/**
 * Server Action: Eliminar un servicio o FAQ
 */
export async function deleteItemAction(type: "service" | "fact", id: string) {
  const session = await requireSession();

  await withTenant(session.businessId, async (tx) => {
    if (type === "service") {
      await tx
        .delete(services)
        .where(and(eq(services.businessId, session.businessId), eq(services.id, id)));
    } else {
      await tx
        .delete(businessFacts)
        .where(and(eq(businessFacts.businessId, session.businessId), eq(businessFacts.id, id)));
    }
  });

  revalidatePath("/estudio");
  return { success: true };
}

/**
 * Server Action: PUBLICAR en VAPI
 * Compone el payload final del asistente, sincroniza con VAPI vía REST (assistants.create / assistants.update)
 * y actualiza los IDs y fecha de publicación.
 */
export async function publishAgentToVapi() {
  const session = await requireSession();

  if (!env.VAPI_API_KEY) {
    throw new Error(
      "VAPI_API_KEY no está configurada en el archivo .env del servidor. No se puede publicar en VAPI."
    );
  }

  const result = await withTenant(session.businessId, async (tx) => {
    // 1. Cargar datos completos del negocio
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, session.businessId))
      .limit(1);

    const [agent] = await tx
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.businessId, session.businessId))
      .limit(1);

    const hours = await tx
      .select()
      .from(businessHours)
      .where(eq(businessHours.businessId, session.businessId));

    const srvs = await tx
      .select()
      .from(services)
      .where(eq(services.businessId, session.businessId));

    const facts = await tx
      .select()
      .from(businessFacts)
      .where(eq(businessFacts.businessId, session.businessId));

    // 2. Obtener tools compartidas activas
    const sharedTools = await tx.select().from(vapiTools);
    const toolIds = sharedTools.map((t) => t.vapiToolId);

    // 3. Componer prompt efectivo
    const { prompt: effectivePrompt } = getEffectivePrompt({
      business,
      agent,
      hours,
      services: srvs,
      facts,
    });

    // 4. Construir payload para VAPI
    const webhookUrl = `${env.APP_URL}/api/vapi/webhook`;
    const serverConfig: Record<string, any> = { url: webhookUrl };
    if (env.VAPI_SERVER_CREDENTIAL_ID) {
      serverConfig.credentialId = env.VAPI_SERVER_CREDENTIAL_ID;
    }

    const transcriberPayload: any = {
      provider: (agent.transcriber as any)?.provider || "deepgram",
      language: (agent.transcriber as any)?.language || "es",
    };
    if ((agent.transcriber as any)?.model) {
      transcriberPayload.model = (agent.transcriber as any).model;
    }

    const modelPayload: any = {
      provider: (agent.model as any)?.provider || "openai",
      model: (agent.model as any)?.model || "gpt-4.1-mini",
      toolIds,
      // Tool nativo endCall: sin él la llamada nunca cuelga sola tras la
      // despedida y sigue consumiendo minutos hasta maxDurationSeconds.
      tools: [
        {
          type: "endCall",
          function: {
            name: "end_completed_call",
            description:
              "Cuelga la llamada. Úsala solo después de haber confirmado que el objetivo de la llamada está resuelto (cita gestionada o consulta respondida) y de haberte despedido explícitamente. No la uses solo porque el cliente calla o hay una pausa.",
          },
        },
      ],
      messages: [{ role: "system", content: effectivePrompt }],
    };

    const voicePayload: any = {
      provider: agent.voiceProvider || "11labs",
      voiceId: agent.voiceId || "UOIqAnmS11Reiei1Ytkc",
    };
    if (agent.voiceModel) voicePayload.model = agent.voiceModel;
    if (agent.voiceLanguage) voicePayload.language = agent.voiceLanguage;

    const assistantPayload = {
      name: business.name.slice(0, 40), // Máximo 40 caracteres exigido por VAPI
      firstMessage: agent.firstMessage,
      transcriber: transcriberPayload,
      model: modelPayload,
      voice: voicePayload,
      server: serverConfig,
      serverMessages: ["tool-calls", "end-of-call-report", "status-update"],
      analysisPlan: {
        summaryPlan: {
          enabled: true, // OBLIGATORIO: enabled: true para generar resúmenes (§14.1)
          messages: [
            {
              role: "system",
              content:
                "Resume la llamada indicando el motivo principal, si se solicitó o cerró cita (con fecha y servicio), datos del vehículo si los facilitó y si quedó alguna acción pendiente.",
            },
          ],
        },
      },
      endCallMessage: "Gracias por llamar a " + business.name + ". ¡Hasta pronto!",
      maxDurationSeconds: 600, // 10 minutos máximo
    };

    let vapiAssistantId = agent.vapiAssistantId;

    if (vapiAssistantId) {
      // Actualizar asistente existente
      const res = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assistantPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error de VAPI al actualizar asistente (${res.status}): ${errText}`);
      }
    } else {
      // Crear nuevo asistente en VAPI
      const res = await fetch("https://api.vapi.ai/assistant", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(assistantPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error de VAPI al crear asistente (${res.status}): ${errText}`);
      }

      const created = await res.json();
      vapiAssistantId = created.id;
    }

    // 5. Vincular número de teléfono si existe
    if (vapiAssistantId && agent.vapiPhoneNumberId) {
      try {
        await fetch(`https://api.vapi.ai/phone-number/${agent.vapiPhoneNumberId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ assistantId: vapiAssistantId }),
        });
      } catch (err) {
        console.warn("No se pudo vincular automáticamente el número de teléfono:", err);
      }
    }

    // 6. Actualizar registro en voice_agents
    await tx
      .update(voiceAgents)
      .set({
        systemPrompt: effectivePrompt,
        vapiAssistantId,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(voiceAgents.businessId, session.businessId));

    return {
      success: true,
      assistantId: vapiAssistantId,
      publishedAt: new Date().toISOString(),
    };
  });

  revalidatePath("/estudio");
  revalidatePath("/conexiones");
  revalidatePath("/");
  return result;
}
