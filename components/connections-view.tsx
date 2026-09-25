"use client";

import React, { useState, useTransition } from "react";
import {
  PlugsConnected,
  CheckCircle,
  WarningCircle,
  ArrowRight,
  ArrowsClockwise,
  Globe,
  Phone,
  Wrench,
  ShieldCheck,
  Lightning,
} from "@phosphor-icons/react";
import { testWebhookPingAction, realignServerUrlAction } from "@/lib/vapi/connections-actions";
import { publishAgentToVapi } from "@/lib/vapi/actions";

interface ConnectionsViewProps {
  agent: any;
  tools: any[];
  appUrl: string;
}

export function ConnectionsView({ agent, tools, appUrl }: ConnectionsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [pingResult, setPingResult] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const expectedWebhookUrl = `${appUrl}/api/vapi/webhook`;

  const handleTestPing = () => {
    setPingResult(null);
    startTransition(async () => {
      const res = await testWebhookPingAction();
      setPingResult(res);
    });
  };

  const handleRealignUrls = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await realignServerUrlAction();
        setFeedback({
          type: "success",
          message: `server.url del asistente y las tools re-alineado con éxito a: ${expectedWebhookUrl}`,
        });
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Error al re-alinear URLs." });
      }
    });
  };

  const handlePublish = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await publishAgentToVapi();
        setFeedback({ type: "success", message: `Asistente provisionado y sincronizado con VAPI. ID: ${res.assistantId}` });
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Error al provisionar en VAPI." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3 md:p-4 rounded-xl md:rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            {feedback.type === "success" ? <CheckCircle size={18} className="flex-shrink-0 mt-0.5 sm:mt-0" /> : <WarningCircle size={18} className="flex-shrink-0 mt-0.5 sm:mt-0" />}
            <span className="font-medium text-xs leading-tight break-words">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer flex-shrink-0 self-start sm:self-center">
            ×
          </button>
        </div>
      )}

      {/* 1. Comparador de Server URL (§12 - Vista 6) */}
      <div className="card-saas p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2 min-w-0">
            <Globe size={18} className="text-orange-600 flex-shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
              Comparador de Server URL (Webhook)
            </h2>
          </div>
          <button
            onClick={handleRealignUrls}
            disabled={isPending}
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
          >
            <ArrowsClockwise size={14} className={isPending ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Re-alinear</span>
            <span className="sm:hidden">Re-alinear URL</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 text-xs">
          <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[10px] md:text-[11px] font-semibold text-stone-500 line-clamp-2">URL derivada de plataforma (APP_URL):</span>
            <div className="font-mono text-stone-900 dark:text-stone-100 font-medium break-all text-[10px] md:text-xs">
              {expectedWebhookUrl}
            </div>
            <div className="text-[9px] md:text-[10px] text-stone-400 pt-1">
              Ruta pública donde VAPI envía peticiones y reportes.
            </div>
          </div>

          <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[10px] md:text-[11px] font-semibold text-stone-500">Prueba de conectividad:</span>
            <div>
              <button
                onClick={handleTestPing}
                disabled={isPending}
                className="btn btn-primary text-xs py-1 px-2 md:py-1.5 md:px-3 flex items-center gap-1 mt-1 whitespace-nowrap text-[10px] md:text-xs"
              >
                <Lightning size={12} className="md:w-4 md:h-4" />
                <span className="hidden sm:inline">Enviar Ping</span>
                <span className="sm:hidden">Ping</span>
              </button>
            </div>
            {pingResult && (
              <div className="pt-2 text-[9px] md:text-[11px]">
                {pingResult.success ? (
                  <span className="text-emerald-600 font-medium flex items-start gap-1">
                    <CheckCircle size={12} className="flex-shrink-0 mt-0.5 md:w-4 md:h-4" /> Conexión verificada (status: ok)
                  </span>
                ) : (
                  <span className="text-rose-600 font-medium flex items-start gap-1">
                    <WarningCircle size={12} className="flex-shrink-0 mt-0.5 md:w-4 md:h-4" /> Error: {pingResult.error}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Estado de Asistente y Número de VAPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        {/* Asistente */}
        <div className="card-saas p-4 md:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
              <PlugsConnected size={18} className="text-orange-600" />
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Asistente de Voz en VAPI
              </h2>
            </div>

            <div className="space-y-3 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Estado</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    agent?.vapiAssistantId
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  }`}
                >
                  {agent?.vapiAssistantId ? "Provisionado en VAPI" : "Pendiente de creación"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-500">Assistant ID</span>
                <span className="font-mono text-stone-800 dark:text-stone-200 text-[11px]">
                  {agent?.vapiAssistantId || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-500">Última sincronización</span>
                <span className="text-stone-800 dark:text-stone-200 text-[11px]">
                  {agent?.publishedAt ? new Date(agent.publishedAt).toLocaleString("es-ES") : "Nunca"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="btn btn-primary text-xs w-full py-2 flex items-center justify-center gap-1.5"
            >
              <ArrowsClockwise size={14} className={isPending ? "animate-spin" : ""} />
              <span>{agent?.vapiAssistantId ? "Re-sincronizar Asistente" : "Provisionar Asistente"}</span>
            </button>
          </div>
        </div>

        {/* Teléfono */}
        <div className="card-saas p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
              <Phone size={18} className="text-orange-600" />
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Línea Telefónica de Entrada
              </h2>
            </div>

            <div className="space-y-3 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Estado</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    agent?.vapiPhoneNumberId
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  }`}
                >
                  {agent?.vapiPhoneNumberId ? "Número Vinculado" : "Sin número asociado"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-500">Phone Number ID</span>
                <span className="font-mono text-stone-800 dark:text-stone-200 text-[11px]">
                  {agent?.vapiPhoneNumberId || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 text-[11px] text-stone-600 dark:text-stone-400">
            💡 En España, importa tu número español (Twilio / Telnyx / Vonage) en el panel de VAPI y vincúlalo mediante su UUID.
          </div>
        </div>
      </div>

      {/* 3. Tools Compartidas en VAPI */}
      <div className="card-saas p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2 min-w-0">
            <Wrench size={18} className="text-orange-600 flex-shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
              Tools Compartidas
            </h2>
          </div>
          <span className="text-xs text-stone-500 flex-shrink-0">{tools.length} herramientas</span>
        </div>

        {tools.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-stone-500">No hay herramientas registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 font-semibold">
                  <th className="py-2.5 px-2 md:px-0">Nombre</th>
                  <th className="py-2.5 px-2 md:px-0 hidden sm:table-cell">VAPI ID</th>
                  <th className="py-2.5 px-2 md:px-0 hidden md:table-cell">Checksum</th>
                  <th className="py-2.5 px-2 md:px-0 text-right">Sincronizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {tools.map((t) => (
                  <tr key={t.name}>
                    <td className="py-2.5 px-2 md:px-0 font-mono font-medium text-stone-900 dark:text-stone-100 max-w-xs truncate">
                      {t.name}
                    </td>
                    <td className="py-2.5 px-2 md:px-0 font-mono text-stone-500 hidden sm:table-cell max-w-xs truncate text-[10px]">
                      {t.vapiToolId}
                    </td>
                    <td className="py-2.5 px-2 md:px-0 font-mono text-stone-400 hidden md:table-cell max-w-xs truncate text-[10px]">
                      {t.checksum}
                    </td>
                    <td className="py-2.5 px-2 md:px-0 text-right text-stone-500 text-[10px] md:text-xs whitespace-nowrap">
                      {t.syncedAt ? new Date(t.syncedAt).toLocaleDateString("es-ES") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
