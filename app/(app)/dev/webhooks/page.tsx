import React from "react";
import { requireSession } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { WebhookInspector } from "@/components/webhook-inspector";

export default async function DevWebhooksPage() {
  await requireSession();

  const client = await pool.connect();
  let events: any[] = [];

  try {
    const { rows } = await client.query<{
      id: string;
      event_type: string;
      external_id: string;
      payload: any;
      processed_at: Date;
      error: string | null;
    }>(
      `SELECT id, event_type, external_id, payload, processed_at, error
       FROM webhook_events
       ORDER BY processed_at DESC
       LIMIT 50`
    );

    events = rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      externalId: r.external_id,
      payload: r.payload,
      processedAt: r.processed_at.toISOString(),
      error: r.error,
    }));
  } finally {
    client.release();
  }

  return <WebhookInspector events={events} />;
}
