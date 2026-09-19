"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import {
  MagnifyingGlass,
  PhoneCall,
  User,
  Robot,
  CalendarCheck,
  Clock,
  CurrencyDollar,
  Play,
  ArrowSquareOut,
  Waveform,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  CALL_STATUS_LABELS,
  formatEndedReason,
  getStatusBadgeStyle,
} from "@/lib/labels";
import { formatPhoneForDisplay } from "@/lib/phone";

interface CallItem {
  id: string;
  vapiCallId: string;
  direction: string;
  fromNumber: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  status: string;
  endedReason: string | null;
  summary: string | null;
  costCents: number;
  recordingUrl: string | null;
  needsReview: boolean;
  contactId: string | null;
  contactName: string | null;
}

interface MessageItem {
  id: string;
  role: "assistant" | "user" | "tool" | "system";
  content: string;
  secondsFromStart: number | null;
  sortOrder: number;
}

interface ConversationsViewProps {
  callsList: CallItem[];
  selectedCallDetail?: {
    call: CallItem;
    messages: MessageItem[];
    appointment?: any | null;
  } | null;
  timezone: string;
}

export function ConversationsView({
  callsList,
  selectedCallDetail,
  timezone,
}: ConversationsViewProps) {
  const [search, setSearch] = useState("");

  const filteredCalls = callsList.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (c.contactName && c.contactName.toLowerCase().includes(term)) ||
      (c.fromNumber && c.fromNumber.includes(term)) ||
      (c.summary && c.summary.toLowerCase().includes(term))
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de Conversaciones (1 columna en split) */}
      <div className="card-saas p-5 space-y-4 lg:col-span-1 h-[720px] flex flex-col">
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en resúmenes o teléfonos..."
            className="field pl-9 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 pr-1">
          {filteredCalls.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              No hay llamadas que coincidan con la búsqueda.
            </div>
          ) : (
            filteredCalls.map((c) => {
              const isSelected = selectedCallDetail?.call.id === c.id;
              const dateStr = c.startedAt
                ? DateTime.fromISO(c.startedAt, { zone: timezone }).toFormat("dd LLL, HH:mm")
                : "—";

              return (
                <Link
                  key={c.id}
                  href={`/conversaciones?id=${c.id}`}
                  className={`block p-3.5 rounded-xl transition-all ${
                    isSelected
                      ? "bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/80"
                      : "hover:bg-stone-50 dark:hover:bg-stone-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-xs text-stone-900 dark:text-stone-100 truncate">
                      {c.contactName || formatPhoneForDisplay(c.fromNumber)}
                    </span>
                    <span className="text-[10px] text-stone-400 shrink-0">{dateStr}</span>
                  </div>

                  <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                    {c.summary || (c.contactName ? formatPhoneForDisplay(c.fromNumber) : "Llamada sin resumen disponible")}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100 dark:border-stone-800/60 text-[10px] text-stone-400">
                    <span>
                      {Math.floor((c.durationSeconds || 0) / 60)}m {(c.durationSeconds || 0) % 60}s
                    </span>
                    <span className="font-mono text-stone-600 dark:text-stone-300">
                      ${((c.costCents || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Detalle de Conversación y Transcripción (2 columnas) */}
      <div className="card-saas p-6 lg:col-span-2 h-[720px] flex flex-col justify-between overflow-hidden">
        {selectedCallDetail ? (
          <div className="flex flex-col h-full space-y-6">
            {/* Cabecera de la Conversación */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {selectedCallDetail.call.contactName ||
                      formatPhoneForDisplay(selectedCallDetail.call.fromNumber)}
                  </h2>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      getStatusBadgeStyle(selectedCallDetail.call.status).bg
                    } ${getStatusBadgeStyle(selectedCallDetail.call.status).text} ${
                      getStatusBadgeStyle(selectedCallDetail.call.status).border
                    }`}
                  >
                    {CALL_STATUS_LABELS[
                      selectedCallDetail.call.status as keyof typeof CALL_STATUS_LABELS
                    ] || selectedCallDetail.call.status}
                  </span>
                </div>
                <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-3">
                  <span>
                    {selectedCallDetail.call.startedAt
                      ? DateTime.fromISO(selectedCallDetail.call.startedAt, { zone: timezone }).toFormat(
                          "cccc, d 'de' LLLL 'a las' HH:mm"
                        )
                      : "—"}
                  </span>
                  <span>•</span>
                  <span>
                    Duración: {Math.floor((selectedCallDetail.call.durationSeconds || 0) / 60)}m{" "}
                    {(selectedCallDetail.call.durationSeconds || 0) % 60}s
                  </span>
                  <span>•</span>
                  <span className="font-mono font-medium text-stone-700 dark:text-stone-300">
                    Coste: ${((selectedCallDetail.call.costCents || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {selectedCallDetail.call.contactId && (
                <Link
                  href={`/contactos?id=${selectedCallDetail.call.contactId}`}
                  className="btn btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                >
                  <User size={14} />
                  <span>Ver en CRM</span>
                </Link>
              )}
            </div>

            {/* Resumen IA y Reproductor de Audio (§14.1) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Resumen de VAPI */}
              <div className="md:col-span-2 p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40">
                <div className="text-xs font-semibold text-orange-900 dark:text-orange-300 mb-1 flex items-center gap-1.5">
                  <Robot size={15} />
                  <span>Resumen de la llamada</span>
                </div>
                <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                  {selectedCallDetail.call.summary ||
                    "Esta llamada no tiene resumen generado (puede haberse realizado antes de activar el plan de resúmenes)."}
                </p>
                <div className="text-[11px] text-stone-500 mt-2">
                  Motivo de fin:{" "}
                  <strong>{formatEndedReason(selectedCallDetail.call.endedReason)}</strong>
                </div>
              </div>

              {/* Reproductor de Audio Firmado con preload="metadata" */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 flex flex-col justify-between">
                <div className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2 flex items-center gap-1.5">
                  <Waveform size={15} />
                  <span>Grabación de audio</span>
                </div>
                {selectedCallDetail.call.recordingUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={`/api/calls/${selectedCallDetail.call.id}/recording`}
                    className="w-full h-8"
                  />
                ) : (
                  <div className="text-[11px] text-stone-400">Grabación no disponible.</div>
                )}
              </div>
            </div>

            {/* Transcripción Turno a Turno (§14.1: solo diálogos en voz alta) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Transcripción del diálogo
              </h3>

              {selectedCallDetail.messages.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400">
                  No hay mensajes transcritos para esta conversación.
                </div>
              ) : (
                selectedCallDetail.messages.map((m) => {
                  const isAssistant = m.role === "assistant";
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
                    >
                      {isAssistant && (
                        <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                          IA
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isAssistant
                            ? "bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                            : "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-normal"
                        }`}
                      >
                        <div className="text-[10px] font-semibold mb-1 opacity-70">
                          {isAssistant ? "Agente Virtual" : "Cliente"}
                          {m.secondsFromStart !== null && ` • +${m.secondsFromStart}s`}
                        </div>
                        <div>{m.content}</div>
                      </div>
                      {!isAssistant && (
                        <div className="w-7 h-7 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                          <User size={14} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 p-8 texture-stripes rounded-2xl">
            <PhoneCall size={36} className="mb-2 text-stone-300 dark:text-stone-700" />
            <div className="text-sm font-semibold text-stone-700 dark:text-stone-300">
              Ninguna conversación seleccionada
            </div>
            <div className="text-xs text-stone-400 mt-1">
              Selecciona una llamada del listado izquierdo para ver la transcripción y escuchar el audio.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
