# PartsIQ Sidepanel Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the PartsIQ Chrome extension UI as a sidepanel with vehicle/order selection, screenshot scanning via Bubble AI proxy, and a cart with inline send/unsend.

**Architecture:** Clean rewrite of all UI files. Existing `background/index.ts`, `content/index.ts`, `lib/ai.ts`, `lib/storage.ts` are modified (not reused as-is). Sidepanel mounts at `src/pages/sidepanel/`. Bubble handles OpenRouter calls server-side; extension only calls Bubble REST APIs.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite + @crxjs/vite-plugin, Chrome MV3 Sidepanel API.

> **Note on testing:** No test framework is configured. Each task ends with `yarn build:chrome` as the verification step. Manual testing checklist is in Task 15.

---

### Task 1: Types & Constants

**Files:**
- Modify: `src/types/parts.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Replace `src/types/parts.ts`**

```typescript
export type Lang = 'en' | 'nl';
export type WorkMode = 'vehicle' | 'order';
export type SidebarState = 'login' | 'idle' | 'scanning' | 'cart' | 'fallback' | 'finish';
export type CartItemStatus = 'pending' | 'sending' | 'sent' | 'error';

export interface CartItem {
  id: string;
  name: string;
  oem: string;
  price: number | null;
  deliveryDays: number | null;
  stock: number | null;
  supplier: string;
  sourceUrl: string;
  scannedAt: string;
  status: CartItemStatus;
  errorMsg?: string;
  bubblePartId?: string;
  checked: boolean;
}

export interface Vehicle {
  plate: string;
  id: string;
}

export interface Order {
  plate: string;
  id: string;
}

export interface BubbleMessage {
  type: string;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Replace `src/lib/constants.ts`**

```typescript
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
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn build:chrome
```

Expected: build completes. Ignore errors in other files that import old types — those are fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/types/parts.ts src/lib/constants.ts
git commit -m "refactor: rewrite types and constants for sidepanel"
```

---

### Task 2: Storage

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Replace `src/lib/storage.ts`**

```typescript
import type { CartItem, Lang, WorkMode, Vehicle, Order } from '@types/parts';
import { CONFIG } from '@lib/constants';

const K = CONFIG.STORAGE_KEYS;
const today = () => new Date().toISOString().slice(0, 10);

export async function getAuthStatus(): Promise<boolean> {
  const r = await chrome.storage.local.get(K.AUTH_STATUS);
  return r[K.AUTH_STATUS] ?? false;
}
export async function setAuthStatus(v: boolean): Promise<void> {
  await chrome.storage.local.set({ [K.AUTH_STATUS]: v });
}

export async function getLang(): Promise<Lang> {
  const r = await chrome.storage.local.get(K.LANG);
  return (r[K.LANG] as Lang) ?? 'en';
}
export async function setLang(v: Lang): Promise<void> {
  await chrome.storage.local.set({ [K.LANG]: v });
}

export async function getWorkMode(): Promise<WorkMode> {
  const r = await chrome.storage.local.get(K.WORK_MODE);
  return (r[K.WORK_MODE] as WorkMode) ?? 'vehicle';
}
export async function setWorkMode(v: WorkMode): Promise<void> {
  await chrome.storage.local.set({ [K.WORK_MODE]: v });
}

export async function getVehicle(): Promise<Vehicle | null> {
  const r = await chrome.storage.local.get(K.VEHICLE);
  return r[K.VEHICLE] ?? null;
}
export async function setVehicle(v: Vehicle | null): Promise<void> {
  await chrome.storage.local.set({ [K.VEHICLE]: v });
}

export async function getOrder(): Promise<Order | null> {
  const r = await chrome.storage.local.get(K.ORDER);
  return r[K.ORDER] ?? null;
}
export async function setOrder(v: Order | null): Promise<void> {
  await chrome.storage.local.set({ [K.ORDER]: v });
}

export async function getCart(): Promise<CartItem[]> {
  const r = await chrome.storage.local.get([K.CART, K.CART_DATE]);
  if (r[K.CART_DATE] !== today()) {
    await chrome.storage.local.set({ [K.CART]: [], [K.CART_DATE]: today() });
    return [];
  }
  return (r[K.CART] as CartItem[]) ?? [];
}
export async function setCart(items: CartItem[]): Promise<void> {
  await chrome.storage.local.set({ [K.CART]: items, [K.CART_DATE]: today() });
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "refactor: rewrite storage for sidepanel data model"
```

---

### Task 3: i18n

**Files:**
- Create: `src/lib/i18n.ts`

- [ ] **Step 1: Create `src/lib/i18n.ts`**

```typescript
import type { Lang } from '@types/parts';

const T = {
  en: {
    partNumber: 'Part number',
    supplier: 'Supplier',
    deliveryTime: 'Delivery time',
    stock: 'Stock',
    price: 'Price',
    changeVehicle: 'Change vehicle',
    changeOrder: 'Change order',
    scanning: 'Scanning page...',
    noPartsFound: 'No parts found on this page.',
    tryWithCrop: 'Try with crop selection',
    addManually: '+ Add part manually',
    addPart: 'Add part',
    partName: 'Part name',
    partNumberLabel: 'Part number',
    cancel: 'Cancel',
    clearUnsent: 'Clear unsent',
    finishSearch: 'Finish search',
    searchFinished: 'Search finished.',
    newQuote: 'New quote',
    checkStatus: 'Check part status in PartsIQ.',
    pageChanged: 'Page changed — scan now?',
    scan: 'Scan page',
    crop: 'Crop selection',
    retry: 'Retry',
    sending: 'Sending…',
    sent: '✓ Sent',
    errorLabel: 'Error',
    loginError: 'Login failed. Please try again.',
    scanError: 'Scan failed.',
    removeUnsentConfirm: (count: number) =>
      `Remove ${count} unsent part${count === 1 ? '' : 's'}?`,
  },
  nl: {
    partNumber: 'Artikelnummer',
    supplier: 'Leverancier',
    deliveryTime: 'Levertijd',
    stock: 'Voorraad',
    price: 'Prijs',
    changeVehicle: 'Voertuig wijzigen',
    changeOrder: 'Order wijzigen',
    scanning: 'Pagina scannen…',
    noPartsFound: 'Geen onderdelen gevonden op deze pagina.',
    tryWithCrop: 'Probeer met uitsnede',
    addManually: '+ Onderdeel handmatig toevoegen',
    addPart: 'Onderdeel toevoegen',
    partName: 'Naam onderdeel',
    partNumberLabel: 'Artikelnummer',
    cancel: 'Annuleren',
    clearUnsent: 'Niet-verzonden verwijderen',
    finishSearch: 'Zoekopdracht afronden',
    searchFinished: 'Zoekopdracht afgerond.',
    newQuote: 'Nieuwe offerte',
    checkStatus: 'Controleer de status van de onderdelen in PartsIQ.',
    pageChanged: 'Pagina gewijzigd — nu scannen?',
    scan: 'Pagina scannen',
    crop: 'Uitsnede selecteren',
    retry: 'Opnieuw',
    sending: 'Verzenden…',
    sent: '✓ Verzonden',
    errorLabel: 'Fout',
    loginError: 'Aanmelden mislukt. Probeer opnieuw.',
    scanError: 'Scannen mislukt.',
    removeUnsentConfirm: (count: number) =>
      `${count} niet-verzonden onderdeel${count === 1 ? '' : 'en'} verwijderen?`,
  },
} as const;

export type Translations = typeof T.en;

export function useT(lang: Lang): Translations {
  return T[lang] as unknown as Translations;
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add i18n support (en/nl)"
```

---

### Task 4: AI lib & iframe lib

**Files:**
- Modify: `src/lib/ai.ts`
- Modify: `src/lib/iframe.ts`

- [ ] **Step 1: Replace `src/lib/ai.ts`**

```typescript
import { CONFIG } from '@lib/constants';

const EXTRACTION_PROMPT = `Extract auto parts from this supplier website screenshot.
Return a JSON array where each object has:
- name: part name/description
- oem: part number / artikelnummer (may be in English or Dutch)
- price: net price as number without currency symbol (prijs), or null
- delivery_days: delivery time as integer days (levertijd), or null
- stock: stock quantity as integer (voorraad), or null
- supplier: supplier name if visible (leverancier), or empty string

Data may appear in English or Dutch. Return ONLY a valid JSON array, no markdown, no explanation. If no parts found, return [].`;

export interface AiPart {
  name: string;
  oem: string;
  price: number | null;
  delivery_days: number | null;
  stock: number | null;
  supplier: string;
}

export async function extractPartsFromScreenshot(
  screenshotBase64: string
): Promise<AiPart[]> {
  const response = await fetch(CONFIG.BUBBLE_API.AI_EXTRACT, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: screenshotBase64, prompt: EXTRACTION_PROMPT }),
  });

