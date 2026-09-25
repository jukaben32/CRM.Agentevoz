import React from "react";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { appointments, contacts, businessHours } from "@/lib/db/schema";
import { eq, desc, ne, asc } from "drizzle-orm";
import { CalendarView } from "@/components/calendar-view";

export default async function AgendaPage() {
  const session = await requireSession();

  const { appointmentList, hoursList } = await withTenant(session.businessId, async (tx) => {
    const apps = await tx
      .select({
        id: appointments.id,
        contactId: appointments.contactId,
        contactName: contacts.fullName,
        contactPhone: contacts.phone,
        callId: appointments.callId,
        serviceName: appointments.serviceName,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        notes: appointments.notes,
        createdVia: appointments.createdVia,
      })
      .from(appointments)
      .leftJoin(contacts, eq(contacts.id, appointments.contactId))
      .where(eq(appointments.businessId, session.businessId))
      .orderBy(asc(appointments.startsAt));

    const hours = await tx
      .select()
      .from(businessHours)
      .where(eq(businessHours.businessId, session.businessId));

    return {
      appointmentList: apps.map((a) => ({
        ...a,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
      })),
      hoursList: hours.map((h) => ({
        weekday: h.weekday,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
        isClosed: h.isClosed,
      })),
    };
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Agenda de citas
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Gestión y disponibilidad de turnos de taller sincronizados en tiempo real con el agente de voz
          </p>
        </div>
      </div>

      <CalendarView
        initialAppointments={appointmentList}
        timezone={session.businessTimezone || "America/Santo_Domingo"}
        businessHours={hoursList}
      />
    </div>
  );
}
