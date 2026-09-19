"use client";

import React, { useState, useTransition } from "react";
import {
  Code,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  Clock,
  ArrowRight,
  Eye,
  Terminal,
} from "@phosphor-icons/react";

interface WebhookEventItem {
  id: string;
  eventType: string;
  externalId: string;
  payload: any;
  processedAt: string;
  error: string | null;
}

interface WebhookInspectorProps {
  events: WebhookEventItem[];
}

export function WebhookInspector({ events }: WebhookInspectorProps) {
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventItem | null>(events[0] || null);
  const [isPending, startTransition] = useTransition();
  const [replayResult, setReplayResult] = useState<any | null>(null);

  const handleReplay = (id: string) => {
    setReplayResult(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/dev/webhooks/${id}/replay`, { method: "POST" });
        const data = await res.json();
        setReplayResult(data);
      } catch (err: any) {
        setReplayResult({ error: err.message || "Error al conectar con endpoint de replay." });
      }
    });
  };

  const formatDate = (iso: string) => {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#201E1C]">Inspector de Webhooks</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              Dev Tools
            </span>
          </div>
          <p className="text-sm text-[#736E68]">
            Historial de eventos y llamadas recibidas desde VAPI con capacidad de inspección y reejecución (replay).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Eventos */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E4E1DC] overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-[#E4E1DC] bg-[#FAF9F7] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#736E68]">
              Eventos Registrados ({events.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E4E1DC]">
            {events.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#736E68]">
                No se han registrado eventos webhook todavía. Realiza una llamada de prueba para ver los eventos aquí.
              </div>
            ) : (
              events.map((evt) => {
                const isSelected = selectedEvent?.id === evt.id;
                return (
                  <button
                    key={evt.id}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setReplayResult(null);
                    }}
                    className={`w-full text-left p-4 transition flex flex-col gap-1.5 ${
                      isSelected ? "bg-[#F2F1EE] border-l-4 border-l-[#E8490C]" : "hover:bg-[#FAF9F7]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#201E1C] truncate max-w-[200px]">
                        {evt.eventType}
                      </span>
                      {evt.error ? (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          OK
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#736E68] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#A8A29A]" />
                      <span>{formatDate(evt.processedAt)}</span>
                    </div>
                    <div className="text-[10px] text-[#A8A29A] font-mono truncate">
                      ID: {evt.externalId}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detalle del Payload & Replay */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E4E1DC] overflow-hidden flex flex-col h-[700px]">
          {selectedEvent ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-[#E4E1DC] bg-[#FAF9F7] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-[#201E1C]">{selectedEvent.eventType}</h3>
                  <p className="text-[11px] text-[#736E68] font-mono">ID: {selectedEvent.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReplay(selectedEvent.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#201E1C] text-white text-xs font-semibold hover:bg-black transition disabled:opacity-50"
                  >
                    <ArrowsClockwise className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                    {isPending ? "Reejecutando..." : "Replay (Reejecutar)"}
                  </button>
                </div>
              </div>

              {replayResult && (
                <div
                  className={`p-4 border-b text-xs font-mono ${
                    replayResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  <div className="font-bold mb-1">
                    Resultado Replay ({replayResult.status || "Error"}):
                  </div>
                  <pre className="text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {JSON.stringify(replayResult, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.error && (
                <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-800">
                  <strong>Error registrado:</strong> {selectedEvent.error}
                </div>
              )}

              <div className="flex-1 p-4 bg-[#1E1E1E] text-emerald-400 font-mono text-xs overflow-auto">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-sm text-[#736E68]">
              Selecciona un evento de la lista para inspeccionar su payload JSON.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