  if (!response.ok) {
    throw new Error(`AI extract failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const parts = data?.parts;
  if (!Array.isArray(parts)) return [];

  return parts.filter(
    (item: unknown): item is AiPart =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).name === 'string'
  );
}
```

- [ ] **Step 2: Replace `src/lib/iframe.ts`**

```typescript
import { useEffect, useRef } from 'react';
import type { BubbleMessage } from '@types/parts';
import { CONFIG } from '@lib/constants';

export function buildBubbleUrl(page: 'login' | 'extension'): string {
  return CONFIG.BUBBLE_BASE_URL + CONFIG.BUBBLE_PAGES[page];
}

export function useBubbleMessages(
  onMessage: (msg: BubbleMessage) => void
): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== CONFIG.BUBBLE_ORIGIN) return;
      onMessageRef.current(event.data as BubbleMessage);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
}
```

- [ ] **Step 3: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai.ts src/lib/iframe.ts
git commit -m "refactor: ai lib calls Bubble proxy, update iframe lib"
```

---

### Task 5: Manifest & Sidepanel Entry Point

**Files:**
- Modify: `manifest.json`
- Create: `src/pages/sidepanel/index.html`
- Create: `src/pages/sidepanel/index.tsx`

- [ ] **Step 1: Replace `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "PartsIQ",
  "version": "1.0.0",
  "description": "Capture part data from any supplier website and send it to PartsIQ",
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "scripting",
    "sidePanel"
  ],
  "host_permissions": [
    "https://app.parts-iq.com/*"
  ],
  "action": {
    "default_icon": {
      "16": "icon-16.png",
      "48": "icon-48.png",
      "128": "icon-128.png"
    }
  },
  "side_panel": {
    "default_path": "src/pages/sidepanel/index.html"
  },
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icon-16.png",
    "48": "icon-48.png",
    "128": "icon-128.png"
  }
}
```

- [ ] **Step 2: Create `src/pages/sidepanel/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PartsIQ</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `src/pages/sidepanel/index.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/globals.css';
import Sidebar from './Sidebar';

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <Sidebar />
  </StrictMode>
);
```

