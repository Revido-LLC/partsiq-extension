export const CONFIG = {
  BUBBLE_BASE_URL: 'https://app.parts-iq.com/version-138bg',
  BUBBLE_ORIGIN: 'https://app.parts-iq.com',
  BUBBLE_PAGES: {
    login: '/auth/log-in',
    extension: '/extension',
  },
  BUBBLE_API: {
    AI_EXTRACT: 'https://app.parts-iq.com/api/1.1/wf/ai_extract',
    SAVE_PART: 'https://app.parts-iq.com/api/1.1/wf/save_part',
    REMOVE_PART: 'https://app.parts-iq.com/api/1.1/wf/remove_part',
  },
  SCREENSHOT_QUALITY: 90,
  STORAGE_KEYS: {
    AUTH_STATUS: 'partsiq_auth',
    USER_ID: 'partsiq_user_id',
    LANG: 'partsiq_lang',
    WORK_MODE: 'partsiq_work_mode',
    VEHICLE: 'partsiq_vehicle',
    ORDER: 'partsiq_order',
    CART: 'partsiq_cart',
    CART_DATE: 'partsiq_cart_date',
  },
} as const;
