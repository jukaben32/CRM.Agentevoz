"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { voiceAgents, vapiTools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

/**
 * Server Action: Probar ping de conectividad con el Webhook de la aplicación
 */
export async function testWebhookPingAction() {
  const webhookUrl = `${env.APP_URL}/api/health`;
  try {
    const res = await fetch(webhookUrl, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return { success: true, url: webhookUrl, data };
    }
    return { success: false, url: webhookUrl, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, url: webhookUrl, error: err.message };
  }
}

/**
 * Server Action: Re-alinear y sincronizar server.url de tools y asistente con APP_URL
 */
export async function realignServerUrlAction() {
  const session = await requireSession();

  if (!env.VAPI_API_KEY) {
    throw new Error("VAPI_API_KEY no configurada.");
  }

  // Sin credencial, VAPI llamará al webhook sin cabecera Authorization y
  // este responderá 401 en producción: todas las tools fallarían en llamada
  // real. Avisamos aquí en vez de dejar que "Re-alinear" reporte éxito falso.
  if (!env.VAPI_SERVER_CREDENTIAL_ID) {
    throw new Error(
      "Falta VAPI_SERVER_CREDENTIAL_ID. Crea una Custom Credential (Bearer Token) en el dashboard de VAPI con el mismo valor que VAPI_WEBHOOK_TOKEN, copia su ID en esa variable de entorno y vuelve a intentarlo."
    );
  }

  const webhookUrl = `${env.APP_URL}/api/vapi/webhook`;
  const serverPayload: Record<string, any> = {
    url: webhookUrl,
    credentialId: env.VAPI_SERVER_CREDENTIAL_ID,
  };

  const errors: string[] = [];

  // 1. Actualizar tools compartidas en VAPI
  await withTenant(session.businessId, async (tx) => {
    const tools = await tx.select().from(vapiTools);
    for (const tool of tools) {
      try {
        const res = await fetch(`https://api.vapi.ai/tool/${tool.vapiToolId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ server: serverPayload }),
        });
        if (!res.ok) {
          errors.push(`Tool '${tool.name}': HTTP ${res.status} ${await res.text()}`);
        }
      } catch (err: any) {
        errors.push(`Tool '${tool.name}': ${err.message}`);
      }
    }

    // 2. Actualizar asistente del negocio
    const [agent] = await tx
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.businessId, session.businessId))
      .limit(1);

    if (agent?.vapiAssistantId) {
      try {
        const res = await fetch(`https://api.vapi.ai/assistant/${agent.vapiAssistantId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ server: serverPayload }),
        });
        if (!res.ok) {
          errors.push(`Asistente: HTTP ${res.status} ${await res.text()}`);
        }
      } catch (err: any) {
        errors.push(`Asistente: ${err.message}`);
      }
    }
  });

  revalidatePath("/conexiones");

  if (errors.length > 0) {
    throw new Error(`Re-alineado con errores: ${errors.join(" | ")}`);
  }

  return { success: true, updatedUrl: webhookUrl };
}
