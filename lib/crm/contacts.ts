import { TenantDb } from "@/lib/db/tenant";
import { contacts, contactNotes, appointments, calls, users } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, ilike, inArray, ne } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";

export interface ListContactsParams {
  search?: string;
  status?: "lead" | "cliente" | "inactivo" | "todos";
  source?: "agente_voz" | "manual" | "importado" | "todos";
  tag?: string;
  sortBy?: "name" | "created" | "lastContacted";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/**
 * Listado paginado de contactos del CRM con búsqueda trigram insensible a acentos
 */
export async function listContacts(tx: TenantDb, businessId: string, params: ListContactsParams = {}) {
  const page = Math.max(params.page || 1, 1);
  const pageSize = Math.min(params.pageSize || 15, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [eq(contacts.businessId, businessId)];

  if (params.status && params.status !== "todos") {
    conditions.push(eq(contacts.status, params.status));
  }
  if (params.source && params.source !== "todos") {
    conditions.push(eq(contacts.source, params.source));
  }
  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    conditions.push(
      sql`(f_unaccent(${contacts.fullName}) ILIKE f_unaccent(${q}) OR ${contacts.phone} ILIKE ${q} OR ${contacts.email} ILIKE ${q})`
    );
  }
  if (params.tag && params.tag.trim()) {
    conditions.push(sql`${params.tag.trim()} = ANY(${contacts.tags})`);
  }

  const whereClause = and(...conditions);

  // Orden
  let orderExpr = desc(contacts.createdAt);
  if (params.sortBy === "name") {
    orderExpr = params.sortDir === "desc" ? desc(contacts.fullName) : asc(contacts.fullName);
  } else if (params.sortBy === "lastContacted") {
    orderExpr = params.sortDir === "asc" ? asc(contacts.lastContactedAt) : desc(contacts.lastContactedAt);
  } else if (params.sortBy === "created") {
    orderExpr = params.sortDir === "asc" ? asc(contacts.createdAt) : desc(contacts.createdAt);
  }

  // Consulta de datos con recuento de citas
  const rows = await tx
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      phone: contacts.phone,
      email: contacts.email,
      company: contacts.company,
      status: contacts.status,
      source: contacts.source,
      tags: contacts.tags,
      customFields: contacts.customFields,
      outboundConsent: contacts.outboundConsent,
      lastContactedAt: contacts.lastContactedAt,
      createdAt: contacts.createdAt,
      appointmentCount: sql<number>`(
        SELECT count(*)::int FROM appointments a WHERE a.contact_id = ${contacts.id} AND a.business_id = ${businessId}
      )`,
    })
    .from(contacts)
    .where(whereClause)
    .orderBy(orderExpr)
    .limit(pageSize)
    .offset(offset);

  const [{ totalCount }] = await tx
    .select({ totalCount: sql<number>`count(*)::int` })
    .from(contacts)
    .where(whereClause);

  return {
    items: rows,
    total: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Obtiene la ficha completa de un contacto con su cronología unificada
 */
export async function getContactDetail(tx: TenantDb, businessId: string, contactId: string) {
  const [contact] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.businessId, businessId), eq(contacts.id, contactId)))
    .limit(1);

  if (!contact) return null;

  // Citas del contacto
  const contactAppointments = await tx
    .select()
    .from(appointments)
    .where(and(eq(appointments.businessId, businessId), eq(appointments.contactId, contactId)))
    .orderBy(desc(appointments.startsAt));

  // Llamadas del contacto
  const contactCalls = await tx
    .select()
    .from(calls)
    .where(and(eq(calls.businessId, businessId), eq(calls.contactId, contactId)))
    .orderBy(desc(calls.startedAt));

  // Notas del contacto
  const contactNotesList = await tx
    .select({
      id: contactNotes.id,
      body: contactNotes.body,
      createdAt: contactNotes.createdAt,
      authorUserId: contactNotes.authorUserId,
      authorName: users.fullName,
    })
    .from(contactNotes)
    .leftJoin(users, eq(users.id, contactNotes.authorUserId))
    .where(and(eq(contactNotes.businessId, businessId), eq(contactNotes.contactId, contactId)))
    .orderBy(desc(contactNotes.createdAt));

  // Cronología unificada en orden inverso
  const timeline: Array<{
    id: string;
    type: "appointment" | "call" | "note";
    date: Date;
    title: string;
    description: string;
    meta?: any;
  }> = [];

  for (const app of contactAppointments) {
    timeline.push({
      id: app.id,
      type: "appointment",
      date: new Date(app.startsAt),
      title: `Cita: ${app.serviceName}`,
      description: `Estado: ${app.status} | Vía: ${app.createdVia}${app.notes ? ` - ${app.notes}` : ""}`,
      meta: app,
    });
  }

  for (const call of contactCalls) {
    timeline.push({
      id: call.id,
      type: "call",
      date: new Date(call.startedAt || call.createdAt),
      title: `Llamada ${call.direction === "inbound" ? "entrante" : "saliente"} (${call.durationSeconds || 0}s)`,
      description: call.summary || `Estado: ${call.status} - ${call.endedReason || "Sin motivo"}`,
      meta: call,
    });
  }

  for (const note of contactNotesList) {
    timeline.push({
      id: note.id,
      type: "note",
      date: new Date(note.createdAt),
      title: note.authorUserId ? `Nota por ${note.authorName || "Equipo"}` : "Nota del Agente de Voz",
      description: note.body,
      meta: note,
    });
  }

  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    contact,
    appointments: contactAppointments,
    calls: contactCalls,
    notes: contactNotesList,
    timeline,
  };
}

