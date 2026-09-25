import { DateTime } from "luxon";
import { sql, eq, and, ne, gte, lte } from "drizzle-orm";
import { TenantDb } from "@/lib/db/tenant";
import {
  businesses,
  voiceAgents,
  contacts,
  contactNotes,
  appointments,
  calls,
  services,
} from "@/lib/db/schema";
import { normalizePhone } from "@/lib/phone";
import { getAvailableSlots, formatSlotForSpeech, AvailableSlot } from "./availability";

export interface BookAppointmentInput {
  businessId: string;
  callerPhone?: string | null;
  customerName: string;
  customerEmail?: string | null;
  serviceName: string;
  startIso: string;
  notes?: string | null;
  extraData?: Record<string, any> | null;
  callId?: string | null;
}

export interface BookingResult {
  success: boolean;
  appointmentId?: string;
  contactId?: string;
  message: string;
  alternatives?: AvailableSlot[];
}

/**
 * Reserva una cita de forma atómica y serializada para el negocio.
 * Incluye revalidación estricta, alta/enriquecimiento de contacto en el CRM
 * y creación de notas automáticas.
 */
export async function bookAppointment(
  tx: TenantDb,
  input: BookAppointmentInput
): Promise<BookingResult> {
  const { businessId, callerPhone, customerName, customerEmail, serviceName, startIso, notes, extraData, callId } = input;

  // 1. Bloqueo consultivo transaccional para serializar reservas concurrentes en este negocio
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${businessId}::text, 0))`);

  // 2. Obtener datos del negocio y agente
  const [business] = await tx
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const [agent] = await tx
    .select()
    .from(voiceAgents)
    .where(eq(voiceAgents.businessId, businessId))
    .limit(1);

  const timezone = business?.timezone || "America/Santo_Domingo";
  const slotCapacity = agent?.slotCapacity || 1;

  // 3. Obtener duración del servicio
  const allServices = await tx
    .select()
    .from(services)
    .where(and(eq(services.businessId, businessId), eq(services.isActive, true)));
  
  const matchedService = allServices.find((s) =>
    s.name.toLowerCase().includes(serviceName.toLowerCase())
  );
  const durationMinutes = matchedService?.durationMinutes || 60;
  const canonicalServiceName = matchedService?.name || serviceName;

  // 4. Calcular intervalo propuesto
  const requestedStart = DateTime.fromISO(startIso, { zone: timezone });
  if (!requestedStart.isValid) {
    return {
      success: false,
      message: "La fecha u hora solicitada no tiene un formato válido.",
    };
  }
  const requestedEnd = requestedStart.plus({ minutes: durationMinutes });

  // 5. Revalidar disponibilidad real en ese intervalo
  const overlappingAppointments = await tx
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.businessId, businessId),
        ne(appointments.status, "anulada"),
        lte(appointments.startsAt, requestedEnd.toJSDate()),
        gte(appointments.endsAt, requestedStart.toJSDate())
      )
    );

  if (overlappingAppointments.length >= slotCapacity) {
    // Hueco ocupado: buscar alternativas
    const alternatives = await getAvailableSlots(tx, businessId, {
      serviceName: canonicalServiceName,
      preferredDateIso: requestedStart.toISO(),
      maxOptions: 3,
    });

    let altMsg = "Ese hueco justo acaba de ocuparse.";
    if (alternatives.length > 0) {
      const opcionesTexto = alternatives.map((a) => a.textoHablado).join(", o ");
      altMsg += ` Tengo disponible ${opcionesTexto}. ¿Te encaja alguna?`;
    } else {
      altMsg += " ¿Te viene bien mirar otro día?";
    }

    return {
      success: false,
      message: altMsg,
      alternatives,
    };
  }

  // 6. Normalizar teléfono y gestionar Contacto en el CRM (Upsert no destructivo)
  const normalizedPhone = normalizePhone(callerPhone);
  let contactId: string | null = null;

  if (normalizedPhone) {
    const [existingContact] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, normalizedPhone)))
      .limit(1);

    if (existingContact) {
      contactId = existingContact.id;
      // Enriquecer campos vacíos sin pisar lo existente
      const updates: Record<string, any> = {
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      };
      if (!existingContact.fullName && customerName) {
        updates.fullName = customerName;
      }
      if (!existingContact.email && customerEmail) {
        updates.email = customerEmail;
      }
      if (extraData && Object.keys(extraData).length > 0) {
        updates.customFields = {
          ...(existingContact.customFields as Record<string, any>),
          ...extraData,
        };
      }

      await tx
        .update(contacts)
        .set(updates)
        .where(eq(contacts.id, existingContact.id));
    } else {
      // Crear nuevo contacto captado por agente de voz
      const [newContact] = await tx
        .insert(contacts)
        .values({
          businessId,
          fullName: customerName || `Cliente ${normalizedPhone.slice(-4)}`,
          phone: normalizedPhone,
          email: customerEmail || null,
          status: "lead",
          source: "agente_voz",
          customFields: extraData || {},
          lastContactedAt: new Date(),
        })
        .returning();
      contactId = newContact.id;
    }
  } else {
    // Si no hay teléfono, crear ficha con nombre
    const [newContact] = await tx
      .insert(contacts)
      .values({
        businessId,
        fullName: customerName || "Cliente sin teléfono",
        email: customerEmail || null,
        status: "lead",
        source: "agente_voz",
        customFields: extraData || {},
        lastContactedAt: new Date(),
      })
      .returning();
    contactId = newContact.id;
  }

  // 7. Insertar la cita en appointments
  const [newAppointment] = await tx
    .insert(appointments)
    .values({
      businessId,
      contactId,
      callId: callId || null,
      serviceId: matchedService?.id || null,
      serviceName: canonicalServiceName,
      startsAt: requestedStart.toJSDate(),
      endsAt: requestedEnd.toJSDate(),
      status: "agendada",
      notes: notes || null,
      createdVia: "agente_voz",
    })
    .returning();

  // 8. Crear nota en el historial del contacto
  if (contactId) {
    const fechaTexto = formatSlotForSpeech(requestedStart);
    const notaTexto = `Cita de ${canonicalServiceName} agendada por el agente de voz para ${fechaTexto}.${
      extraData?.matricula ? ` Vehículo/Matrícula: ${extraData.matricula}.` : ""
    }`;

    await tx.insert(contactNotes).values({
      businessId,
      contactId,
      body: notaTexto,
      authorUserId: null, // Nulo = anotada por el agente
    });
  }

  // 9. Vincular la llamada a la ficha del contacto si se indicó callId
  if (callId && contactId) {
    await tx
      .update(calls)
      .set({ contactId })
      .where(and(eq(calls.businessId, businessId), eq(calls.vapiCallId, callId)));
  }

  const spokenConfirmation = `Cita confirmada para ${canonicalServiceName} ${formatSlotForSpeech(
    requestedStart
  )}. Te esperamos.`;

  return {
    success: true,
    appointmentId: newAppointment.id,
    contactId: contactId || undefined,
    message: spokenConfirmation,
  };
}

/**
 * Reprograma una cita existente de ese número
 */
export async function rescheduleAppointment(
  tx: TenantDb,
  businessId: string,
  callerPhone: string | null,
  newStartIso: string,
  appointmentId?: string | null
): Promise<BookingResult> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${businessId}::text, 0))`);

  const normalizedPhone = normalizePhone(callerPhone);
  if (!normalizedPhone && !appointmentId) {
    return {
      success: false,
      message: "No puedo identificar tu cita sin saber desde qué teléfono llamas.",
    };
  }

  // Localizar cita activa
  let targetAppointment: any = null;
  if (appointmentId) {
    const [app] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.businessId, businessId), eq(appointments.id, appointmentId)))
      .limit(1);
    targetAppointment = app;
  } else if (normalizedPhone) {
    const [contact] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, normalizedPhone)))
      .limit(1);

    if (contact) {
      const [app] = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.businessId, businessId),
            eq(appointments.contactId, contact.id),
            gte(appointments.startsAt, new Date()),
            ne(appointments.status, "anulada")
          )
        )
        .orderBy(appointments.startsAt)
        .limit(1);
      targetAppointment = app;
    }
  }

  if (!targetAppointment) {
    return {
      success: false,
      message: "No he encontrado ninguna cita próxima pendiente para este número.",
    };
  }

  // Revalidar nuevo hueco
  const durationMinutes = Math.round(
    (new Date(targetAppointment.endsAt).getTime() - new Date(targetAppointment.startsAt).getTime()) /
      (60 * 1000)
  );

  const [business] = await tx
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  const timezone = business?.timezone || "America/Santo_Domingo";

  const newStart = DateTime.fromISO(newStartIso, { zone: timezone });
  if (!newStart.isValid) {
    return {
      success: false,
      message: "La nueva fecha u hora no tiene un formato válido.",
    };
  }
  const newEnd = newStart.plus({ minutes: durationMinutes });

  const [agent] = await tx
    .select()
    .from(voiceAgents)
    .where(eq(voiceAgents.businessId, businessId))
    .limit(1);
  const slotCapacity = agent?.slotCapacity || 1;

  const overlapping = await tx
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.businessId, businessId),
        ne(appointments.id, targetAppointment.id),
        ne(appointments.status, "anulada"),
        lte(appointments.startsAt, newEnd.toJSDate()),
        gte(appointments.endsAt, newStart.toJSDate())
      )
    );

  if (overlapping.length >= slotCapacity) {
    const alternatives = await getAvailableSlots(tx, businessId, {
      preferredDateIso: newStart.toISO(),
      maxOptions: 3,
    });
    return {
      success: false,
      message: `Ese nuevo hueco no está disponible. Tengo libre ${alternatives
        .map((a) => a.textoHablado)
        .join(", o ")}.`,
      alternatives,
    };
  }

  // Actualizar cita
  await tx
    .update(appointments)
    .set({
      startsAt: newStart.toJSDate(),
      endsAt: newEnd.toJSDate(),
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, targetAppointment.id));

  // Registrar nota
  if (targetAppointment.contactId) {
    await tx.insert(contactNotes).values({
      businessId,
      contactId: targetAppointment.contactId,
      body: `Cita reprogramada por el agente de voz para ${formatSlotForSpeech(newStart)}.`,
      authorUserId: null,
    });
  }

  return {
    success: true,
    appointmentId: targetAppointment.id,
    message: `Cita cambiada correctamente para ${formatSlotForSpeech(newStart)}.`,
  };
}

