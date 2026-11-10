const BUBBLE_ORIGIN = 'https://app.parts-iq.com';
const BUBBLE_VERSION = import.meta.env.VITE_BUBBLE_VERSION || '';
const BUBBLE_ROOT = BUBBLE_VERSION
  ? `${BUBBLE_ORIGIN}/${BUBBLE_VERSION}`
  : BUBBLE_ORIGIN;

export const CONFIG = {
  BUBBLE_BASE_URL: BUBBLE_ROOT,
  BUBBLE_ORIGIN,
  BUBBLE_PAGES: {
    login: '/auth/log-in',
    extension: '/extension',
    autoflexPanel: '/autoflex-panel',
    autoflexBanner: '/autoflex-banner',
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
    /** chrome.storage.session: Record<tabId, workOrderId> */
    TAB_WORK_ORDERS: 'partsiq_tab_work_orders',
    /** chrome.storage.session: Record<workOrderId (lowercase), license plate> from the Autoflex banner */
    WORK_ORDER_PLATES: 'partsiq_work_order_plates',
  },
} as const;
