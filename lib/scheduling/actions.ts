"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { appointments, contactNotes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { DateTime } from "luxon";
import { formatSlotForSpeech } from "./availability";
import { rescheduleAppointment, cancelAppointment } from "./booking";

/**
 * Server Action: Cambiar estado de una cita
 */
export async function updateAppointmentStatusAction(appointmentId: string, newStatus: string) {
  const session = await requireSession();

  await withTenant(session.businessId, async (tx) => {
    const [app] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.businessId, session.businessId), eq(appointments.id, appointmentId)))
      .limit(1);

    if (!app) throw new Error("Cita no encontrada.");

    await tx
      .update(appointments)
      .set({
        status: newStatus as any,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    if (app.contactId) {
      await tx.insert(contactNotes).values({
        businessId: session.businessId,
        contactId: app.contactId,
        body: `Estado de la cita (${app.serviceName}) actualizado a: ${newStatus}`,
        authorUserId: session.userId,
      });
    }
  });

  revalidatePath("/agenda");
  revalidatePath("/");
  return { success: true };
}

/**
 * Server Action: Mover/reprogramar cita desde el panel
 */
export async function moveAppointmentAction(appointmentId: string, newStartIso: string) {
  const session = await requireSession();

  const res = await withTenant(session.businessId, async (tx) => {
    return rescheduleAppointment(tx, session.businessId, null, newStartIso, appointmentId);
  });

  if (!res.success) {
    return { success: false, error: res.message, alternatives: res.alternatives };
  }

  revalidatePath("/agenda");
  revalidatePath("/");
  return { success: true };
}

/**
 * Server Action: Anular cita desde el panel
 */
export async function cancelAppointmentAction(appointmentId: string, reason?: string) {
  const session = await requireSession();

  const res = await withTenant(session.businessId, async (tx) => {
    return cancelAppointment(tx, session.businessId, null, appointmentId, reason);
  });

  revalidatePath("/agenda");
  revalidatePath("/");
  return { success: res.success, error: res.success ? undefined : res.message };
}
