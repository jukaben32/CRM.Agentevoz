"use client";

import React, { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Storefront,
  Robot,
  Cpu,
  Wrench,
  Clock,
  Question,
  CloudArrowUp,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  Plus,
  Trash,
  Info,
} from "@phosphor-icons/react";
import { SearchSelect } from "@/components/ui/search-select";
import {
  saveBusinessAndAgentAction,
  saveAgentModelsAction,
  saveServiceAction,
  saveBusinessFactAction,
  deleteItemAction,
  publishAgentToVapi,
} from "@/lib/vapi/actions";
import {
  MODEL_CATALOG_DATA,
  estimateCostAndLatency,
  PLATFORM_FEE_PER_MIN,
} from "@/lib/vapi/model-catalog";
import { formatPhoneForDisplay } from "@/lib/phone";

interface AgentSettingsViewProps {
  business: any;
  agent: any;
  services: any[];
  hours: any[];
  facts: any[];
  effectivePrompt: string;
  isPromptOverride: boolean;
}

export function AgentSettingsView({
  business,
  agent,
  services,
  hours,
  facts,
  effectivePrompt,
  isPromptOverride,
}: AgentSettingsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 1. Información del Negocio
  const [name, setName] = useState(business.name || "");
  const [timezone, setTimezone] = useState(business.timezone || "America/Santo_Domingo");
  const [phone, setPhone] = useState(business.phone || "");
  const [email, setEmail] = useState(business.email || "");
  const [website, setWebsite] = useState(business.website || "");
  const [address, setAddress] = useState(business.address || "");

  // 2. Personalidad y Prompt
  const [tone, setTone] = useState(agent.tone || "cercano y resolutivo");
  const [firstMessage, setFirstMessage] = useState(agent.firstMessage || "");
  const [handoffNumber, setHandoffNumber] = useState(agent.handoffNumber || "");
  const [handoffMessage, setHandoffMessage] = useState(agent.handoffMessage || "");
  const [slotCapacity, setSlotCapacity] = useState(agent.slotCapacity || 1);
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(agent.minNoticeMinutes || 60);
  const [bookingHorizonDays, setBookingHorizonDays] = useState(agent.bookingHorizonDays || 14);

  const [promptText, setPromptText] = useState(effectivePrompt);
  const [isCustomPrompt, setIsCustomPrompt] = useState(isPromptOverride);

  // 3. Modelos del Agente
  const initialTranscriber = (agent.transcriber as any) || { provider: "deepgram", model: "nova-3-general", language: "es" };
  const initialModel = (agent.model as any) || { provider: "openai", model: "gpt-4.1-mini" };
  const initialVoice = {
    provider: agent.voiceProvider || "11labs",
    voiceId: agent.voiceId || "UOIqAnmS11Reiei1Ytkc",
    model: agent.voiceModel || "eleven_turbo_v2_5",
    language: agent.voiceLanguage || "es",
  };

  const [sttProvider, setSttProvider] = useState(initialTranscriber.provider || "deepgram");
  const [sttModel, setSttModel] = useState(initialTranscriber.model || "nova-3-general");
  const [sttLang, setSttLang] = useState(initialTranscriber.language || "es");

  const [llmProvider, setLlmProvider] = useState(initialModel.provider || "openai");
  const [llmModel, setLlmModel] = useState(initialModel.model || "gpt-4.1-mini");

  const [ttsProvider, setTtsProvider] = useState(initialVoice.provider || "11labs");
  const [ttsVoiceId, setTtsVoiceId] = useState(initialVoice.voiceId || "UOIqAnmS11Reiei1Ytkc");
  const [ttsModel, setTtsModel] = useState(initialVoice.model || "eleven_turbo_v2_5");
  const [ttsLang, setTtsLang] = useState(initialVoice.language || "es");

  // Modales y formularios de servicios / FAQ
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(60);
  const [newServicePrice, setNewServicePrice] = useState(89);

  const [newFactQ, setNewFactQ] = useState("");
  const [newFactA, setNewFactA] = useState("");

  // Cálculo en tiempo real de Estimaciones (Barras Apiladas)
  const currentEstimate = useMemo(() => {
    return estimateCostAndLatency(
      { provider: sttProvider, model: sttModel },
      { provider: llmProvider, model: llmModel },
      { provider: ttsProvider, model: ttsModel, voiceId: ttsVoiceId }
    );
  }, [sttProvider, sttModel, llmProvider, llmModel, ttsProvider, ttsModel, ttsVoiceId]);

  // Manejador Guardar Info y Personalidad
  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        await saveBusinessAndAgentAction({
          name,
          timezone,
          phone,
          email,
          website,
          address,
          tone,
          firstMessage,
          handoffNumber,
          handoffMessage,
          slotCapacity: Number(slotCapacity),
          minNoticeMinutes: Number(minNoticeMinutes),
          bookingHorizonDays: Number(bookingHorizonDays),
          promptOverride: isCustomPrompt ? promptText : null,
        });
        setFeedback({ type: "success", message: "Configuración e información del negocio guardadas." });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Error al guardar." });
      }
    });
  };

  // Manejador Guardar Modelos
  const handleSaveModels = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await saveAgentModelsAction({
          transcriber: { provider: sttProvider, model: sttModel || undefined, language: sttLang },
          model: { provider: llmProvider, model: llmModel },
          voice: { provider: ttsProvider, voiceId: ttsVoiceId, model: ttsModel || undefined, language: ttsLang },
        });
        setFeedback({ type: "success", message: "Selección de modelos guardada. Recuerda pulsar 'Publicar' para activarla en VAPI." });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Error al guardar modelos." });
      }
    });
  };

  // Manejador Publicar en VAPI
  const handlePublish = () => {
    if (!confirm("¿Deseas sincronizar y publicar los cambios en VAPI?")) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await publishAgentToVapi();
        setFeedback({ type: "success", message: `¡Asistente publicado con éxito en VAPI! ID: ${res.assistantId}` });
        router.refresh();
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "Error al publicar en VAPI." });
      }
    });
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    startTransition(async () => {
      await saveServiceAction({
        name: newServiceName.trim(),
        durationMinutes: Number(newServiceDuration),
        priceCents: Math.round(newServicePrice * 100),
        isActive: true,
      });
      setNewServiceName("");
      router.refresh();
    });
  };

  const handleAddFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactQ.trim() || !newFactA.trim()) return;
    startTransition(async () => {
      await saveBusinessFactAction({
        question: newFactQ.trim(),
        answer: newFactA.trim(),
      });
      setNewFactQ("");
      setNewFactA("");
      router.refresh();
    });
  };

  const handleDeleteItem = (type: "service" | "fact", id: string) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    startTransition(async () => {
      await deleteItemAction(type, id);
      router.refresh();
    });
  };

  // Opciones para desplegables de modelos
  const currentSttDef = MODEL_CATALOG_DATA.transcribers.find((t) => t.provider === sttProvider);
  const currentLlmDef = MODEL_CATALOG_DATA.models.find((m) => m.provider === llmProvider);
  const currentVoiceDef = MODEL_CATALOG_DATA.voices.find((v) => v.provider === ttsProvider);

  return (
    <div className="space-y-8 pb-12">
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

      {/* Botón Flotante / Destacado de Publicación */}
      <div className="card-saas p-6 bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border-orange-200 dark:border-orange-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <CloudArrowUp size={20} className="text-orange-600" />
            <span>Publicación en VAPI</span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {agent.publishedAt
              ? `Última sincronización: ${new Date(agent.publishedAt).toLocaleString("es-ES")}`
              : "Aún no se ha publicado este asistente en VAPI"}
          </p>
        </div>

        <button
          onClick={handlePublish}
          disabled={isPending}
          className="btn btn-primary text-xs py-2.5 px-6 flex items-center justify-center gap-2 shadow-sm"
        >
          {isPending ? (
            <>
              <ArrowsClockwise size={16} className="animate-spin" />
              <span>Sincronizando con VAPI...</span>
            </>
          ) : (
            <>
              <CloudArrowUp size={16} />
              <span>Publicar cambios en VAPI</span>
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSaveInfo} className="space-y-8">
        {/* 1 · Información del Negocio (§12 - Vista 5) */}
        <div className="card-saas p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
            <Storefront size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              1 · Información del taller mecánico
            </h2>
          </div>
          <p className="text-xs text-stone-500">
            Estos datos alimentan la dirección y vías de contacto que el agente recita cuando le preguntan.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Nombre del taller *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Zona horaria
              </label>
              <SearchSelect
                value={timezone}
                onChange={setTimezone}
                options={[
                  { value: "America/Santo_Domingo", label: "America/Santo_Domingo (República Dominicana)", isRecommended: true },
                  { value: "America/New_York", label: "America/New_York (EE. UU. Este)" },
                  { value: "America/Mexico_City", label: "America/Mexico_City" },
                  { value: "America/Bogota", label: "America/Bogota" },
                  { value: "America/Argentina/Buenos_Aires", label: "America/Buenos_Aires" },
                  { value: "Europe/Madrid", label: "Europe/Madrid (Península y Baleares)" },
                  { value: "Atlantic/Canary", label: "Atlantic/Canary (Islas Canarias)" },
                  { value: "Europe/Lisbon", label: "Europe/Lisbon (Portugal)" },
                  { value: "Europe/London", label: "Europe/London (UK)" },
                ]}
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Teléfono público del taller
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 910 00 00 00"
                className="field font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@taller.es"
                className="field"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Página web
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://taller.es"
                className="field"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Dirección física
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle del Motor 42, 28022 Madrid"
                className="field"
              />
            </div>
          </div>
        </div>

        {/* 2 · Personalidad y Editor de Prompt (§10.3 & §12) */}
        <div className="card-saas p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
            <Robot size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              2 · Personalidad del agente y System Prompt
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Tono de conversación
              </label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="cercano y resolutivo"
                className="field"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Capacidad simultánea de citas (Elevadores/Puestos)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={slotCapacity}
                onChange={(e) => setSlotCapacity(Number(e.target.value))}
                className="field"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Mensaje de bienvenida (firstMessage)
              </label>
              <input
                type="text"
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Número para transferencias (Handoff)
              </label>
              <input
                type="tel"
                value={handoffNumber}
                onChange={(e) => setHandoffNumber(e.target.value)}
                placeholder="+34 600 11 22 33"
                className="field font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 dark:text-stone-300 mb-1">
                Mensaje de transferencia
              </label>
              <input
                type="text"
                value={handoffMessage}
                onChange={(e) => setHandoffMessage(e.target.value)}
                className="field"
              />
            </div>
          </div>

          {/* Editor de Prompt con Modos Automático / Personalizado */}
          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                  System Prompt del Asistente
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isCustomPrompt
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-emerald-50 text-emerald-800 border-emerald-300"
                  }`}
                >
                  {isCustomPrompt ? "Modo Personalizado (Congelado)" : "Modo Automático (Recompuesto)"}
                </span>
              </div>

              {isCustomPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomPrompt(false);
                    setPromptText(effectivePrompt);
                  }}
                  className="text-xs text-orange-600 dark:text-orange-400 font-medium hover:underline cursor-pointer"
                >
                  Volver al automático
                </button>
              )}
            </div>

            {isCustomPrompt && (
              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <Info size={14} className="shrink-0" />
                <span>
                  Al editar el prompt manualmente, los cambios en horarios y catálogo no se actualizarán automáticamente en el texto.
                </span>
              </div>
            )}

            <textarea
              rows={12}
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                setIsCustomPrompt(true);
              }}
              className="field font-mono text-[11px] leading-relaxed resize-y"
            />
            <div className="text-[10px] text-stone-400 text-right">
              {promptText.length} caracteres
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={isPending} className="btn btn-primary text-xs py-2 px-5">
              {isPending ? "Guardando..." : "Guardar información y prompt"}
            </button>
          </div>
        </div>
      </form>

      {/* 3 · Modelos del Agente (Catálogo Editable §10.4) */}
      <div className="card-saas p-6 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              3 · Modelos de Inteligencia Artificial y Voz
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSaveModels}
            disabled={isPending}
            className="btn btn-secondary text-xs py-1.5 px-4"
          >
            Guardar modelos
          </button>
        </div>

        {/* 3 Cajas: STT, LLM, TTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Caja 1: Transcriptor (STT) */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3D5FA8]"></div>
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Modelo de Transcripción (STT)
              </span>
            </div>
            <p className="text-[11px] text-stone-500">Convierte en texto lo que dice el cliente por teléfono</p>

            <div className="space-y-2 text-xs">
              <label className="block font-medium text-stone-700 dark:text-stone-300">Proveedor</label>
              <SearchSelect
                value={sttProvider}
                onChange={(val) => {
                  setSttProvider(val);
                  const def = MODEL_CATALOG_DATA.transcribers.find((t) => t.provider === val);
                  if (def && def.models.length > 0) setSttModel(def.models[0]);
                }}
                options={MODEL_CATALOG_DATA.transcribers.map((t) => ({
                  value: t.provider,
                  label: t.name,
                  isRecommended: t.provider === "deepgram",
                }))}
              />

              <label className="block font-medium text-stone-700 dark:text-stone-300">Modelo</label>
              {currentSttDef && currentSttDef.models.length > 0 ? (
                <SearchSelect
                  value={sttModel}
                  onChange={setSttModel}
                  options={currentSttDef.models.map((m) => ({
                    value: m,
                    label: m,
                    isRecommended: m === "nova-3-general",
                  }))}
                />
              ) : (
                <input
                  type="text"
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value)}
                  placeholder="Modelo o preset del proveedor"
                  className="field text-xs font-mono"
                />
              )}
            </div>
          </div>

          {/* Caja 2: Modelo de IA (LLM) */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#E8490C]"></div>
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Modelo de Inteligencia Artificial (LLM)
              </span>
            </div>
            <p className="text-[11px] text-stone-500">Decide qué responder y cuándo agendar citas</p>

            <div className="space-y-2 text-xs">
              <label className="block font-medium text-stone-700 dark:text-stone-300">Proveedor</label>
              <SearchSelect
                value={llmProvider}
                onChange={(val) => {
                  setLlmProvider(val);
                  const def = MODEL_CATALOG_DATA.models.find((m) => m.provider === val);
                  if (def && def.models.length > 0) setLlmModel(def.models[0]);
                }}
                options={MODEL_CATALOG_DATA.models.map((m) => ({
                  value: m.provider,
                  label: m.name,
                  isRecommended: m.provider === "openai",
                }))}
              />

              <label className="block font-medium text-stone-700 dark:text-stone-300">Modelo</label>
              {currentLlmDef && currentLlmDef.models.length > 0 ? (
                <SearchSelect
                  value={llmModel}
                  onChange={setLlmModel}
                  options={currentLlmDef.models.map((m) => ({
                    value: m,
                    label: m,
                    isRecommended: m === "gpt-4.1-mini",
                  }))}
                />
              ) : (
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="ID exacto del modelo"
                  className="field text-xs font-mono"
                />
              )}
            </div>
          </div>

          {/* Caja 3: Modelo de Voz (TTS) */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#0D9488]"></div>
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Modelo y Voz (TTS)
              </span>
            </div>
            <p className="text-[11px] text-stone-500">La voz y entonación que escucha el cliente</p>

            <div className="space-y-2 text-xs">
              <label className="block font-medium text-stone-700 dark:text-stone-300">Proveedor</label>
              <SearchSelect
                value={ttsProvider}
                onChange={(val) => {
                  setTtsProvider(val);
                  const def = MODEL_CATALOG_DATA.voices.find((v) => v.provider === val);
                  if (def && def.presetVoices.length > 0) setTtsVoiceId(def.presetVoices[0].id);
                }}
                options={MODEL_CATALOG_DATA.voices.map((v) => ({
                  value: v.provider,
                  label: v.name,
                  isRecommended: v.provider === "11labs",
                }))}
              />

              <label className="block font-medium text-stone-700 dark:text-stone-300">Voz</label>
              {currentVoiceDef && currentVoiceDef.presetVoices.length > 0 ? (
                <SearchSelect
                  value={ttsVoiceId}
                  onChange={setTtsVoiceId}
                  options={currentVoiceDef.presetVoices.map((v) => ({
                    value: v.id,
                    label: v.name,
                    isRecommended: v.id === "UOIqAnmS11Reiei1Ytkc",
                  }))}
                />
              ) : (
                <input
                  type="text"
                  value={ttsVoiceId}
                  onChange={(e) => setTtsVoiceId(e.target.value)}
                  placeholder="voiceId exacto del proveedor"
                  className="field text-xs font-mono"
                />
              )}
            </div>
          </div>
        </div>

        {/* Estimación en Vivo con Barras Apiladas (§12 - Vista 5) */}
        <div className="p-5 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
              Estimación en tiempo real del Stack seleccionado
            </span>
            <span className="text-[11px] text-stone-500">Valores orientativos por minuto de llamada</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Barra Apilada de Coste */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600 dark:text-stone-400">Coste estimado:</span>
                <span className="font-bold text-sm text-stone-900 dark:text-stone-100 font-mono">
                  ${currentEstimate.totalCost} / min
                </span>
              </div>
              <div className="h-4 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                <div
                  style={{ width: `${(currentEstimate.sttCost / currentEstimate.totalCost) * 100}%` }}
                  className="h-full bg-[#3D5FA8] rounded-l-full"
                  title={`STT: $${currentEstimate.sttCost}/min`}
                />
                <div
                  style={{ width: `${(currentEstimate.llmCost / currentEstimate.totalCost) * 100}%` }}
                  className="h-full bg-[#E8490C]"
                  title={`LLM: $${currentEstimate.llmCost}/min`}
                />
                <div
                  style={{ width: `${(currentEstimate.ttsCost / currentEstimate.totalCost) * 100}%` }}
                  className="h-full bg-[#0D9488]"
                  title={`TTS: $${currentEstimate.ttsCost}/min`}
                />
                <div
                  style={{ width: `${(currentEstimate.platformFee / currentEstimate.totalCost) * 100}%` }}
                  className="h-full bg-[#78716C] rounded-r-full"
                  title={`Plataforma: $${currentEstimate.platformFee}/min`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-500">
                <span>STT: ${currentEstimate.sttCost}</span>
                <span>LLM: ${currentEstimate.llmCost}</span>
                <span>Voz: ${currentEstimate.ttsCost}</span>
                <span>Plat: ${currentEstimate.platformFee}</span>
              </div>
            </div>

            {/* Barra Apilada de Latencia */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600 dark:text-stone-400">Tiempo de respuesta estimado:</span>
                <span className="font-bold text-sm text-stone-900 dark:text-stone-100 font-mono">
                  ~{currentEstimate.totalLatency} ms
                </span>
              </div>
              <div className="h-4 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                <div
                  style={{ width: `${(currentEstimate.sttLatency / currentEstimate.totalLatency) * 100}%` }}
                  className="h-full bg-[#3D5FA8] rounded-l-full"
                  title={`STT: ${currentEstimate.sttLatency}ms`}
                />
                <div
                  style={{ width: `${(currentEstimate.llmLatency / currentEstimate.totalLatency) * 100}%` }}
                  className="h-full bg-[#E8490C]"
                  title={`LLM: ${currentEstimate.llmLatency}ms`}
                />
                <div
                  style={{ width: `${(currentEstimate.ttsLatency / currentEstimate.totalLatency) * 100}%` }}
                  className="h-full bg-[#0D9488] rounded-r-full"
                  title={`TTS: ${currentEstimate.ttsLatency}ms`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-500">
                <span>Transcriptor: {currentEstimate.sttLatency}ms</span>
                <span>IA: {currentEstimate.llmLatency}ms</span>
                <span>Voz: {currentEstimate.ttsLatency}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 · Catálogo de Servicios y Preguntas Frecuentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Servicios */}
        <div className="card-saas p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
            <Wrench size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Catálogo de Servicios del Taller
            </h2>
          </div>

          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-stone-900 dark:text-stone-100">{s.name}</div>
                  <div className="text-stone-500 text-[11px]">
                    {s.durationMinutes} min • {s.priceCents ? `RD$${(s.priceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Precio a consultar"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem("service", s.id)}
                  className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash size={15} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddService} className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2 text-xs">
            <span className="font-semibold text-stone-700 dark:text-stone-300 block">Añadir nuevo servicio</span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Nombre servicio"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="field col-span-2"
                required
              />
              <input
                type="number"
                placeholder="Precio RD$"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(Number(e.target.value))}
                className="field"
              />
            </div>
            <button type="submit" disabled={isPending} className="btn btn-secondary text-xs w-full py-1.5 flex items-center justify-center gap-1">
              <Plus size={14} />
              <span>Añadir servicio</span>
            </button>
          </form>
        </div>

        {/* Preguntas Frecuentes (FAQ) */}
        <div className="card-saas p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
            <Question size={18} className="text-orange-600" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Preguntas Frecuentes (FAQ del Taller)
            </h2>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {facts.map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-stone-900 dark:text-stone-100">P: {f.question}</div>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem("fact", f.id)}
                    className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash size={14} />
                  </button>
                </div>
                <div className="text-stone-600 dark:text-stone-400 text-[11px]">R: {f.answer}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddFact} className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2 text-xs">
            <span className="font-semibold text-stone-700 dark:text-stone-300 block">Añadir FAQ</span>
            <input
              type="text"
              placeholder="¿Pregunta frecuente?"
              value={newFactQ}
              onChange={(e) => setNewFactQ(e.target.value)}
              className="field"
              required
            />
            <input
              type="text"
              placeholder="Respuesta que dirá el agente..."
              value={newFactA}
              onChange={(e) => setNewFactA(e.target.value)}
              className="field"
              required
            />
            <button type="submit" disabled={isPending} className="btn btn-secondary text-xs w-full py-1.5 flex items-center justify-center gap-1">
              <Plus size={14} />
              <span>Añadir pregunta frecuente</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
