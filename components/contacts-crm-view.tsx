"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  Plus,
  User,
  PhoneCall,
  CalendarCheck,
  NotePencil,
  Trash,
  X,
  CheckCircle,
  WarningCircle,
  ChatCircleText,
  Clock,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  CONTACT_STATUS_LABELS,
  CONTACT_SOURCE_LABELS,
  getStatusBadgeStyle,
} from "@/lib/labels";
import { formatPhoneForDisplay } from "@/lib/phone";
import {
  createContactAction,
  updateContactAction,
  deleteContactAction,
  addContactNoteAction,
} from "@/lib/crm/actions";

interface ContactRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  status: string;
  source: string;
  tags: string[];
  customFields: any;
  outboundConsent: boolean;
  lastContactedAt: string | null;
  createdAt: string;
  appointmentCount: number;
}

interface ContactsCrmViewProps {
  initialData: {
    items: ContactRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  selectedDetail?: any | null;
}

export function ContactsCrmView({ initialData, selectedDetail }: ContactsCrmViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sourceFilter, setSourceFilter] = useState("todos");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formStatus, setFormStatus] = useState<"lead" | "cliente" | "inactivo">("lead");
  const [formTags, setFormTags] = useState("");
  const [formVehiculo, setFormVehiculo] = useState("");
  const [formMatricula, setFormMatricula] = useState("");
  const [formConsent, setFormConsent] = useState(false);
  const [formNote, setFormNote] = useState("");

  const [newNoteBody, setNewNoteBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const openCreateDrawer = () => {
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormCompany("");
    setFormStatus("lead");
    setFormTags("");
    setFormVehiculo("");
    setFormMatricula("");
    setFormConsent(false);
    setFormNote("");
    setFeedback(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (c: ContactRow) => {
    setEditingContact(c);
    setFormName(c.fullName);
    setFormPhone(c.phone || "");
    setFormEmail(c.email || "");
    setFormCompany(c.company || "");
    setFormStatus(c.status as any);
    setFormTags((c.tags || []).join(", "));
    setFormVehiculo(c.customFields?.vehiculo || "");
    setFormMatricula(c.customFields?.matricula || "");
    setFormConsent(c.outboundConsent || false);
    setFormNote("");
    setFeedback(null);
    setIsDrawerOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const tagsArr = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const customFields: Record<string, any> = {};
    if (formVehiculo) customFields.vehiculo = formVehiculo;
    if (formMatricula) customFields.matricula = formMatricula;

    startTransition(async () => {
      try {
        if (editingContact) {
          await updateContactAction(editingContact.id, {
            fullName: formName,
            phone: formPhone || null,
            email: formEmail || null,
            company: formCompany || null,
            status: formStatus,
            tags: tagsArr,
            customFields,
            outboundConsent: formConsent,
          });
          setFeedback({ type: "success", message: "Contacto actualizado con éxito." });
        } else {
          await createContactAction({
            fullName: formName,
            phone: formPhone || null,
            email: formEmail || null,
            company: formCompany || null,
            status: formStatus,
            tags: tagsArr,
            customFields,
            outboundConsent: formConsent,
            initialNote: formNote,
          });
          setFeedback({ type: "success", message: "Contacto creado con éxito." });
        }
        setIsDrawerOpen(false);
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Error al guardar el contacto." });
      }
    });
  };

  const handleDelete = (contactId: string, name: string) => {
    if (
      !confirm(
        `¿Seguro que deseas eliminar la ficha de "${name}"?\n\nLas llamadas y citas históricas se conservarán en el sistema (desvinculadas), y sus notas se borrarán.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteContactAction(contactId);
        router.push("/contactos");
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Error al eliminar contacto.");
      }
    });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || !newNoteBody.trim()) return;

    startTransition(async () => {
      try {
        await addContactNoteAction(selectedDetail.contact.id, newNoteBody);
        setNewNoteBody("");
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Error al añadir nota.");
      }
    });
  };

  const handleTriggerOutboundCall = async (contactId: string) => {
    if (!confirm("¿Deseas que el agente de voz realice una llamada saliente a este contacto?")) return;

    try {
      const res = await fetch("/api/vapi/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, reason: "Llamada iniciada desde el panel CRM" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar la llamada.");

      alert("Llamada encolada con éxito. El agente de voz está marcando.");
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Error al lanzar llamada saliente.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros y Botón Alta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email..."
              className="field pl-9 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field w-auto text-xs"
          >
            <option value="todos">Todos los estados</option>
            <option value="lead">Clientes potenciales (Leads)</option>
            <option value="cliente">Clientes habituales</option>
            <option value="inactivo">Inactivos</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="field w-auto text-xs"
          >
            <option value="todos">Todos los orígenes</option>
            <option value="agente_voz">Agente de voz (Llamadas)</option>
            <option value="manual">Manual (Panel)</option>
          </select>
        </div>

        <button
          onClick={openCreateDrawer}
          className="btn btn-primary text-xs flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Nuevo contacto</span>
        </button>
      </div>

      {/* Contenido Principal: Listado o Split con Ficha de Detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabla de Contactos (2 o 3 columnas) */}
        <div className={`card-saas overflow-hidden ${selectedDetail ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/60 text-stone-500 font-semibold">
                  <th className="p-3.5 pl-5">Nombre y Empresa</th>
                  <th className="p-3.5">Teléfono</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5">Origen</th>
                  <th className="p-3.5 text-center">Citas</th>
                  <th className="p-3.5 text-right pr-5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {initialData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400">
                      No se encontraron contactos en el CRM.
                    </td>
                  </tr>
                ) : (
                  initialData.items.map((c) => {
                    const statusStyle = getStatusBadgeStyle(c.status);
                    const sourceStyle = getStatusBadgeStyle(c.source);
                    const isSelected = selectedDetail?.contact?.id === c.id;

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors ${
                          isSelected ? "bg-orange-50/50 dark:bg-orange-950/20" : ""
                        }`}
                      >
                        <td className="p-3.5 pl-5 font-medium text-stone-900 dark:text-stone-100">
                          <Link href={`/contactos?id=${c.id}`} className="hover:underline text-orange-600 dark:text-orange-400">
                            {c.fullName}
                          </Link>
                          {c.company && (
                            <div className="text-[11px] text-stone-400 font-normal">{c.company}</div>
                          )}
                          {c.customFields?.matricula && (
                            <div className="text-[10px] text-stone-500 font-mono">
                              🚗 {c.customFields.matricula} {c.customFields.vehiculo ? `(${c.customFields.vehiculo})` : ""}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-stone-700 dark:text-stone-300">
                          {formatPhoneForDisplay(c.phone)}
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                          >
                            {CONTACT_STATUS_LABELS[c.status as keyof typeof CONTACT_STATUS_LABELS] || c.status}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${sourceStyle.bg} ${sourceStyle.text} ${sourceStyle.border}`}
                          >
                            {CONTACT_SOURCE_LABELS[c.source as keyof typeof CONTACT_SOURCE_LABELS] || c.source}
                          </span>
                        </td>

                        <td className="p-3.5 text-center font-medium">
                          {c.appointmentCount}
                        </td>

                        <td className="p-3.5 text-right pr-5 space-x-2">
                          <button
                            onClick={() => openEditDrawer(c)}
                            title="Editar ficha"
                            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded text-stone-500 hover:text-stone-900 cursor-pointer"
                          >
                            <NotePencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.fullName)}
                            title="Eliminar"
                            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ficha de Detalle del Contacto (§12 - Vista 3) */}
        {selectedDetail && (
          <div className="card-saas p-6 space-y-6 lg:col-span-1 border-orange-200 dark:border-orange-900/40">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  {selectedDetail.contact.fullName}
                </h2>
                <div className="text-xs text-stone-500 font-mono">
                  {formatPhoneForDisplay(selectedDetail.contact.phone)}
                </div>
              </div>
              <Link
                href="/contactos"
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
                title="Cerrar ficha"
              >
                <X size={16} />
              </Link>
            </div>

            {/* Acciones Rápidas */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTriggerOutboundCall(selectedDetail.contact.id)}
                className="btn btn-primary text-xs flex-1 py-2 flex items-center justify-center gap-1.5"
              >
                <PhoneCall size={14} />
                <span>Llamar con el agente</span>
              </button>
              <button
                onClick={() => openEditDrawer(selectedDetail.contact)}
                className="btn btn-secondary text-xs py-2 px-3"
                title="Editar"
              >
                <NotePencil size={14} />
              </button>
            </div>

            {/* Consentimiento RGPD */}
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-2">
              <ShieldCheck size={16} className={selectedDetail.contact.outboundConsent ? "text-emerald-600" : "text-amber-500"} />
              <span>
                {selectedDetail.contact.outboundConsent
                  ? "Consentimiento RGPD/LSSI registrado para llamadas salientes"
                  : "Sin consentimiento expreso para llamadas comerciales"}
              </span>
            </div>

            {/* Formulario Añadir Nota Manual */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                Añadir nota al historial
              </label>
              <textarea
                value={newNoteBody}
                onChange={(e) => setNewNoteBody(e.target.value)}
                placeholder="Escribe una observación interna..."
                rows={2}
                className="field text-xs resize-none"
              />
              <button
                type="submit"
                disabled={isPending || !newNoteBody.trim()}
                className="btn btn-secondary text-xs py-1.5 w-full disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Guardar nota"}
              </button>
            </form>

            {/* Cronología Unificada */}
            <div>
              <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-3">
                Cronología de actividad
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedDetail.timeline.length === 0 ? (
                  <div className="text-xs text-stone-400 text-center py-4">Sin actividad registrada.</div>
                ) : (
                  selectedDetail.timeline.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-stone-900 dark:text-stone-200 flex items-center gap-1.5">
                          {item.type === "call" && <PhoneCall size={13} className="text-orange-600" />}
                          {item.type === "appointment" && <CalendarCheck size={13} className="text-blue-600" />}
                          {item.type === "note" && <ChatCircleText size={13} className="text-emerald-600" />}
                          {item.title}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(item.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-xs text-stone-600 dark:text-stone-400 whitespace-pre-wrap">
                        {item.description}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Lateral de Alta y Edición de Contacto */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-stone-200 dark:border-stone-800">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800 mb-5">
                <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {editingContact ? "Editar contacto" : "Nuevo contacto en CRM"}
                </h2>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {feedback && (
                <div
                  className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {feedback.type === "success" ? <CheckCircle size={16} /> : <WarningCircle size={16} />}
                  <span>{feedback.message}</span>
                </div>
              )}

              <form id="contactForm" onSubmit={handleSaveContact} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Javier Ruiz Gómez"
                    className="field"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Teléfono móvil (se normaliza a E.164)
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+34 600 12 34 56"
                    className="field font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="cliente@correo.es"
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Matrícula
                    </label>
                    <input
                      type="text"
                      value={formMatricula}
                      onChange={(e) => setFormMatricula(e.target.value.toUpperCase())}
                      placeholder="1234FGH"
                      className="field font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Vehículo / Modelo
                    </label>
                    <input
                      type="text"
                      value={formVehiculo}
                      onChange={(e) => setFormVehiculo(e.target.value)}
                      placeholder="Golf 2.0 TDI"
                      className="field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Estado
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="field"
                    >
                      <option value="lead">Cliente potencial (Lead)</option>
                      <option value="cliente">Cliente habitual</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      placeholder="Opcional"
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Etiquetas (separadas por comas)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="recurrente, itv, frenos"
                    className="field"
                  />
                </div>

                {!editingContact && (
                  <div>
                    <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Nota inicial
                    </label>
                    <textarea
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      placeholder="Anotación de apertura..."
                      rows={2}
                      className="field resize-none"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <label className="flex items-start gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formConsent}
                      onChange={(e) => setFormConsent(e.target.checked)}
                      className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span>
                      Cuenta con <strong>consentimiento RGPD/LSSI</strong> para recibir llamadas automatizadas de aviso o recordatorio.
                    </span>
                  </label>
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="btn btn-secondary text-xs py-2"
              >
                Cancelar
              </button>
              <button
                form="contactForm"
                type="submit"
                disabled={isPending}
                className="btn btn-primary text-xs py-2"
              >
                {isPending ? "Guardando..." : editingContact ? "Guardar cambios" : "Crear contacto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