- [ ] **Step 4: Check what CSS file the popup uses and use the same path**

```bash
ls C:/Users/Fillipe/partsiq-extension/src/styles/
# or
ls C:/Users/Fillipe/partsiq-extension/src/pages/popup/
```

If the CSS import path differs from `../../styles/globals.css`, adjust the import in `index.tsx` to match whatever the popup uses (e.g. `./index.css`).

- [ ] **Step 5: Create `src/pages/sidepanel/Sidebar.tsx` as placeholder**

```tsx
export default function Sidebar() {
  return <div className="p-4 text-sm">PartsIQ loading…</div>;
}
```

- [ ] **Step 6: Verify build**

```bash
yarn build:chrome
```

Expected: build succeeds, `dist_chrome` contains `src/pages/sidepanel/` files.

- [ ] **Step 7: Commit**

```bash
git add manifest.json src/pages/sidepanel/
git commit -m "feat: add sidepanel entry point, remove popup from manifest"
```

---

### Task 6: Background Service Worker

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Replace `src/background/index.ts`**

```typescript
import { CONFIG } from '@lib/constants';

// Open sidebar when extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {/* ignore if API not available */});

// ── Screenshot helper ────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function captureFullPage(tab: chrome.tabs.Tab): Promise<string> {
  if (!tab.id) throw new Error('No tab id');

  let scrollHeight: number, viewportHeight: number, currentScrollY: number;
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'get_page_info' }) as
      { scrollHeight: number; viewportHeight: number; currentScrollY: number };
    ({ scrollHeight, viewportHeight, currentScrollY } = info);
  } catch {
    // Restricted page — single capture
    return new Promise<string>(resolve =>
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
    );
  }

  const positions: number[] = [];
  for (let y = 0; y < scrollHeight && positions.length < 4; y += viewportHeight) {
    positions.push(y);
  }

  const dataUrls: string[] = [];
  for (const y of positions) {
    await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y });
    await new Promise(r => setTimeout(r, 250));
    const dataUrl = await new Promise<string>(resolve =>
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
    );
    dataUrls.push(dataUrl);
  }
  await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y: currentScrollY });

  if (dataUrls.length === 1) return dataUrls[0];

  const bitmaps = await Promise.all(dataUrls.map(u => createImageBitmap(dataUrlToBlob(u))));
  const w = bitmaps[0].width;
  const h = bitmaps[0].height;
  const canvas = new OffscreenCanvas(w, h * bitmaps.length);
  const ctx = canvas.getContext('2d')!;
  bitmaps.forEach((bmp, i) => ctx.drawImage(bmp, 0, i * h));
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: CONFIG.SCREENSHOT_QUALITY / 100 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function cropScreenshot(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  dpr: number
): Promise<string> {
  const bitmap = await createImageBitmap(dataUrlToBlob(dataUrl));
  const canvas = new OffscreenCanvas(rect.width * dpr, rect.height * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    bitmap,
    rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr,
    0, 0, rect.width * dpr, rect.height * dpr
  );
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: CONFIG.SCREENSHOT_QUALITY / 100 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'take_screenshot':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab) { sendResponse({ error: 'No active tab' }); return; }
          const screenshot = await captureFullPage(tab);
          sendResponse({ screenshot });
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
      return true;

    case 'take_crop_init':
      (async () => {
        try {
          const tabId = msg.tabId as number;
          await chrome.tabs.sendMessage(tabId, { type: 'start_crop' });
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
      return true;

    case 'crop_done':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab) throw new Error('No active tab');
          const dataUrl = await new Promise<string>(resolve =>
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
          );
          const cropped = await cropScreenshot(
            dataUrl,
            msg.rect as { x: number; y: number; width: number; height: number },
            (msg.dpr as number) ?? 1
          );
          // Broadcast to all extension pages (sidebar)
          chrome.runtime.sendMessage({ type: 'crop_ready', imageBase64: cropped }).catch(() => {});
        } catch (err) {
          chrome.runtime.sendMessage({ type: 'crop_ready', error: String(err) }).catch(() => {});
        }
      })();
      return true;

    case 'url_changed':
      // Relay to sidebar
      chrome.runtime.sendMessage({
        type: 'page_url_changed',
        url: msg.url as string,
      }).catch(() => {});
      break;
  }
});
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 3: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: background opens sidebar on click, adds crop flow"
```

---

### Task 7: Content Script (crop overlay)

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Replace `src/content/index.ts`**

