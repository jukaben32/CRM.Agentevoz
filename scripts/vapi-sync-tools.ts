import pg from "pg";
import { getAdminDatabaseUrl, env } from "../lib/env";
import { SHARED_FUNCTION_TOOLS, getToolChecksum } from "../lib/vapi/tools-definition";

const { Client } = pg;

async function syncVapiTools() {
  console.log("🛠️ Sincronizando tools compartidas con VAPI (pnpm vapi:tools:sync)...");

  const apiKey = env.VAPI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ VAPI_API_KEY no está configurada en .env. Omitiendo sincronización con API de VAPI.");
    console.log("ℹ️ Registrando tools en la tabla local vapi_tools con IDs de desarrollo simulados.");
    
    const client = new Client({ connectionString: getAdminDatabaseUrl() });
    await client.connect();
    try {
      for (const tool of SHARED_FUNCTION_TOOLS) {
        const checksum = getToolChecksum(tool);
        const devToolId = `tool_dev_${tool.name}`;
        await client.query(
          `INSERT INTO vapi_tools (name, vapi_tool_id, checksum, synced_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (name) DO UPDATE SET
             vapi_tool_id = EXCLUDED.vapi_tool_id,
             checksum = EXCLUDED.checksum,
             synced_at = now()`,
          [tool.name, devToolId, checksum]
        );
        console.log(`✅ Tool local registrada: ${tool.name} (${devToolId})`);
      }
    } finally {
      await client.end();
    }
    return;
  }

  const client = new Client({ connectionString: getAdminDatabaseUrl() });
  await client.connect();

  try {
    const webhookUrl = `${env.APP_URL}/api/vapi/webhook`;
    const serverObj: Record<string, any> = {
      url: webhookUrl,
      timeoutSeconds: 20,
    };
    if (env.VAPI_WEBHOOK_SECRET || env.VAPI_WEBHOOK_TOKEN) {
      serverObj.secret = env.VAPI_WEBHOOK_SECRET || env.VAPI_WEBHOOK_TOKEN;
    }
    if (env.VAPI_SERVER_CREDENTIAL_ID) {
      serverObj.credentialId = env.VAPI_SERVER_CREDENTIAL_ID;
    }

    // 1. Obtener tools existentes en base de datos
    const { rows: existingRows } = await client.query<{
      name: string;
      vapi_tool_id: string;
      checksum: string;
    }>("SELECT name, vapi_tool_id, checksum FROM vapi_tools");
    const existingMap = new Map(existingRows.map((r) => [r.name, r]));

    for (const tool of SHARED_FUNCTION_TOOLS) {
      const checksum = getToolChecksum(tool);
      const existing = existingMap.get(tool.name);

      const payload = {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
        server: serverObj,
        messages: tool.messages || [],
      };

      if (!existing || existing.vapi_tool_id.startsWith("tool_dev_")) {
        console.log(`✨ Creando tool en VAPI: ${tool.name}...`);
        const res = await fetch("https://api.vapi.ai/tool", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`❌ Error al crear tool ${tool.name} en VAPI (${res.status}):`, errText);
          continue;
        }

        const data = await res.json();
        const vapiToolId = data.id;

        await client.query(
          `INSERT INTO vapi_tools (name, vapi_tool_id, checksum, synced_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (name) DO UPDATE SET
             vapi_tool_id = EXCLUDED.vapi_tool_id,
             checksum = EXCLUDED.checksum,
             synced_at = now()`,
          [tool.name, vapiToolId, checksum]
        );
        console.log(`✅ Tool creada con éxito: ${tool.name} -> ${vapiToolId}`);
      } else if (existing.checksum !== checksum) {
        console.log(`🔄 Actualizando tool en VAPI: ${tool.name} (${existing.vapi_tool_id})...`);
        const res = await fetch(`https://api.vapi.ai/tool/${existing.vapi_tool_id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`❌ Error al actualizar tool ${tool.name} en VAPI:`, errText);
          continue;
        }

        await client.query(
          `UPDATE vapi_tools SET checksum = $1, synced_at = now() WHERE name = $2`,
          [checksum, tool.name]
        );
        console.log(`✅ Tool actualizada con éxito: ${tool.name}`);
      } else {
        console.log(`⏩ Tool ya sincronizada: ${tool.name} (${existing.vapi_tool_id})`);
      }
    }

    console.log("🎉 Sincronización de tools completada.");
  } finally {
    await client.end();
  }
}

syncVapiTools().catch((err) => {
  console.error("Fatal error en syncVapiTools:", err);
  process.exit(1);
});