/**
 * Anula una cita existente
 */
export async function cancelAppointment(
  tx: TenantDb,
  businessId: string,
  callerPhone: string | null,
  appointmentId?: string | null,
  reason?: string | null
): Promise<BookingResult> {
  const normalizedPhone = normalizePhone(callerPhone);
  let targetAppointment: any = null;

  if (appointmentId) {
    const [app] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.businessId, businessId), eq(appointments.id, appointmentId)))
      .limit(1);
    targetAppointment = app;
  } else if (normalizedPhone) {
    const [contact] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, normalizedPhone)))
      .limit(1);

    if (contact) {
      const [app] = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.businessId, businessId),
            eq(appointments.contactId, contact.id),
            gte(appointments.startsAt, new Date()),
            ne(appointments.status, "anulada")
          )
        )
        .orderBy(appointments.startsAt)
        .limit(1);
      targetAppointment = app;
    }
  }

  if (!targetAppointment) {
    return {
      success: false,
      message: "No consta ninguna cita próxima para este número que se pueda anular.",
    };
  }

  await tx
    .update(appointments)
    .set({
      status: "anulada",
      notes: reason ? `${targetAppointment.notes || ""}\nMotivo anulación: ${reason}`.trim() : targetAppointment.notes,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, targetAppointment.id));

  if (targetAppointment.contactId) {
    await tx.insert(contactNotes).values({
      businessId,
      contactId: targetAppointment.contactId,
      body: `Cita anulada por el agente de voz.${reason ? ` Motivo: ${reason}` : ""}`,
      authorUserId: null,
    });
  }

  return {
    success: true,
    appointmentId: targetAppointment.id,
    message: "La cita ha sido anulada y el hueco ha quedado liberado.",
  };
}
