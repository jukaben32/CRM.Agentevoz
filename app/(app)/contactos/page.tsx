import React from "react";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { listContacts, getContactDetail } from "@/lib/crm/contacts";
import { ContactsCrmView } from "@/components/contacts-crm-view";

interface PageProps {
  searchParams: Promise<{
    id?: string;
    search?: string;
    status?: string;
    source?: string;
    page?: string;
  }>;
}

export default async function ContactosPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const { contactList, detailData } = await withTenant(session.businessId, async (tx) => {
    const list = await listContacts(tx, session.businessId, {
      search: params.search,
      status: (params.status as any) || "todos",
      source: (params.source as any) || "todos",
      page: params.page ? parseInt(params.page, 10) : 1,
      pageSize: 20,
    });

    let detail = null;
    if (params.id) {
      detail = await getContactDetail(tx, session.businessId, params.id);
    }

    return {
      contactList: {
        ...list,
        items: list.items.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
          lastContactedAt: i.lastContactedAt ? i.lastContactedAt.toISOString() : null,
        })),
      },
      detailData: detail,
    };
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Contactos (CRM)
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Fichas de clientes y vehículos registradas automáticamente por el agente de voz o creadas a mano
        </p>
      </div>

      <ContactsCrmView
        initialData={contactList}
        selectedDetail={detailData}
      />
    </div>
  );
}