/**
 * Crea un contacto manualmente desde el panel
 */
export async function createContact(
  tx: TenantDb,
  businessId: string,
  data: {
    fullName: string;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
    status?: "lead" | "cliente" | "inactivo";
    tags?: string[];
    customFields?: Record<string, any>;
    outboundConsent?: boolean;
    initialNote?: string;
    userId?: string;
  }
) {
  const normalizedPhone = normalizePhone(data.phone);

  if (normalizedPhone) {
    const [existing] = await tx
      .select({ id: contacts.id, fullName: contacts.fullName })
      .from(contacts)
      .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, normalizedPhone)))
      .limit(1);

    if (existing) {
      throw new Error(`Ya existe un contacto con el teléfono ${normalizedPhone}: ${existing.fullName}`);
    }
  }

  const [newContact] = await tx
    .insert(contacts)
    .values({
      businessId,
      fullName: data.fullName,
      phone: normalizedPhone,
      email: data.email || null,
      company: data.company || null,
      status: data.status || "lead",
      source: "manual",
      tags: data.tags || [],
      customFields: data.customFields || {},
      outboundConsent: data.outboundConsent || false,
      lastContactedAt: new Date(),
    })
    .returning();

  if (data.initialNote && data.initialNote.trim()) {
    await tx.insert(contactNotes).values({
      businessId,
      contactId: newContact.id,
      body: data.initialNote.trim(),
      authorUserId: data.userId || null,
    });
  }

  return newContact;
}

/**
 * Actualiza una ficha de contacto
 */
export async function updateContact(
  tx: TenantDb,
  businessId: string,
  contactId: string,
  data: {
    fullName?: string;
    phone?: string | null;
    email?: string | null;
    company?: string | null;
    status?: "lead" | "cliente" | "inactivo";
    tags?: string[];
    customFields?: Record<string, any>;
    outboundConsent?: boolean;
  }
) {
  const updates: Record<string, any> = { updatedAt: new Date() };

  if (data.fullName !== undefined) updates.fullName = data.fullName;
  if (data.email !== undefined) updates.email = data.email || null;
  if (data.company !== undefined) updates.company = data.company || null;
  if (data.status !== undefined) updates.status = data.status;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.customFields !== undefined) updates.customFields = data.customFields;
  if (data.outboundConsent !== undefined) updates.outboundConsent = data.outboundConsent;

  if (data.phone !== undefined) {
    const normalizedPhone = normalizePhone(data.phone);
    if (normalizedPhone) {
      const [duplicate] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.businessId, businessId),
            eq(contacts.phone, normalizedPhone),
            ne(contacts.id, contactId)
          )
        )
        .limit(1);
      if (duplicate) {
        throw new Error(`El teléfono ${normalizedPhone} ya pertenece a otro contacto.`);
      }
    }
    updates.phone = normalizedPhone;
  }

  const [updated] = await tx
    .update(contacts)
    .set(updates)
    .where(and(eq(contacts.businessId, businessId), eq(contacts.id, contactId)))
    .returning();

  return updated;
}

/**
 * Elimina un contacto del CRM.
 * IMPORTANTE: Las citas y llamadas históricas sobreviven con contact_id a NULL.
 * Las notas del contacto caen en cascada.
 */
export async function deleteContact(tx: TenantDb, businessId: string, contactId: string) {
  // Desvincular citas y llamadas a NULL explícitamente por consistencia
  await tx
    .update(appointments)
    .set({ contactId: null })
    .where(and(eq(appointments.businessId, businessId), eq(appointments.contactId, contactId)));

  await tx
    .update(calls)
    .set({ contactId: null })
    .where(and(eq(calls.businessId, businessId), eq(calls.contactId, contactId)));

  await tx
    .delete(contacts)
    .where(and(eq(contacts.businessId, businessId), eq(contacts.id, contactId)));
}

/**
 * Añade una nota manual a la ficha del contacto
 */
export async function addContactNote(
  tx: TenantDb,
  businessId: string,
  contactId: string,
  body: string,
  userId?: string | null
) {
  if (!body.trim()) return null;

  const [newNote] = await tx
    .insert(contactNotes)
    .values({
      businessId,
      contactId,
      body: body.trim(),
      authorUserId: userId || null,
    })
    .returning();

  return newNote;
}
