/**
 * Stack de modelos por defecto y obligatorio (§10.1)
 * 
 * Verificado contra la API de VAPI:
 * - Transcriptor: Deepgram Nova 3 General (Español) - ~320ms, ~$0.01/min
 * - LLM: OpenAI GPT 5.6 Luna - ~800ms, ~$0.01/min
 * - Voz: ElevenLabs Eleven Turbo v2.5 con voiceId UOIqAnmS11Reiei1Ytkc ("Carolina") - ~490ms, ~$0.036/min
 * 
 * Presupuesto de referencia: ≈ $0.11/min y ≈ 1.610ms de latencia total.
 */
export const DEFAULT_VAPI_CONFIG = {
  transcriber: {
    provider: "deepgram",
    model: "nova-3-general",
    language: "es",
  },
  model: {
    provider: "openai",
    model: "gpt-5.6-luna",
  },
  voice: {
    provider: "11labs",
    voiceId: "UOIqAnmS11Reiei1Ytkc",
    model: "eleven_turbo_v2_5",
    language: "es",
  },
  voiceDisplayName: "Carolina (Recomendada - Cálida y Profesional)",
  platformFeeCentsPerMin: 5, // $0.05/min de cuota base de plataforma de voz
} as const;
