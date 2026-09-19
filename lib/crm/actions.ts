"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import {
  createContact,
  updateContact,
  deleteContact,
  addContactNote,
} from "./contacts";

export async function createContactAction(data: any) {
  const session = await requireSession();

  const newContact = await withTenant(session.businessId, async (tx) => {
    return createContact(tx, session.businessId, {
      ...data,
      userId: session.userId,
    });
  });

  revalidatePath("/contactos");
  revalidatePath("/");
  return { success: true, contact: newContact };
}

export async function updateContactAction(contactId: string, data: any) {
  const session = await requireSession();

  const updated = await withTenant(session.businessId, async (tx) => {
    return updateContact(tx, session.businessId, contactId, data);
  });

  revalidatePath("/contactos");
  revalidatePath("/");
  return { success: true, contact: updated };
}

export async function deleteContactAction(contactId: string) {
  const session = await requireSession();

  await withTenant(session.businessId, async (tx) => {
    await deleteContact(tx, session.businessId, contactId);
  });

  revalidatePath("/contactos");
  revalidatePath("/");
  return { success: true };
}

export async function addContactNoteAction(contactId: string, body: string) {
  const session = await requireSession();

  const note = await withTenant(session.businessId, async (tx) => {
    return addContactNote(tx, session.businessId, contactId, body, session.userId);
  });

  revalidatePath("/contactos");
  return { success: true, note };
}
