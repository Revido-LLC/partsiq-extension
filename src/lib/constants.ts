const BUBBLE_VERSION = 'version-138bg';

export const CONFIG = {
  BUBBLE_BASE_URL: `https://app.parts-iq.com/${BUBBLE_VERSION}`,
  BUBBLE_ORIGIN: 'https://app.parts-iq.com',
  BUBBLE_PAGES: {
    login: '/auth/log-in',
    extension: '/extension',
  },
  BUBBLE_API: {
    AI_EXTRACT: `https://app.parts-iq.com/${BUBBLE_VERSION}/api/1.1/wf/ai_extract`,
    SAVE_PART: `https://app.parts-iq.com/${BUBBLE_VERSION}/api/1.1/wf/save_part`,
    REMOVE_PART: `https://app.parts-iq.com/${BUBBLE_VERSION}/api/1.1/wf/remove_part`,
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
