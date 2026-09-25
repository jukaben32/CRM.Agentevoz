/**
 * Script CLI: pnpm vapi:sync
 * Re-alinea el server.url y server.credentialId de todos los asistentes y tools
 * compartidas registrados en la cuenta de VAPI con el APP_URL actual.
 */
import { pool } from "../lib/db";
import { env } from "../lib/env";

async function main() {
  console.log("=== Sincronización Global de URLs VAPI ===");
  const targetWebhookUrl = `${env.APP_URL}/api/vapi/webhook`;
  console.log(`URL Webhook Destino: ${targetWebhookUrl}\n`);

  if (!env.VAPI_API_KEY) {
    console.error("ERROR: VAPI_API_KEY no está configurada en .env");
    process.exit(1);
  }

  // IMPORTANTE: el webhook (app/api/vapi/webhook/route.ts) valida un header
  // "Authorization: Bearer <token>", que VAPI solo envía cuando el asistente/tool
  // tiene server.credentialId apuntando a una Custom Credential tipo Bearer Token
  // en VAPI (no basta con server.secret: eso manda X-Vapi-Secret, que el
  // webhook no comprueba). Sin esto, cada tool-call real fallará con 401.
  if (!env.VAPI_SERVER_CREDENTIAL_ID) {
    console.error(
      "ERROR: VAPI_SERVER_CREDENTIAL_ID no está configurada. Crea la Custom Credential " +
        "(Bearer Token, mismo valor que VAPI_WEBHOOK_TOKEN) en el dashboard de VAPI y pon " +
        "su ID en esta variable antes de sincronizar."
    );
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    // 1. Sincronizar Tools compartidas
    console.log("1. Actualizando Tools Compartidas en VAPI...");
    const { rows: dbTools } = await client.query<{ name: string; vapi_tool_id: string }>(
      "SELECT name, vapi_tool_id FROM vapi_tools"
    );

    for (const tool of dbTools) {
      try {
        console.log(`- Actualizando tool '${tool.name}' (${tool.vapi_tool_id})...`);
        const res = await fetch(`https://api.vapi.ai/tool/${tool.vapi_tool_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${env.VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            server: {
              url: targetWebhookUrl,
              credentialId: env.VAPI_SERVER_CREDENTIAL_ID,
              timeoutSeconds: 20,
            },
          }),
        });

        if (res.ok) {
          console.log(`  ✓ Tool '${tool.name}' sincronizada.`);
        } else {
          const text = await res.text();
          console.warn(`  ✗ Warning actualizando tool '${tool.name}' (${res.status}): ${text}`);
        }
      } catch (err: any) {
        console.error(`  ✗ Error actualizando tool '${tool.name}':`, err.message);
      }
    }

    // 2. Sincronizar Asistentes registrados
    console.log("\n2. Actualizando Asistentes en VAPI...");
    const { rows: agents } = await client.query<{ business_id: string; vapi_assistant_id: string }>(
      "SELECT business_id, vapi_assistant_id FROM voice_agents WHERE vapi_assistant_id IS NOT NULL"
    );

    if (agents.length === 0) {
      console.log("No hay asistentes registrados en la base de datos.");
    } else {
      for (const ag of agents) {
        try {
          console.log(`- Actualizando Asistente ${ag.vapi_assistant_id} (Negocio: ${ag.business_id})...`);
          const res = await fetch(`https://api.vapi.ai/assistant/${ag.vapi_assistant_id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${env.VAPI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              server: {
                url: targetWebhookUrl,
                credentialId: env.VAPI_SERVER_CREDENTIAL_ID,
                timeoutSeconds: 20,
              },
            }),
          });

          if (res.ok) {
            console.log(`  ✓ Asistente ${ag.vapi_assistant_id} sincronizado.`);
          } else {
            const text = await res.text();
            console.warn(`  ✗ Warning actualizando asistente (${res.status}): ${text}`);
          }
        } catch (err: any) {
          console.error(`  ✗ Error actualizando asistente ${ag.vapi_assistant_id}:`, err.message);
        }
      }
    }

    console.log("\n✓ Sincronización completada.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error fatal durante vapi:sync:", err);
  process.exit(1);
});
