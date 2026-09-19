import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pool } from "@/lib/db";
import { env } from "@/lib/env";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Solo accesible en desarrollo o por usuarios autenticados
  const session = await getSession();
  if (!session && env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const client = await pool.connect();

  try {
    const { rows } = await client.query<{
      id: string;
      payload: any;
      event_type: string;
    }>(
      "SELECT id, payload, event_type FROM webhook_events WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Evento webhook no encontrado." }, { status: 404 });
    }

    const event = rows[0];

    // Re-enviar el payload al webhook endpoint
    const webhookUrl = `${env.APP_URL}/api/vapi/webhook`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-vapi-replay": "true",
    };

    if (env.VAPI_WEBHOOK_SECRET) {
      headers["Authorization"] = `Bearer ${env.VAPI_WEBHOOK_SECRET}`;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(event.payload),
    });

    const responseData = await res.json().catch(() => ({ status: res.status }));

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      replayResponse: responseData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al reejecutar webhook." }, { status: 500 });
  } finally {
    client.release();
  }
}
