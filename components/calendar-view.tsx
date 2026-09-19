"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import {
  CaretLeft,
  CaretRight,
  Clock,
  User,
  PhoneCall,
  CalendarBlank,
  X,
  CheckCircle,
  WarningCircle,
  CircleNotch,
  ChatCircleText,
} from "@phosphor-icons/react";
import {
  APPOINTMENT_STATUS_LABELS,
  CREATED_VIA_LABELS,
  getStatusBadgeStyle,
} from "@/lib/labels";
import {
  updateAppointmentStatusAction,
  moveAppointmentAction,
  cancelAppointmentAction,
} from "@/lib/scheduling/actions";
import { formatPhoneForDisplay } from "@/lib/phone";

interface AppointmentItem {
  id: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  callId: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  createdVia: string;
}

interface CalendarViewProps {
  initialAppointments: AppointmentItem[];
  timezone: string;
  businessHours: Array<{ weekday: number; opensAt: string; closesAt: string; isClosed: boolean }>;
}

export function CalendarView({ initialAppointments, timezone, businessHours }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => DateTime.now().setZone(timezone));
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedApp, setSelectedApp] = useState<AppointmentItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Estados de edición rápida en la ficha
  const [newDateVal, setNewDateVal] = useState("");
  const [newTimeVal, setNewTimeVal] = useState("");

  const handlePrev = () => {
    if (viewMode === "week") setCurrentDate(currentDate.minus({ weeks: 1 }));
    else setCurrentDate(currentDate.minus({ months: 1 }));
  };

  const handleNext = () => {
    if (viewMode === "week") setCurrentDate(currentDate.plus({ weeks: 1 }));
    else setCurrentDate(currentDate.plus({ months: 1 }));
  };

  const handleToday = () => {
    setCurrentDate(DateTime.now().setZone(timezone));
  };

  // Calcular días de la semana actual (Lunes a Domingo)
  const startOfWeek = currentDate.startOf("week");
  const weekDays = Array.from({ length: 7 }, (_, i) => startOfWeek.plus({ days: i }));

  // Horas del día para rejilla semanal (08:00 a 20:00)
  const hoursGrid = Array.from({ length: 13 }, (_, i) => 8 + i);

  const handleStatusChange = (newStatus: string) => {
    if (!selectedApp) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        await updateAppointmentStatusAction(selectedApp.id, newStatus);
        setSelectedApp({ ...selectedApp, status: newStatus });
        setFeedback({ type: "success", message: `Estado actualizado a: ${APPOINTMENT_STATUS_LABELS[newStatus as keyof typeof APPOINTMENT_STATUS_LABELS] || newStatus}` });
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Error al actualizar estado." });
      }
    });
  };

  const handleReschedule = () => {
    if (!selectedApp || !newDateVal || !newTimeVal) return;
    setFeedback(null);
    startTransition(async () => {
      const newIso = `${newDateVal}T${newTimeVal}:00`;
      const res = await moveAppointmentAction(selectedApp.id, newIso);
      if (res.success) {
        setFeedback({ type: "success", message: "Cita reprogramada con éxito." });
      } else {
        setFeedback({ type: "error", message: res.error || "No se pudo reprogramar la cita." });
      }
    });
  };

  const handleCancel = () => {
    if (!selectedApp) return;
    if (!confirm("¿Seguro que deseas anular esta cita? El hueco quedará libre en la agenda.")) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await cancelAppointmentAction(selectedApp.id, "Anulada manualmente desde el panel");
      if (res.success) {
        setSelectedApp({ ...selectedApp, status: "anulada" });
        setFeedback({ type: "success", message: "Cita anulada correctamente." });
      } else {
        setFeedback({ type: "error", message: res.error || "Error al anular la cita." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra de Controles de la Agenda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 capitalize">
            {currentDate.setLocale("es").toFormat("LLLL yyyy")}
          </h2>
          <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-1">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-400 cursor-pointer"
            >
              <CaretLeft size={16} />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg cursor-pointer"
            >
              Hoy
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-400 cursor-pointer"
            >
              <CaretRight size={16} />
            </button>
          </div>
        </div>

        <div className="seg-container">
          <button
            onClick={() => setViewMode("week")}
            className={`seg-item ${viewMode === "week" ? "active" : ""}`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`seg-item ${viewMode === "month" ? "active" : ""}`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Rejilla Semanal */}
      {viewMode === "week" ? (
        <div className="card-saas overflow-hidden">
          <div className="grid grid-cols-8 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 text-xs font-semibold text-stone-600 dark:text-stone-400">
            <div className="p-3 text-center border-r border-stone-200 dark:border-stone-800">Hora</div>
            {weekDays.map((day) => {
              const isToday = day.hasSame(DateTime.now().setZone(timezone), "day");
              return (
                <div
                  key={day.toISO()}
                  className={`p-3 text-center border-r last:border-r-0 border-stone-200 dark:border-stone-800 ${
                    isToday ? "bg-orange-50/80 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 font-bold" : ""
                  }`}
                >
                  <div className="capitalize">{day.setLocale("es").toFormat("ccc")}</div>
                  <div className="text-sm text-stone-900 dark:text-stone-100">{day.day}</div>
                </div>
              );
            })}
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[620px] overflow-y-auto">
            {hoursGrid.map((hour) => (
              <div key={hour} className="grid grid-cols-8 min-h-[56px] text-xs">
                <div className="p-2 text-stone-400 text-right pr-3 font-mono border-r border-stone-100 dark:border-stone-800">
                  {hour < 10 ? `0${hour}:00` : `${hour}:00`}
                </div>

                {weekDays.map((day) => {
                  const dayStart = day.set({ hour, minute: 0, second: 0 });
                  const dayEnd = dayStart.plus({ hours: 1 });

                  // Filtrar citas que caen en este tramo
                  const slotApps = initialAppointments.filter((a) => {
                    const start = DateTime.fromISO(a.startsAt, { zone: timezone });
                    return start >= dayStart && start < dayEnd;
                  });

                  return (
                    <div
                      key={day.toISO()}
                      className="p-1 border-r last:border-r-0 border-stone-100 dark:border-stone-800 relative hover:bg-stone-50/50 dark:hover:bg-stone-900/30 transition-colors"
                    >
                      {slotApps.map((app) => {
                        const badgeStyle = getStatusBadgeStyle(app.status);
                        return (
                          <button
                            key={app.id}
                            onClick={() => setSelectedApp(app)}
                            className="w-full text-left p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/80 hover:border-orange-400 transition-all cursor-pointer shadow-xs"
                          >
                            <div className="text-[11px] font-semibold text-orange-950 dark:text-orange-200 truncate">
                              {app.serviceName}
                            </div>
                            <div className="text-[10px] text-stone-600 dark:text-stone-400 truncate">
                              {app.contactName || "Sin nombre"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Vista Mensual */
        <div className="card-saas p-6 texture-stripes text-center text-xs text-stone-500">
          Rejilla mensual compacta de citas del taller. Selecciona la vista semanal para detalle por horas.
        </div>
      )}

      {/* Drawer / Ficha Lateral Detallada de la Cita (§12 - Vista 2) */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto border-l border-stone-200 dark:border-stone-800">
            <div className="space-y-6">
              {/* Cabecera con Botón Cerrar */}
              <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Ficha de la Cita
                </span>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === "success"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {feedback.type === "success" ? <CheckCircle size={16} /> : <WarningCircle size={16} />}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* 1. Cabecera Destacada de Fecha y Duración Calculada */}
              {(() => {
                const s = DateTime.fromISO(selectedApp.startsAt, { zone: timezone });
                const e = DateTime.fromISO(selectedApp.endsAt, { zone: timezone });
                const durMin = Math.round(e.diff(s, "minutes").minutes);
                const durText = durMin >= 60 ? `${Math.floor(durMin / 60)} h${durMin % 60 ? ` ${durMin % 60}m` : ""}` : `${durMin} min`;

                return (
                  <div className="p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60">
                    <div className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                      Servicio: {selectedApp.serviceName}
                    </div>
                    <div className="text-base font-bold text-stone-900 dark:text-stone-100 mt-1 capitalize">
                      {s.setLocale("es").toFormat("cccc, d 'de' LLLL")}
                    </div>
                    <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>{s.toFormat("HH:mm")} – {e.toFormat("HH:mm")} · {durText}</span>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Filas de Datos Etiquetadas */}
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-stone-500">Estado actual</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-medium border ${getStatusBadgeStyle(
                      selectedApp.status
                    ).bg} ${getStatusBadgeStyle(selectedApp.status).text} ${getStatusBadgeStyle(selectedApp.status).border}`}
                  >
                    {APPOINTMENT_STATUS_LABELS[selectedApp.status as keyof typeof APPOINTMENT_STATUS_LABELS] || selectedApp.status}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-stone-500">Cliente</span>
                  <div>
                    {selectedApp.contactId ? (
                      <Link
                        href={`/contactos?id=${selectedApp.contactId}`}
                        className="text-orange-600 dark:text-orange-400 font-medium hover:underline"
                      >
                        {selectedApp.contactName || "Ver ficha"}
                      </Link>
                    ) : (
                      <span className="text-stone-800 dark:text-stone-200">{selectedApp.contactName || "—"}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-stone-500">Teléfono</span>
                  <span className="font-mono text-stone-800 dark:text-stone-200">
                    {formatPhoneForDisplay(selectedApp.contactPhone)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-stone-500">Origen de reserva</span>
                  <span className="font-medium text-stone-800 dark:text-stone-200">
                    {CREATED_VIA_LABELS[selectedApp.createdVia as keyof typeof CREATED_VIA_LABELS] || selectedApp.createdVia}
                  </span>
                </div>

                {selectedApp.callId && (
                  <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-stone-800">
                    <span className="text-stone-500">Llamada asociada</span>
                    <Link
                      href={`/conversaciones?id=${selectedApp.callId}`}
                      className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <PhoneCall size={14} />
                      <span>Ver transcripción</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* 3. Notas en su bloque dedicado */}
              <div>
                <span className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Notas de la cita
                </span>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                  {selectedApp.notes || "Sin observaciones adicionales."}
                </div>
              </div>

              {/* 4. Cambiar Fecha y Hora desde la propia ficha */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-3">
                <span className="block text-xs font-semibold text-stone-900 dark:text-stone-100">
                  Mover o reprogramar cita
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newDateVal}
                    onChange={(e) => setNewDateVal(e.target.value)}
                    className="field text-xs"
                  />
                  <input
                    type="time"
                    value={newTimeVal}
                    onChange={(e) => setNewTimeVal(e.target.value)}
                    className="field text-xs"
                  />
                </div>
                <button
                  type="button"
                  disabled={isPending || !newDateVal || !newTimeVal}
                  onClick={handleReschedule}
                  className="btn btn-secondary w-full text-xs py-2 disabled:opacity-50"
                >
                  {isPending ? "Validando hueco..." : "Guardar nueva hora"}
                </button>
              </div>
            </div>

            {/* Acciones de Estado y Botón Anular */}
            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange("confirmada")}
                  disabled={isPending}
                  className="btn btn-secondary text-xs py-2"
                >
                  Marcar Confirmada
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange("completada")}
                  disabled={isPending}
                  className="btn btn-secondary text-xs py-2"
                >
                  Marcar Completada
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange("no_show")}
                  disabled={isPending}
                  className="btn btn-secondary text-xs py-2 text-stone-600"
                >
                  No presentado
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isPending}
                  className="btn btn-danger text-xs py-2"
                >
                  Anular cita
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
