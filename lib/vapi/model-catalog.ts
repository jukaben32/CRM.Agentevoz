import { VAPI_GENERATED_CATALOG, VapiCatalogData } from "./catalog-data.generated";

export interface ProviderOption {
  value: string;
  label: string;
  isRecommended?: boolean;
}

export interface ModelOption {
  value: string;
  label: string;
  costPerMin: number;
  latencyMs: number;
  isRecommended?: boolean;
  notes?: string;
}

export interface VoiceOption {
  value: string;
  label: string;
  costPerMin: number;
  latencyMs: number;
  isRecommended?: boolean;
}

export interface StackEstimate {
  sttCost: number;
  llmCost: number;
  ttsCost: number;
  platformFee: number;
  totalCost: number;

  sttLatency: number;
  llmLatency: number;
  ttsLatency: number;
  totalLatency: number;
}

export const PLATFORM_FEE_PER_MIN = 0.05; // Cuota fija de VAPI de $0.05/min

/**
 * Estimador de costes y latencia por modelo/proveedor
 */
export function estimateCostAndLatency(
  stt: { provider: string; model?: string },
  llm: { provider: string; model?: string },
  tts: { provider: string; model?: string; voiceId?: string }
): StackEstimate {
  // 1. Transcriptor (STT)
  let sttCost = 0.01;
  let sttLatency = 320;
  if (stt.provider === "deepgram") {
    sttCost = 0.01;
    sttLatency = stt.model?.includes("nova-3") ? 300 : 350;
  } else if (stt.provider === "assemblyai") {
    sttCost = 0.015;
    sttLatency = 450;
  } else if (stt.provider === "azure") {
    sttCost = 0.018;
    sttLatency = 400;
  } else if (stt.provider === "gladia") {
    sttCost = 0.013;
    sttLatency = 380;
  }

  // 2. Modelo de Lenguaje (LLM)
  let llmCost = 0.01;
  let llmLatency = 800;
  if (llm.provider === "openai") {
    if (llm.model?.includes("5.6-luna")) {
      llmCost = 0.01;
      llmLatency = 800;
    } else if (llm.model?.includes("4o-mini")) {
      llmCost = 0.005;
      llmLatency = 600;
    } else if (llm.model?.includes("4o")) {
      llmCost = 0.03;
      llmLatency = 950;
    }
  } else if (llm.provider === "anthropic") {
    llmCost = llm.model?.includes("haiku") ? 0.012 : 0.035;
    llmLatency = llm.model?.includes("haiku") ? 650 : 900;
  } else if (llm.provider === "groq") {
    llmCost = 0.005;
    llmLatency = 320;
  } else if (llm.provider === "google") {
    llmCost = 0.006;
    llmLatency = 500;
  }

  // 3. Modelo de Voz (TTS)
  let ttsCost = 0.036;
  let ttsLatency = 490;
  if (tts.provider === "11labs") {
    ttsCost = tts.model?.includes("flash") ? 0.025 : 0.036;
    ttsLatency = tts.model?.includes("flash") ? 380 : 490;
  } else if (tts.provider === "cartesia") {
    ttsCost = 0.025;
    ttsLatency = 300;
  } else if (tts.provider === "azure") {
    ttsCost = 0.02;
    ttsLatency = 380;
  } else if (tts.provider === "vapi") {
    ttsCost = 0.015;
    ttsLatency = 250;
  } else if (tts.provider === "playht") {
    ttsCost = 0.03;
    ttsLatency = 420;
  }

  const platformFee = PLATFORM_FEE_PER_MIN;
  const totalCost = Number((sttCost + llmCost + ttsCost + platformFee).toFixed(3));
  const totalLatency = Math.round(sttLatency + llmLatency + ttsLatency);

  return {
    sttCost,
    llmCost,
    ttsCost,
    platformFee,
    totalCost,
    sttLatency,
    llmLatency,
    ttsLatency,
    totalLatency,
  };
}

export const MODEL_CATALOG_DATA = VAPI_GENERATED_CATALOG;
