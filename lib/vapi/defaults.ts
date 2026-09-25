/**
 * Stack de modelos por defecto y obligatorio (§10.1)
 *
 * Verificado contra la API de VAPI:
 * - Transcriptor: Deepgram Nova 3 General (Español) - ~320ms, ~$0.01/min
 * - LLM: OpenAI GPT-4.1 Mini - ~800ms, ~$0.01/min
 * - Voz: ElevenLabs Eleven Flash v2.5 con voiceId UOIqAnmS11Reiei1Ytkc ("Carolina") - ~75ms, ~$0.036/min
 *
 * Eleven Flash v2.5 (no Turbo v2.5): además de ser el modelo de menor latencia
 * de ElevenLabs, es el único que soporta el campo `language` explícito en la
 * configuración de voz de VAPI — necesario para fijar español de forma fiable.
 *
 * Presupuesto de referencia: ≈ $0.11/min y ≈ 1.195ms de latencia total.
 */
export const DEFAULT_VAPI_CONFIG = {
  transcriber: {
    provider: "deepgram",
    model: "nova-3-general",
    language: "es",
  },
  model: {
    provider: "openai",
    model: "gpt-4.1-mini",
  },
  voice: {
    provider: "11labs",
    voiceId: "UOIqAnmS11Reiei1Ytkc",
    model: "eleven_flash_v2_5",
    language: "es",
    optimizeStreamingLatency: 3,
  },
  voiceDisplayName: "Carolina (Recomendada - Cálida, rápida y profesional)",
  platformFeeCentsPerMin: 5, // $0.05/min de cuota base de plataforma de voz
} as const;
