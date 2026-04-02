export const CONFIG = {
  // Bubble - Update BUBBLE_BASE_URL when real domain is available
  BUBBLE_BASE_URL: 'https://YOUR_BUBBLE_DOMAIN',
  BUBBLE_PAGES: {
    login: '/ext-login',
    parts: '/ext-parts',
    session: '/ext-session',
  },

  // OpenRouter
  OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  OPENROUTER_MODEL: 'openai/gpt-4o',
  OPENROUTER_MAX_TOKENS: 4096,

  // Extension
  MAX_URL_PARAM_LENGTH: 2000,
  SCREENSHOT_QUALITY: 90,

  // Storage keys
  STORAGE_KEYS: {
    AUTH_STATUS: 'partsiq_auth_status',
    ACTIVE_SESSION: 'partsiq_active_session',
    API_KEY: 'partsiq_openrouter_key',
  },
} as const;
