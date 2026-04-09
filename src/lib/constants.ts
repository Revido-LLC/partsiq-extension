export const CONFIG = {
  // Bubble
  BUBBLE_BASE_URL: 'https://app.parts-iq.com/version-138bg',
  BUBBLE_PAGES: {
    login: '/auth/',
    vehicle: '/extension',
  },

  // OpenRouter
  OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY as string,
  OPENROUTER_MODEL: 'google/gemini-2.0-flash-001',
  OPENROUTER_MAX_TOKENS: 4096,

  // Extension
  SCREENSHOT_QUALITY: 90,

  // Storage keys
  STORAGE_KEYS: {
    AUTH_STATUS: 'partsiq_auth_status',
    CART: 'partsiq_cart',
    VEHICLE: 'partsiq_vehicle',
    ORDER: 'partsiq_order',
    WORK_MODE: 'partsiq_work_mode',
    LANGUAGE: 'partsiq_language',
  },

  // Bubble Workflow API
  BUBBLE_API_URL: 'https://app.parts-iq.com/version-138bg/api/1.1/wf',
} as const;
