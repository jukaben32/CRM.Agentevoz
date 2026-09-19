/**
 * CATÁLOGO GENERADO AUTOMÁTICAMENTE DE PROVEEDORES Y MODELOS DE VAPI
 * ==============================================================================
 * GENERADO MEDIANTE: pnpm vapi:pull-catalog
 * NO EDITAR A MANO. Para actualizar la lista de modelos y proveedores de VAPI,
 * ejecuta el script 'pnpm vapi:pull-catalog'.
 * ==============================================================================
 */

export interface TranscriberProviderDef {
  provider: string;
  name: string;
  models: string[];
  languages: string[];
  modelsFree: boolean;
}

export interface ModelProviderDef {
  provider: string;
  name: string;
  models: string[];
  modelsFree: boolean;
}

export interface VoicePreset {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
}

export interface VoiceProviderDef {
  provider: string;
  name: string;
  models: string[];
  languages: string[];
  voiceIdFree: boolean;
  presetVoices: VoicePreset[];
}

export interface VapiCatalogData {
  transcribers: TranscriberProviderDef[];
  models: ModelProviderDef[];
  voices: VoiceProviderDef[];
}

export const VAPI_GENERATED_CATALOG: VapiCatalogData = {
  "transcribers": [
    {
      "provider": "deepgram",
      "name": "Deepgram",
      "models": [
        "nova-3-general",
        "nova-3",
        "nova-2",
        "nova-2-general",
        "nova-2-meeting",
        "nova-2-phonecall"
      ],
      "languages": [
        "es",
        "es-419",
        "es-ES",
        "en",
        "en-US",
        "fr",
        "de",
        "it",
        "pt",
        "multi"
      ],
      "modelsFree": false
    },
    {
      "provider": "assemblyai",
      "name": "AssemblyAI",
      "models": [],
      "languages": [
        "es",
        "en",
        "fr",
        "de",
        "it",
        "pt"
      ],
      "modelsFree": false
    },
    {
      "provider": "azure",
      "name": "Azure Speech to Text",
      "models": [],
      "languages": [
        "es-ES",
        "es-MX",
        "en-US",
        "fr-FR",
        "de-DE"
      ],
      "modelsFree": false
    },
    {
      "provider": "gladia",
      "name": "Gladia",
      "models": [
        "solaria-1",
        "solaria-2"
      ],
      "languages": [
        "es",
        "en",
        "fr",
        "de",
        "it",
        "multi"
      ],
      "modelsFree": false
    },
    {
      "provider": "talkscriber",
      "name": "Whisper (Talkscriber)",
      "models": [
        "whisper"
      ],
      "languages": [
        "es",
        "en",
        "fr",
        "de"
      ],
      "modelsFree": false
    }
  ],
  "models": [
    {
      "provider": "openai",
      "name": "OpenAI",
      "models": [
        "gpt-5.6-luna",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4.1",
        "gpt-4-turbo",
        "gpt-3.5-turbo"
      ],
      "modelsFree": false
    },
    {
      "provider": "anthropic",
      "name": "Anthropic Claude",
      "models": [
        "claude-3-7-sonnet-20250219",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-haiku-20240307"
      ],
      "modelsFree": false
    },
    {
      "provider": "groq",
      "name": "Groq (Ultra-baja latencia)",
      "models": [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768"
      ],
      "modelsFree": false
    },
    {
      "provider": "together-ai",
      "name": "Together AI",
      "models": [
        "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
      ],
      "modelsFree": true
    },
    {
      "provider": "openrouter",
      "name": "OpenRouter",
      "models": [
        "openai/gpt-4o-mini",
        "anthropic/claude-3.5-sonnet"
      ],
      "modelsFree": true
    },
    {
      "provider": "deepinfra",
      "name": "DeepInfra",
      "models": [
        "meta-llama/Meta-Llama-3.1-70B-Instruct"
      ],
      "modelsFree": true
    },
    {
      "provider": "google",
      "name": "Google Gemini",
      "models": [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
      ],
      "modelsFree": false
    },
    {
      "provider": "anyscale",
      "name": "Anyscale",
      "models": [
        "mistralai/Mixtral-8x7B-Instruct-v0.1"
      ],
      "modelsFree": true
    }
  ],
  "voices": [
    {
      "provider": "11labs",
      "name": "ElevenLabs",
      "models": [
        "eleven_turbo_v2_5",
        "eleven_multilingual_v2",
        "eleven_flash_v2_5",
        "eleven_monolingual_v1"
      ],
      "languages": [
        "es",
        "en",
        "multi"
      ],
      "voiceIdFree": true,
      "presetVoices": [
        {
          "id": "UOIqAnmS11Reiei1Ytkc",
          "name": "Carolina (Recomendada - Cálida y Profesional)",
          "gender": "female"
        },
        {
          "id": "21m00Tcm4TlvDq8ikWAM",
          "name": "Rachel (Natural y Clara)",
          "gender": "female"
        },
        {
          "id": "AZnzlk1XvdvUeBnXmlld",
          "name": "Domi (Firme y Confiable)",
          "gender": "female"
        },
        {
          "id": "EXAVITQu4vr4xnSDxMaL",
          "name": "Bella (Expresiva)",
          "gender": "female"
        },
        {
          "id": "ErXwobaYiN019PkySvjV",
          "name": "Antoni (Voz masculina formal)",
          "gender": "male"
        },
        {
          "id": "VR6AewLTigWG4xSOukaG",
          "name": "Arnau (Español nativo masculino)",
          "gender": "male"
        },
        {
          "id": "pNInz6obpgDQGcFmaJgB",
          "name": "Adam (Masculino dinámico)",
          "gender": "male"
        }
      ]
    },
    {
      "provider": "cartesia",
      "name": "Cartesia Sonic",
      "models": [
        "sonic-multilingual",
        "sonic-english"
      ],
      "languages": [
        "es",
        "en",
        "fr",
        "de"
      ],
      "voiceIdFree": true,
      "presetVoices": [
        {
          "id": "a0e99841-438c-4a64-b679-ae501e7d6091",
          "name": "Barbershop Man (Cartesia)",
          "gender": "male"
        },
        {
          "id": "25cdc028-db32-4a76-83c0-802649b433aa",
          "name": "Polite Spanish Lady (Cartesia)",
          "gender": "female"
        }
      ]
    },
    {
      "provider": "azure",
      "name": "Azure Neural Voices",
      "models": [],
      "languages": [
        "es-ES",
        "es-MX",
        "en-US"
      ],
      "voiceIdFree": false,
      "presetVoices": [
        {
          "id": "es-ES-ElviraNeural",
          "name": "Elvira (España - Femenina)",
          "gender": "female"
        },
        {
          "id": "es-ES-AlvaroNeural",
          "name": "Álvaro (España - Masculina)",
          "gender": "male"
        },
        {
          "id": "es-ES-DaliaNeural",
          "name": "Dalia (España - Femenina)",
          "gender": "female"
        },
        {
          "id": "es-ES-AbrilNeural",
          "name": "Abril (España - Joven)",
          "gender": "female"
        }
      ]
    },
    {
      "provider": "vapi",
      "name": "Vapi Preset Voices",
      "models": [],
      "languages": [
        "es",
        "en"
      ],
      "voiceIdFree": false,
      "presetVoices": [
        {
          "id": "Elliot",
          "name": "Elliot (Vapi Voice)",
          "gender": "male"
        },
        {
          "id": "Kylie",
          "name": "Kylie (Vapi Voice)",
          "gender": "female"
        },
        {
          "id": "Rohan",
          "name": "Rohan (Vapi Voice)",
          "gender": "male"
        },
        {
          "id": "Lily",
          "name": "Lily (Vapi Voice)",
          "gender": "female"
        }
      ]
    },
    {
      "provider": "playht",
      "name": "PlayHT",
      "models": [
        "PlayDialog",
        "Play3.0-mini"
      ],
      "languages": [
        "es",
        "en"
      ],
      "voiceIdFree": true,
      "presetVoices": [
        {
          "id": "jennifer",
          "name": "Jennifer (PlayHT)",
          "gender": "female"
        }
      ]
    },
    {
      "provider": "rime-ai",
      "name": "Rime AI",
      "models": [
        "v1",
        "mist"
      ],
      "languages": [
        "es",
        "en"
      ],
      "voiceIdFree": true,
      "presetVoices": []
    }
  ]
};