```typescript
// ── Page info & scroll helpers ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'get_page_info') {
    sendResponse({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      currentScrollY: window.scrollY,
    });
  } else if (msg.type === 'scroll_to') {
    window.scrollTo(0, msg.y as number);
    setTimeout(() => sendResponse({ done: true }), 200);
    return true;
  } else if (msg.type === 'start_crop') {
    injectCropOverlay();
    sendResponse({ ok: true });
  }
});

// ── URL change detection ─────────────────────────────────────────────────────

let currentUrl = window.location.href;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const notifyUrlChange = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      chrome.runtime.sendMessage({ type: 'url_changed', url: currentUrl });
    }
  }, 100);
};

const observer = new MutationObserver(notifyUrlChange);
observer.observe(document.body, { childList: true, subtree: true });

(['pushState', 'replaceState'] as const).forEach((method) => {
  const original = history[method];
  history[method] = function (...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    chrome.runtime.sendMessage({ type: 'url_changed', url: window.location.href });
    return result;
  };
});

// ── Crop overlay ─────────────────────────────────────────────────────────────

let cropOverlay: HTMLDivElement | null = null;

function injectCropOverlay() {
  if (cropOverlay) return;

  cropOverlay = document.createElement('div');
  cropOverlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.25);';

  let startX = 0;
  let startY = 0;
  let selectionEl: HTMLDivElement | null = null;

  cropOverlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    selectionEl = document.createElement('div');
    selectionEl.style.cssText =
      'position:fixed;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);pointer-events:none;';
    cropOverlay!.appendChild(selectionEl);
  });

  cropOverlay.addEventListener('mousemove', (e) => {
    if (!selectionEl) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    selectionEl.style.left = x + 'px';
    selectionEl.style.top = y + 'px';
    selectionEl.style.width = Math.abs(e.clientX - startX) + 'px';
    selectionEl.style.height = Math.abs(e.clientY - startY) + 'px';
  });

  cropOverlay.addEventListener('mouseup', (e) => {
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    removeCropOverlay();
    if (width > 10 && height > 10) {
      chrome.runtime.sendMessage({
        type: 'crop_done',
        rect: { x, y, width, height },
        dpr: window.devicePixelRatio,
      });
    }
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removeCropOverlay();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(cropOverlay);
}

function removeCropOverlay() {
  cropOverlay?.remove();
  cropOverlay = null;
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 3: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: content script adds crop overlay"
```

---

### Task 8: LoginState

**Files:**
- Modify: `src/components/states/LoginState.tsx`

- [ ] **Step 1: Replace `src/components/states/LoginState.tsx`**

```tsx
import { useState, useEffect } from 'react';
import type { Lang } from '@types/parts';
import { useT } from '@lib/i18n';
import { buildBubbleUrl } from '@lib/iframe';

interface Props {
  lang: Lang;
  hasError: boolean;
  onRetry: () => void;
}

const LOGIN_TIMEOUT_MS = 10_000;

export default function LoginState({ lang, hasError, onRetry }: Props) {
  const t = useT(lang);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), LOGIN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <iframe
        src={buildBubbleUrl('login')}
        className="flex-1 w-full border-0"
        title="PartsIQ Login"
      />
      {(hasError || timedOut) && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-xs text-red-700 flex items-center justify-between">
          <span>{t.loginError}</span>
          <button
            onClick={onRetry}
            className="ml-2 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            {t.retry}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 3: Commit**

```bash
git add src/components/states/LoginState.tsx
git commit -m "feat: LoginState with timeout and error handling"
```

---

### Task 9: VehiclePanel & OrderPanel

**Files:**
- Create: `src/components/panels/VehiclePanel.tsx`
- Create: `src/components/panels/OrderPanel.tsx`

- [ ] **Step 1: Create `src/components/panels/VehiclePanel.tsx`**

```tsx
import type { Lang, Vehicle } from '@types/parts';
import { useT } from '@lib/i18n';
import { buildBubbleUrl } from '@lib/iframe';

interface Props {
  vehicle: Vehicle | null;
  expanded: boolean;
  lang: Lang;
  onExpand: () => void;
}

