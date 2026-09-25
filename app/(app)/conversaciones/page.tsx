import React from "react";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { calls, callMessages, contacts, appointments } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { ConversationsView } from "@/components/conversations-view";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function ConversacionesPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const { callList, detail } = await withTenant(session.businessId, async (tx) => {
    const rawCalls = await tx
      .select({
        id: calls.id,
        vapiCallId: calls.vapiCallId,
        direction: calls.direction,
        fromNumber: calls.fromNumber,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        status: calls.status,
        endedReason: calls.endedReason,
        summary: calls.summary,
        costCents: calls.costCents,
        recordingUrl: calls.recordingUrl,
        needsReview: calls.needsReview,
        contactId: calls.contactId,
        contactName: contacts.fullName,
      })
      .from(calls)
      .leftJoin(contacts, eq(contacts.id, calls.contactId))
      .where(eq(calls.businessId, session.businessId))
      .orderBy(desc(calls.startedAt));

    let callDetail = null;
    const targetCallId = params.id || (rawCalls.length > 0 ? rawCalls[0].id : null);

    if (targetCallId) {
      const matched = rawCalls.find((c) => c.id === targetCallId);
      if (matched) {
        const msgs = await tx
          .select()
          .from(callMessages)
          .where(and(eq(callMessages.businessId, session.businessId), eq(callMessages.callId, targetCallId)))
          .orderBy(asc(callMessages.sortOrder));

        const [app] = await tx
          .select()
          .from(appointments)
          .where(and(eq(appointments.businessId, session.businessId), eq(appointments.callId, targetCallId)))
          .limit(1);

        callDetail = {
          call: {
            ...matched,
            startedAt: matched.startedAt ? matched.startedAt.toISOString() : null,
            endedAt: matched.endedAt ? matched.endedAt.toISOString() : null,
          },
          messages: msgs,
          appointment: app || null,
        };
      }
    }

    return {
      callList: rawCalls.map((c) => ({
        ...c,
        startedAt: c.startedAt ? c.startedAt.toISOString() : null,
        endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      })),
      detail: callDetail,
    };
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Conversaciones telefónicas
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Historial de llamadas, transcripción turno a turno generada por IA y grabaciones de audio
        </p>
      </div>

      <ConversationsView
        callsList={callList}
        selectedCallDetail={detail}
        timezone={session.businessTimezone || "America/Santo_Domingo"}
      />
    </div>
  );
}
