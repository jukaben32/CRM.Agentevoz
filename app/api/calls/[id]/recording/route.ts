import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/tenant";
import { calls } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { env } from "@/lib/env";

// Caché en memoria para URLs firmadas (20 minutos)
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: callId } = await params;

  // 1. Verificar si existe en caché
  const cached = signedUrlCache.get(callId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.redirect(cached.url, 302);
  }

  // 2. Verificar llamada en la base de datos del negocio
  let vapiCallId: string | null = null;
  let rawRecordingUrl: string | null = null;

  await withTenant(session.businessId, async (tx) => {
    const [call] = await tx
      .select({
        vapiCallId: calls.vapiCallId,
        recordingUrl: calls.recordingUrl,
      })
      .from(calls)
      .where(and(eq(calls.businessId, session.businessId), eq(calls.id, callId)))
      .limit(1);

    if (call) {
      vapiCallId = call.vapiCallId;
      rawRecordingUrl = call.recordingUrl;
    }
  });

  if (!vapiCallId && !rawRecordingUrl) {
    return NextResponse.json({ error: "Grabación no encontrada" }, { status: 404 });
  }

  // 3. Obtener URL firmada fresca desde VAPI
  let signedUrl: string | null = null;

  if (env.VAPI_API_KEY && vapiCallId) {
    try {
      const res = await fetch(`https://api.vapi.ai/call/${vapiCallId}/mono-recording`, {
        headers: {
          Authorization: `Bearer ${env.VAPI_API_KEY}`,
        },
        redirect: "manual",
      });

      if (res.status === 302 || res.status === 301) {
        signedUrl = res.headers.get("location");
      } else if (res.ok) {
        const data = await res.json();
        signedUrl = data.url || data.presignedUrl || null;
      }
    } catch (err) {
      console.error("Error al obtener mono-recording firmado de VAPI:", err);
    }
  }

  if (!signedUrl) {
    signedUrl = rawRecordingUrl;
  }

  if (!signedUrl) {
    return NextResponse.json({ error: "No se pudo generar el enlace firmado de audio" }, { status: 500 });
  }

  // 4. Guardar en caché por 20 minutos (1200 segundos)
  signedUrlCache.set(callId, {
    url: signedUrl,
    expiresAt: Date.now() + 20 * 60 * 1000,
  });

  return NextResponse.redirect(signedUrl, 302);
}