export default function VehiclePanel({ vehicle, expanded, lang, onExpand }: Props) {
  const t = useT(lang);

  if (expanded) {
    return (
      <div className="flex flex-col" style={{ height: '100%' }}>
        <iframe
          src={buildBubbleUrl('extension')}
          className="flex-1 w-full border-0"
          title="Select vehicle"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
      <span className="font-medium text-sm text-gray-800">
        {vehicle?.plate ?? '—'}
      </span>
      <button
        onClick={onExpand}
        className="text-xs text-blue-600 hover:underline ml-2"
      >
        {t.changeVehicle}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/panels/OrderPanel.tsx`**

```tsx
import type { Lang, Order } from '@types/parts';
import { useT } from '@lib/i18n';
import { buildBubbleUrl } from '@lib/iframe';

interface Props {
  order: Order | null;
  expanded: boolean;
  lang: Lang;
  onExpand: () => void;
}

export default function OrderPanel({ order, expanded, lang, onExpand }: Props) {
  const t = useT(lang);

  if (expanded) {
    return (
      <div className="flex flex-col" style={{ height: '100%' }}>
        <iframe
          src={buildBubbleUrl('extension')}
          className="flex-1 w-full border-0"
          title="Select order"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
      <span className="font-medium text-sm text-gray-800">
        {order?.plate || order?.id || '—'}
      </span>
      <button
        onClick={onExpand}
        className="text-xs text-blue-600 hover:underline ml-2"
      >
        {t.changeOrder}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/
git commit -m "feat: VehiclePanel and OrderPanel with iframe + badge"
```

---

### Task 10: ScanningState

**Files:**
- Modify: `src/components/states/ScanningState.tsx`

- [ ] **Step 1: Replace `src/components/states/ScanningState.tsx`**

```tsx
import type { Lang } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  error: string | null;
  onRetry: () => void;
}

export default function ScanningState({ lang, error, onRetry }: Props) {
  const t = useT(lang);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
        <p className="text-sm text-red-600">{t.scanError}</p>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={onRetry}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-600">{t.scanning}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 3: Commit**

```bash
git add src/components/states/ScanningState.tsx
git commit -m "feat: ScanningState with spinner and error view"
```

---

### Task 11: FallbackState & FinishState

**Files:**
- Modify: `src/components/states/FallbackState.tsx`
- Create: `src/components/states/FinishState.tsx`

- [ ] **Step 1: Replace `src/components/states/FallbackState.tsx`**

```tsx
import type { Lang, CartItem } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  onAddManual: (item: CartItem) => void;
  onCrop: () => void;
}

export default function FallbackState({ lang, onAddManual, onCrop }: Props) {
  const t = useT(lang);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = (data.get('name') as string).trim();
    const oem = (data.get('oem') as string).trim();
    if (!name) return;
    const item: CartItem = {
      id: crypto.randomUUID(),
      name,
      oem,
      price: null,
      deliveryDays: null,
      stock: null,
      supplier: '',
      sourceUrl: '',
      scannedAt: new Date().toISOString(),
      status: 'pending',
      checked: false,
    };
    onAddManual(item);
    e.currentTarget.reset();
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <p className="text-sm text-gray-700">{t.noPartsFound}</p>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <input
          name="name"
          placeholder={t.partName}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
          required
        />
        <input
          name="oem"
          placeholder={t.partNumberLabel}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          {t.addPart}
        </button>
      </form>

      <button
        onClick={onCrop}
        className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
      >
        ✂️ {t.tryWithCrop}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/states/FinishState.tsx`**

```tsx
import type { Lang } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  onNewQuote: () => void;
}

export default function FinishState({ lang, onNewQuote }: Props) {
  const t = useT(lang);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
      <div className="text-3xl">✓</div>
      <p className="text-sm font-medium text-gray-800">{t.searchFinished}</p>
      <p className="text-xs text-gray-500">{t.checkStatus}</p>
      <button
        onClick={onNewQuote}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        {t.newQuote}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 4: Commit**

```bash
git add src/components/states/FallbackState.tsx src/components/states/FinishState.tsx
git commit -m "feat: FallbackState and FinishState"
```

---

### Task 12: CartState

**Files:**
- Modify: `src/components/states/CartState.tsx`

- [ ] **Step 1: Replace `src/components/states/CartState.tsx`**

```tsx
import { useState } from 'react';
import type { Lang, CartItem, Vehicle, Order, WorkMode } from '@types/parts';
import { useT } from '@lib/i18n';
import { CONFIG } from '@lib/constants';

interface Props {
  lang: Lang;
  cart: CartItem[];
  vehicle: Vehicle | null;
  order: Order | null;
  workMode: WorkMode;
  pendingUrl: string | null;
  onScan: () => void;
  onCrop: () => void;
  onUpdateCart: (items: CartItem[]) => Promise<void>;
  onFinish: () => void;
  onDismissBanner: () => void;
}

export default function CartState({
  lang, cart, vehicle, order, workMode,
  pendingUrl, onScan, onCrop, onUpdateCart, onFinish, onDismissBanner,
}: Props) {
  const t = useT(lang);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);

  const updateItem = async (id: string, patch: Partial<CartItem>) => {
    const updated = cart.map(item => item.id === id ? { ...item, ...patch } : item);
    await onUpdateCart(updated);
  };

  const removeItem = async (id: string) => {
    await onUpdateCart(cart.filter(item => item.id !== id));
  };

  const handleCheck = async (item: CartItem) => {
    if (item.status === 'sending') return;

    if (item.status === 'sent') {
      // Unsend
      await updateItem(item.id, { status: 'sending' });
      try {
        await fetch(CONFIG.BUBBLE_API.REMOVE_PART, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bubble_part_id: item.bubblePartId }),
        });
        await updateItem(item.id, { status: 'pending', checked: false, bubblePartId: undefined });
      } catch (err) {
        await updateItem(item.id, { status: 'sent', errorMsg: String(err) });
      }
      return;
    }

    if (item.status === 'pending' || item.status === 'error') {
      if (!item.oem.trim()) return; // checkbox disabled without oem
      await updateItem(item.id, { status: 'sending' });
      try {
        const body: Record<string, unknown> = {
          name: item.name,
          oem: item.oem,
          price: item.price,
          delivery_days: item.deliveryDays,
          stock: item.stock,
          supplier: item.supplier,
          source_url: item.sourceUrl,
          work_mode: workMode,
        };
        if (workMode === 'vehicle' && vehicle) body.vehicle_id = vehicle.id;
        if (workMode === 'order' && order) body.order_id = order.id;

        const resp = await fetch(CONFIG.BUBBLE_API.SAVE_PART, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        await updateItem(item.id, {
          status: 'sent',
          checked: true,
          bubblePartId: data?.id ?? data?.bubble_part_id,
          errorMsg: undefined,
        });
      } catch (err) {
        await updateItem(item.id, { status: 'error', errorMsg: String(err) });
      }
    }
  };

  const handleOemEdit = (item: CartItem) => {
    if (item.status === 'sent') return;
    setEditingId(item.id);
    setEditValue(item.oem);
  };

  const commitOemEdit = async (id: string) => {
    await updateItem(id, { oem: editValue.trim() });
    setEditingId(null);
  };

  const handleAddManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = (data.get('name') as string).trim();
    const oem = (data.get('oem') as string).trim();
    if (!name) return;
    const newItem: CartItem = {
      id: crypto.randomUUID(),
      name,
      oem,
      price: null,
      deliveryDays: null,
      stock: null,
      supplier: '',
      sourceUrl: '',
      scannedAt: new Date().toISOString(),
      status: 'pending',
      checked: false,
    };
    await onUpdateCart([...cart, newItem]);
    e.currentTarget.reset();
    setShowManualForm(false);
  };

  const handleClearUnsent = async () => {
    const unsent = cart.filter(i => i.status === 'pending' || i.status === 'error');
    if (unsent.length === 0) return;
    const confirmed = window.confirm(t.removeUnsentConfirm(unsent.length));
    if (!confirmed) return;
    await onUpdateCart(cart.filter(i => i.status === 'sent' || i.status === 'sending'));
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL change banner */}
      {pendingUrl && (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs">
          <span className="text-blue-700">{t.pageChanged}</span>
          <div className="flex gap-2 ml-2">
            <button onClick={onScan} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">
              {t.scan}
            </button>
            <button onClick={onDismissBanner} className="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {cart.map(item => {
          const disabled = !item.oem.trim() || item.status === 'sending';
          const isSent = item.status === 'sent';
          const isEditing = editingId === item.id;

          return (
            <div key={item.id} className="border-b border-gray-100 px-3 py-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={disabled}
                  onChange={() => handleCheck(item)}
                  className="mt-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                    {item.status === 'sending' && (
                      <span className="text-xs text-gray-400 shrink-0">{t.sending}</span>
                    )}
                    {item.status === 'sent' && (
                      <span className="text-xs text-green-600 shrink-0">{t.sent}</span>
                    )}
                    {!isSent && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-500 shrink-0 text-xs"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* OEM */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-500">{t.partNumber}:</span>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitOemEdit(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitOemEdit(item.id); }}
                        className="text-xs border-b border-blue-400 outline-none flex-1 min-w-0"
                      />
                    ) : (
                      <span className="text-xs text-gray-700 flex-1 truncate">
                        {item.oem || <span className="text-red-400 italic">missing</span>}
                      </span>
                    )}
                    {!isSent && !isEditing && (
                      <button
                        onClick={() => handleOemEdit(item)}
                        className="text-gray-400 hover:text-blue-500 text-xs"
                        title="Edit part number"
                      >
                        ✏️
                      </button>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                    {item.price != null && <span>€{item.price}</span>}
                    {item.deliveryDays != null && <span>{item.deliveryDays}d</span>}
                    {item.supplier && <span className="truncate">{item.supplier}</span>}
                  </div>

                  {item.status === 'error' && item.errorMsg && (
                    <p className="text-xs text-red-500 mt-0.5">{item.errorMsg}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Manual add */}
        <div className="px-3 py-2 border-b border-gray-100">
          {showManualForm ? (
            <form onSubmit={handleAddManual} className="flex flex-col gap-1.5">
              <input
                name="name"
                placeholder={t.partName}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                required
              />
              <input
                name="oem"
                placeholder={t.partNumberLabel}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="flex-1 px-2 py-1 border border-gray-300 text-xs rounded hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  {t.addPart}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowManualForm(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              {t.addManually}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-3 py-2 flex flex-col gap-1.5 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={onScan}
            className="flex-1 px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"
          >
            📷 {t.scan}
          </button>
          <button
            onClick={onCrop}
            className="flex-1 px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"
          >
            ✂️ {t.crop}
          </button>
        </div>
        <button
          onClick={handleClearUnsent}
          className="w-full px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50 text-gray-600"
        >
          🗑 {t.clearUnsent}
        </button>
        <button
          onClick={onFinish}
          className="w-full px-2 py-1.5 bg-gray-800 text-white text-xs rounded hover:bg-gray-900"
        >
          {t.finishSearch}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

- [ ] **Step 3: Commit**

```bash
git add src/components/states/CartState.tsx
git commit -m "feat: CartState with inline OEM edit, send/unsend, manual add"
```

---

### Task 13: Sidebar State Machine

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx`

- [ ] **Step 1: Replace `src/pages/sidepanel/Sidebar.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { SidebarState, WorkMode, Lang, Vehicle, Order, CartItem } from '@types/parts';
import {
  getAuthStatus, setAuthStatus,
  getLang, setLang,
  getWorkMode, setWorkMode,
  getVehicle, setVehicle,
  getOrder, setOrder,
  getCart, setCart,
} from '@lib/storage';
import { useBubbleMessages } from '@lib/iframe';
import { extractPartsFromScreenshot } from '@lib/ai';
import { useT } from '@lib/i18n';
import LoginState from '@components/states/LoginState';
import ScanningState from '@components/states/ScanningState';
import CartState from '@components/states/CartState';
import FallbackState from '@components/states/FallbackState';
import FinishState from '@components/states/FinishState';
import VehiclePanel from '@components/panels/VehiclePanel';
import OrderPanel from '@components/panels/OrderPanel';

export default function Sidebar() {
  const [state, setState] = useState<SidebarState>('login');
  const [workMode, setWorkModeState] = useState<WorkMode>('vehicle');
  const [lang, setLangState] = useState<Lang>('en');
  const [vehicle, setVehicleState] = useState<Vehicle | null>(null);
  const [order, setOrderState] = useState<Order | null>(null);
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [loginError, setLoginError] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Refs to avoid stale closures in event listeners
  const stateRef = useRef(state);
  stateRef.current = state;
  const isLoggedInRef = useRef(false);
  const vehicleRef = useRef(vehicle);
  vehicleRef.current = vehicle;
  const orderRef = useRef(order);
  orderRef.current = order;
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const workModeRef = useRef(workMode);
  workModeRef.current = workMode;

  const t = useT(lang);

  // Derived: panel shows iframe when state is 'idle'
  const panelExpanded = state === 'idle';

  // ── Load from storage on mount ───────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const [auth, savedLang, savedMode, savedVehicle, savedOrder, savedCart] =
        await Promise.all([
          getAuthStatus(), getLang(), getWorkMode(),
          getVehicle(), getOrder(), getCart(),
        ]);

      setLangState(savedLang);
      setWorkModeState(savedMode);

      if (auth) {
        isLoggedInRef.current = true;
        setVehicleState(savedVehicle);
        setOrderState(savedOrder);
        setCartState(savedCart);

        if (savedCart.length > 0) {
          setState('cart');
        } else if (savedVehicle || savedOrder) {
          setState('scanning');
        } else {
          setState('idle');
        }
      }
    })();
  }, []);

  // ── URL change listener ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (msg: { type: string; url: string }) => {
      if (msg.type === 'page_url_changed' && stateRef.current === 'cart') {
        setPendingUrl(msg.url);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // ── Crop ready listener ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = async (msg: { type: string; imageBase64?: string; error?: string }) => {
      if (msg.type !== 'crop_ready') return;
      if (msg.error) {
        setScanError(msg.error);
        setState('scanning');
        return;
      }
      if (msg.imageBase64) {
        await runScan(msg.imageBase64);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scan ─────────────────────────────────────────────────────────────────

  const runScan = useCallback(async (providedImage?: string) => {
    setState('scanning');
    setScanError(null);
    setPendingUrl(null);

    try {
      let imageBase64 = providedImage;
      if (!imageBase64) {
        const resp = await chrome.runtime.sendMessage({ type: 'take_screenshot' });
        if (resp.error) throw new Error(resp.error);
        imageBase64 = resp.screenshot as string;
      }

      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const currentUrl = tab?.url ?? '';

      const parts = await extractPartsFromScreenshot(imageBase64!);

      if (parts.length === 0) {
        setState('fallback');
        return;
      }

      // Merge: remove pending/error for this URL, keep sent
      const preserved = cartRef.current.filter(
        item => !(item.sourceUrl === currentUrl && (item.status === 'pending' || item.status === 'error'))
      );
      const newItems: CartItem[] = parts.map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        oem: p.oem ?? '',
        price: p.price,
        deliveryDays: p.delivery_days,
        stock: p.stock,
        supplier: p.supplier ?? '',
        sourceUrl: currentUrl,
        scannedAt: new Date().toISOString(),
        status: 'pending',
        checked: false,
      }));

      const merged = [...preserved, ...newItems];
      setCartState(merged);
      cartRef.current = merged;
      await setCart(merged);
      setState('cart');
    } catch (err) {
      setScanError(String(err));
      setState('scanning'); // stays in scanning with error shown
    }
  }, []);

  // Auto-scan when transitioning to 'scanning' on mount (vehicle/order already set)
  const didAutoScan = useRef(false);
  useEffect(() => {
    if (state === 'scanning' && !didAutoScan.current) {
      didAutoScan.current = true;
      runScan();
    }
  }, [state, runScan]);

  // ── Crop ─────────────────────────────────────────────────────────────────

  const handleCrop = async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id) {
      await chrome.runtime.sendMessage({ type: 'take_crop_init', tabId: tab.id });
    }
  };

  // ── Cart sync ─────────────────────────────────────────────────────────────

  const updateCart = async (items: CartItem[]) => {
    setCartState(items);
    cartRef.current = items;
    await setCart(items);
  };

  // ── Finish ────────────────────────────────────────────────────────────────

  const handleFinish = async () => {
    setVehicleState(null);
    setOrderState(null);
    setCartState([]);
    cartRef.current = [];
    await Promise.all([setVehicle(null), setOrder(null), setCart([])]);
    setState('finish');
  };

  // ── Bubble messages ───────────────────────────────────────────────────────

  useBubbleMessages(async (msg) => {
    if (msg.type === 'partsiq:login_success') {
      const rawLang = msg.language as string;
      const autoflex = msg.autoflex_connected as string;
      const newLang: Lang = rawLang === 'nl' ? 'nl' : 'en';
      const newMode: WorkMode = autoflex === 'yes' ? 'order' : 'vehicle';

      isLoggedInRef.current = true;
      setLangState(newLang);
      setWorkModeState(newMode);
      setLoginError(false);
      await Promise.all([setAuthStatus(true), setLang(newLang), setWorkMode(newMode)]);
      setState('idle');
      return;
    }

    if (msg.type === 'partsiq:login_failed') {
      setLoginError(true);
      return;
    }

    if (!isLoggedInRef.current) return;

    if (msg.type === 'partsiq:vehicle_selected') {
      const plate = msg.plate as string;
      const id = msg.id as string;
      if (!plate || !id) return;
      const v: Vehicle = { plate, id };
      setVehicleState(v);
      vehicleRef.current = v;
      await setVehicle(v);
      didAutoScan.current = false;
      setState('scanning');
    }

    if (msg.type === 'partsiq:order_selected') {
      const plate = (msg.plate as string) ?? '';
      const id = msg.id as string;
      if (!id) return;
      const o: Order = { plate, id };
      setOrderState(o);
      orderRef.current = o;
      await setOrder(o);
      didAutoScan.current = false;
      setState('scanning');
    }
  });

  // ── Login retry ───────────────────────────────────────────────────────────

  const handleLoginRetry = () => {
    setLoginError(false);
    // Force iframe reload by key change is complex — just reset error
    window.location.reload();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === 'login') {
    return (
      <div className="h-screen flex flex-col">
        <LoginState lang={lang} hasError={loginError} onRetry={handleLoginRetry} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Vehicle or Order panel */}
      {workMode === 'vehicle' ? (
        <VehiclePanel
          vehicle={vehicle}
          expanded={panelExpanded}
          lang={lang}
          onExpand={() => setState('idle')}
        />
      ) : (
        <OrderPanel
          order={order}
          expanded={panelExpanded}
          lang={lang}
          onExpand={() => setState('idle')}
        />
      )}

      {/* Content area — only visible when panel is collapsed */}
      {!panelExpanded && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {state === 'scanning' && (
            <ScanningState
              lang={lang}
              error={scanError}
              onRetry={() => { didAutoScan.current = false; setState('scanning'); }}
            />
          )}
          {state === 'cart' && (
            <CartState
              lang={lang}
              cart={cart}
              vehicle={vehicle}
              order={order}
              workMode={workMode}
              pendingUrl={pendingUrl}
              onScan={() => { didAutoScan.current = false; runScan(); }}
              onCrop={handleCrop}
              onUpdateCart={updateCart}
              onFinish={handleFinish}
              onDismissBanner={() => setPendingUrl(null)}
            />
          )}
          {state === 'fallback' && (
            <FallbackState
              lang={lang}
              onAddManual={async (item) => {
                await updateCart([...cartRef.current, item]);
                setState('cart');
              }}
              onCrop={handleCrop}
            />
          )}
          {state === 'finish' && (
            <FinishState
              lang={lang}
              onNewQuote={() => {
                didAutoScan.current = false;
                setState('idle');
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
yarn build:chrome
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/sidepanel/Sidebar.tsx
git commit -m "feat: Sidebar state machine — login, idle, scan, cart, fallback, finish"
```

---

### Task 14: Delete Old Popup Files

**Files:**
- Delete: `src/pages/popup/` directory contents (or leave — they won't be loaded since manifest no longer references popup)
- Verify: no import errors

- [ ] **Step 1: Check for any import leaks**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn build:chrome 2>&1 | head -50
```

If there are errors from popup files (e.g. `SessionState.tsx` importing missing things), either delete the file or fix the import. These files are dead code since manifest no longer has `default_popup`.

- [ ] **Step 2: Delete old popup state files that cause build errors (only if needed)**

Only delete files if they cause build errors. Safe to delete the entire old `src/components/states/` files that conflict, since all are rewritten in this plan.

- [ ] **Step 3: Final build verification**

```bash
yarn build:chrome
```

Expected: zero errors, zero warnings about missing types.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead popup state files"
```

---

### Task 15: Manual Testing Checklist

Load the built extension in Chrome:
1. Go to `chrome://extensions` → Enable Developer mode → Load unpacked → select `dist_chrome/`
2. Open any supplier website (e.g. google.com for testing)
3. Click the PartsIQ extension icon

**Login flow:**
- [ ] Sidebar opens
- [ ] Bubble `/auth/log-in` iframe loads
- [ ] After login, sidebar advances to `idle` state (VehiclePanel or OrderPanel expanded)
- [ ] `lang` and `workMode` match what Bubble sends

**Vehicle flow (`autoflex_connected=no`):**
- [ ] VehiclePanel shows iframe fullscreen
- [ ] Selecting a vehicle collapses panel to badge with plate
- [ ] Scanning starts automatically
- [ ] Spinner shows during scan
- [ ] Parts appear in cart (or fallback if none found)

**Order flow (`autoflex_connected=yes`):**
- [ ] OrderPanel shows iframe fullscreen
- [ ] Selecting an order collapses panel to badge
- [ ] Scanning starts automatically

**Cart:**
- [ ] Parts list shows with checkbox, name, part number, ✏️
- [ ] Checkbox disabled when OEM is empty
- [ ] Clicking ✏️ enables inline edit
- [ ] Filling OEM enables checkbox
- [ ] Checking sends part to Bubble (`POST save_part`)
- [ ] Unchecking calls `POST remove_part` and returns to pending
- [ ] ✕ removes pending/error items
- [ ] Manual add form opens inline, adds to list
- [ ] "Limpar não enviadas" removes pending + error
- [ ] "Finalizar Busca" clears cart + goes to finish screen

**Scan & Crop:**
- [ ] 📷 Scan button triggers new screenshot + AI
- [ ] ✂️ Crop button shows overlay on page, selection crops image
- [ ] URL change banner appears in cart when navigating
- [ ] Banner "Scan" button rescans new page

**Persistence:**
- [ ] Close and reopen sidebar — cart survives (same day)
- [ ] Change system date to tomorrow, reopen — cart is empty

**Language:**
- [ ] `language: 'nl'` from Bubble → UI shows Dutch labels
- [ ] `language: 'en'` → English labels
