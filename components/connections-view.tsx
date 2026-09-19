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
          className={`p-4 rounded-2xl text-xs flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle size={18} /> : <WarningCircle size={18} />}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-stone-600">
            ×
          </button>
        </div>
      )}

      {/* 1. Comparador de Server URL (§12 - Vista 6) */}
      <div className="card-saas p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Comparador de Server URL (Webhook)
            </h2>
          </div>
          <button
            onClick={handleRealignUrls}
            disabled={isPending}
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <ArrowsClockwise size={14} className={isPending ? "animate-spin" : ""} />
            <span>Re-alinear con APP_URL</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[11px] font-semibold text-stone-500">URL derivada de la plataforma (APP_URL):</span>
            <div className="font-mono text-stone-900 dark:text-stone-100 font-medium break-all">
              {expectedWebhookUrl}
            </div>
            <div className="text-[10px] text-stone-400 pt-1">
              Es la ruta pública donde VAPI envía las peticiones de herramientas y los reportes de llamada.
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-1">
            <span className="text-[11px] font-semibold text-stone-500">Prueba de conectividad inmediata:</span>
            <div>
              <button
                onClick={handleTestPing}
                disabled={isPending}
                className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 mt-1"
              >
                <Lightning size={14} />
                <span>Enviar Ping a la aplicación</span>
              </button>
            </div>
            {pingResult && (
              <div className="pt-2 text-[11px]">
                {pingResult.success ? (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle size={14} /> Conexión con webhook verificada correctamente (status: ok)
                  </span>
                ) : (
                  <span className="text-rose-600 font-medium flex items-center gap-1">
                    <WarningCircle size={14} /> Error de ping: {pingResult.error}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Estado de Asistente y Número de VAPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Asistente */}
        <div className="card-saas p-6 space-y-4 flex flex-col justify-between">
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
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
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
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
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
      <div className="card-saas p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Tools Compartidas de la Plataforma
            </h2>
          </div>
          <span className="text-xs text-stone-500">{tools.length} herramientas registradas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 font-semibold">
                <th className="py-2.5">Nombre de la herramienta</th>
                <th className="py-2.5">VAPI Tool ID</th>
                <th className="py-2.5">Checksum</th>
                <th className="py-2.5 text-right">Sincronizada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {tools.map((t) => (
                <tr key={t.name}>
                  <td className="py-2.5 font-mono font-medium text-stone-900 dark:text-stone-100">
                    {t.name}
                  </td>
                  <td className="py-2.5 font-mono text-stone-500">{t.vapiToolId}</td>
                  <td className="py-2.5 font-mono text-stone-400">{t.checksum}</td>
                  <td className="py-2.5 text-right text-stone-500">
                    {new Date(t.syncedAt).toLocaleDateString("es-ES")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
