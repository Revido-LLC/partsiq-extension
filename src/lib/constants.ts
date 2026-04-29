const BUBBLE_ROOT = 'https://app.parts-iq.com';

export const CONFIG = {
  BUBBLE_BASE_URL: BUBBLE_ROOT,
  BUBBLE_ORIGIN: BUBBLE_ROOT,
  BUBBLE_PAGES: {
    login: '/auth/log-in',
    extension: '/extension',
  },
  BUBBLE_API: {
    AI_EXTRACT: `${BUBBLE_ROOT}/api/1.1/wf/ai_extract`,
    SAVE_PART: `${BUBBLE_ROOT}/api/1.1/wf/save_part`,
    REMOVE_PART: `${BUBBLE_ROOT}/api/1.1/wf/remove_part`,
  },
  /** 0-100 for chrome.tabs.captureVisibleTab; divide by 100 for Canvas.convertToBlob */
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
    AUTOFLEX: 'partsiq_autoflex',
  },
} as const;
