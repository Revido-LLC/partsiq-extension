# PartsIQ Chrome Extension — Project Spec

> **Version:** 3.1
> **Boilerplate:** [JohnBra/vite-web-extension](https://github.com/JohnBra/vite-web-extension)
> **Stack:** React 19 + TypeScript + Vite + TailwindCSS 4 + Manifest V3
> **AI:** OpenRouter API (vision model)
> **Backend:** Bubble (iframe embeds, zero API)
> **Communication:** iframe + URL params + postMessage

---

## Overview

PartsIQ needs a Chrome Extension that allows mechanics to capture part data from **any website** via AI-powered screenshot analysis and send it to PartsIQ for price comparison via Skyvern. The extension communicates with the PartsIQ Bubble app **exclusively via iframe + URL parameters** — no direct API calls.

### How It Works

1. Mechanic is on a supplier website (or any site with part data)
2. Opens the extension popup → clicks "Capture parts"
3. Extension asks: **new collection session** or **add to existing session**?
4. Extension takes a screenshot → sends to AI (OpenRouter vision model)
5. AI returns structured JSON with detected parts
6. Extension builds a URL with part data as query params → loads Bubble iframe
7. Inside the Bubble iframe: mechanic selects parts, assigns to car/order
8. Mechanic can switch pages/suppliers and keep adding to the same session

### Key Architecture Decisions

- **Zero API between extension and Bubble** — everything via iframe + URL params + postMessage
- **Login via iframe** — extension loads Bubble login page as iframe, no token management
- **AI screenshot instead of DOM scraping** — works on any site, zero maintenance per supplier
- **Collection sessions** — persist across page changes and different supplier sites
- **Business logic in Bubble** — extension is thin (capture + AI), Bubble handles all data logic

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript |
| Build | Vite |
| Styling | TailwindCSS 4 |
| Extension | Chrome Manifest V3 |
| AI | OpenRouter API (vision model, e.g. gpt-4o) |
| Backend | Bubble (no-code, iframe embeds) |
| Communication | postMessage + URL params |
| Boilerplate | [JohnBra/vite-web-extension](https://github.com/JohnBra/vite-web-extension) |

---

## Scope Boundaries

### In Scope
- Chrome + Edge (Chromium) only
- Manifest V3
- AI screenshot scraping via OpenRouter
- Multi-part detection and selection
- Collection sessions (persist across pages/suppliers)
- Embedded Bubble pages via iframe
- Login/logout via Bubble iframe
- Install prompts in PartsIQ dashboard

### Out of Scope
- Firefox / Safari
- TecRMI quotation flow (v2.0)
- Autoflex order linking (next iteration)
- Direct API endpoints between extension and Bubble
- Instructional video (placeholder only)
- Chrome Web Store publication (separate step)
- i18n / internationalization

---

## Project Structure

Based on [JohnBra/vite-web-extension](https://github.com/JohnBra/vite-web-extension), customized for PartsIQ. We only need the **popup** and **content script** — remove all other pages (newtab, devtools, options, panel, sidepanel).

```
partsiq-extension/
├── public/
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── logo.svg                    # PartsIQ logo mark
├── src/
│   ├── pages/
│   │   └── popup/
│   │       ├── index.html
│   │       ├── Popup.tsx            # Main popup component (state machine)
│   │       ├── Popup.css
│   │       └── index.tsx            # Entry point
│   ├── components/
│   │   ├── states/
│   │   │   ├── IdleState.tsx        # Logged in, ready to capture
│   │   │   ├── LoginState.tsx       # Bubble login iframe
│   │   │   ├── SessionState.tsx     # New session or add to existing
│   │   │   ├── ScanningState.tsx    # Screenshot + AI loading
│   │   │   ├── IframeState.tsx      # Bubble embed with parts
│   │   │   ├── FallbackState.tsx    # Manual OEM input
│   │   │   └── ConfirmState.tsx     # Success + next actions
│   │   ├── StatusChip.tsx           # IDLE / SCANNING / FOUND / ADDED
│   │   ├── SessionBadge.tsx         # Active session indicator
│   │   └── BubbleIframe.tsx         # Reusable iframe wrapper with postMessage
│   ├── lib/
│   │   ├── ai.ts                    # OpenRouter API wrapper
│   │   ├── iframe.ts                # URL builder + postMessage handler
│   │   ├── screenshot.ts            # chrome.tabs.captureVisibleTab wrapper
│   │   ├── storage.ts               # chrome.storage.local helpers
│   │   └── constants.ts             # Config values, Bubble URLs, model settings
│   ├── content/
│   │   └── index.ts                 # Content script: URL change detection
│   ├── background/
│   │   └── index.ts                 # Service worker: screenshot capture, message routing
│   └── types/
│       └── parts.ts                 # Shared TypeScript types (PartData, Session, etc.)
├── manifest.json                    # Manifest V3 config
├── manifest.dev.json                # Dev overrides
├── vite.config.base.ts
├── vite.config.chrome.ts
├── custom-vite-plugins.ts
├── tsconfig.json
├── package.json
└── README.md
```

### Pages to Remove from Boilerplate

The boilerplate includes pages we don't need. Remove these directories and their manifest references:

- `src/pages/newtab/` — remove + remove `chrome_url_overrides.newtab` from manifest
- `src/pages/devtools/` — remove
- `src/pages/panel/` — remove
- `src/pages/options/` — remove + remove `options_page` from manifest
- `src/pages/sidepanel/` — remove + remove `side_panel` from manifest
- `src/pages/content/` — move to `src/content/` for clarity
- `src/pages/background/` — move to `src/background/` for clarity

---

## manifest.json

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
    "scripting"
  ],
  "action": {
    "default_popup": "src/pages/popup/index.html",
    "default_icon": {
      "16": "public/icon-16.png",
      "48": "public/icon-48.png",
      "128": "public/icon-128.png"
    }
  },
  "background": {
    "service_worker": "src/background/index.ts"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "public/icon-16.png",
    "48": "public/icon-48.png",
    "128": "public/icon-128.png"
  }
}
```

---

## TypeScript Types (`src/types/parts.ts`)

```typescript
export interface PartData {
  partName: string;
  oemNumber: string;
  netPrice: number | null;
  grossPrice: number | null;
  deliveryTime: string | null;
  stockAvailable: boolean | null;
  supplier: string | null;
  confidence: number; // 0-1
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  partCount: number;
}

export type PopupState =
  | 'login'
  | 'idle'
  | 'session_select'
  | 'scanning'
  | 'iframe'
  | 'fallback'
  | 'confirm';

export type StatusChipVariant =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'added'
  | 'error';

// PostMessage types
export interface BubbleMessage {
  type:
    | 'partsiq:ready'
    | 'partsiq:login_success'
    | 'partsiq:login_failed'
    | 'partsiq:parts_saved'
    | 'partsiq:session_created'
    | 'partsiq:session_selected'
    | 'partsiq:error';
  [key: string]: unknown;
}

export interface LoginSuccessMessage extends BubbleMessage {
  type: 'partsiq:login_success';
  userId: string;
}

export interface PartsSavedMessage extends BubbleMessage {
  type: 'partsiq:parts_saved';
  count: number;
  sessionId: string;
}

export interface SessionCreatedMessage extends BubbleMessage {
  type: 'partsiq:session_created';
  sessionId: string;
  name: string;
}

export interface SessionSelectedMessage extends BubbleMessage {
  type: 'partsiq:session_selected';
  sessionId: string;
}
```

---

## Module Specifications

### 1. `src/lib/ai.ts` — OpenRouter API Wrapper

```typescript
/**
 * Sends a screenshot to OpenRouter vision model and returns extracted parts.
 *
 * @param screenshotBase64 - The screenshot as base64 data URL
 * @returns Array of extracted parts
 */
export async function extractPartsFromScreenshot(
  screenshotBase64: string
): Promise<PartData[]>

// Implementation notes:
// - Use OpenRouter API (https://openrouter.ai/api/v1/chat/completions)
// - Send screenshot as base64 image in the messages array (vision format)
// - Use a vision-capable model (start with gpt-4o, test alternatives)
// - API key stored in chrome.storage.local
// - Prompt must request JSON-only response with the PartData schema
// - Handle: no parts found (return []), partial data, timeout, rate limits
// - Log: response time, model used, parts count, missing fields
```

**AI Prompt:**

```
You are a parts data extractor for automotive suppliers. Analyze this screenshot of a supplier website and extract ALL parts visible on the page.

For each part found, return a JSON array with objects containing:
- partName: the name/description of the part
- oemNumber: the OEM or OES reference number
- netPrice: the net/wholesale price (number, no currency symbol)
- grossPrice: the gross/retail price (number, no currency symbol)
- deliveryTime: estimated delivery time as text
- stockAvailable: true/false/null if not shown
- supplier: the supplier name if visible on the page
- confidence: your confidence in the extraction (0.0 to 1.0)

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- If a field is not visible on the page, use null
- Extract ALL parts visible, not just the first one
- Prices should be numbers without currency symbols
- If no parts are detected, return an empty array []
```

### 2. `src/lib/iframe.ts` — Bubble URL Builder + PostMessage Handler

```typescript
/**
 * Builds a Bubble embeddable page URL with data as query parameters.
 */
export function buildBubbleUrl(
  page: 'login' | 'parts' | 'session',
  params?: Record<string, string>
): string

/**
 * Sends data to the Bubble iframe via postMessage.
 * Used as fallback when URL params exceed MAX_URL_PARAM_LENGTH.
 */
export function sendToIframe(
  iframe: HTMLIFrameElement,
  message: { type: string; [key: string]: unknown }
): void

/**
 * React hook for listening to postMessage from Bubble iframe.
 * Validates origin against BUBBLE_BASE_URL.
 */
export function useBubbleMessages(
  onMessage: (msg: BubbleMessage) => void
): void
```

**PostMessage Protocol:**

| Direction | Message Type | Payload | When |
|---|---|---|---|
| Bubble → Ext | `partsiq:ready` | `{}` | Iframe loaded |
| Bubble → Ext | `partsiq:login_success` | `{ userId }` | Login OK |
| Bubble → Ext | `partsiq:login_failed` | `{ error }` | Login failed |
| Bubble → Ext | `partsiq:parts_saved` | `{ count, sessionId }` | Parts saved |
| Bubble → Ext | `partsiq:session_created` | `{ sessionId, name }` | New session |
| Bubble → Ext | `partsiq:session_selected` | `{ sessionId }` | Session picked |
| Bubble → Ext | `partsiq:error` | `{ message }` | Error |
| Ext → Bubble | `partsiq:set_parts` | `{ parts: PartData[] }` | Send parts data |
| Ext → Bubble | `partsiq:set_session` | `{ sessionId }` | Set session |

**URL Parameter Schema:**

```
https://partsiq.com/ext-parts?
  session_id=abc123&
  parts=<URL-encoded JSON>
```

If URL-encoded parts exceed `MAX_URL_PARAM_LENGTH` (2000 chars), load iframe without parts param and use `postMessage` after iframe fires `partsiq:ready`.

### 3. `src/lib/screenshot.ts` — Screenshot Capture

```typescript
/**
 * Requests a screenshot from the background service worker.
 * Must be called from popup context (not content script).
 */
export async function captureScreenshot(): Promise<string>
// Returns base64 data URL (JPEG, quality 90)
```

### 4. `src/lib/storage.ts` — Chrome Storage Helpers

```typescript
/**
 * Typed wrappers around chrome.storage.local
 */
export async function getAuthStatus(): Promise<boolean>
export async function setAuthStatus(loggedIn: boolean): Promise<void>

export async function getActiveSession(): Promise<Session | null>
export async function setActiveSession(session: Session | null): Promise<void>

export async function getApiKey(): Promise<string | null>
export async function setApiKey(key: string): Promise<void>
```

### 5. `src/lib/constants.ts` — Configuration

```typescript
export const CONFIG = {
  // Bubble
  BUBBLE_BASE_URL: 'https://partsiq.com',  // Update with real URL
  BUBBLE_PAGES: {
    login: '/ext-login',
    parts: '/ext-parts',
    session: '/ext-session',
  },

  // OpenRouter
  OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  OPENROUTER_MODEL: 'openai/gpt-4o',  // Default — test others
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
```

---

## Popup State Machine

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   [NOT LOGGED IN] ──→ LoginState (Bubble iframe)        │
│         │                     │                         │
│         │       postMessage: partsiq:login_success      │
│         ▼                     │                         │
│   [LOGGED IN / IDLE] ◄────────┘                         │
│    IdleState: "Capture parts" button                    │
│         │                                               │
│    click "Capture"                                      │
│         ▼                                               │
│   [SESSION SELECT]                                      │
│    SessionState: "New session" / "Add to [name]"        │
│         │                                               │
│         ▼                                               │
│   [SCANNING]                                            │
│    ScanningState: screenshot → AI → loading             │
│         │                                               │
│    ┌────┴─────┐                                         │
│    │          │                                         │
│    ▼          ▼                                         │
│ [FOUND]   [NOT FOUND]                                   │
│ IframeState  FallbackState                              │
│ (Bubble)     (manual OEM)                               │
│    │          │                                         │
│    ▼          ▼                                         │
│   [IFRAME: Bubble Parts Page]                           │
│    part selection, car, order — all in Bubble            │
│         │                                               │
│    postMessage: partsiq:parts_saved                     │
│         ▼                                               │
│   [CONFIRMATION]                                        │
│    ConfirmState: "Open PartsIQ" / "Close" / "More"      │
│         │                                               │
│    ┌────┴─────┐                                         │
│    │          │                                         │
│    ▼          ▼                                         │
│  [IDLE]   [SESSION SELECT → same session]               │
│                                                         │
└─────────────────────────────────────────────────────────┘

Additional triggers:
- URL change → show "Page changed. Re-scan?" prompt
- Refresh button → re-capture screenshot without page change
```

### React Component: Popup.tsx

```tsx
// Simplified structure
const Popup: React.FC = () => {
  const [state, setState] = useState<PopupState>('idle');
  const [parts, setParts] = useState<PartData[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check auth on mount
  useEffect(() => {
    getAuthStatus().then(setIsLoggedIn);
  }, []);

  // Listen for URL changes from content script
  useEffect(() => {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'page_url_changed') {
        // Prompt re-scan if in idle state
      }
    });
  }, []);

  if (!isLoggedIn) return <LoginState onSuccess={() => setIsLoggedIn(true)} />;

  switch (state) {
    case 'idle':
      return <IdleState session={session} onCapture={() => setState('session_select')} />;
    case 'session_select':
      return <SessionState onSelect={(s) => { setSession(s); setState('scanning'); }} />;
    case 'scanning':
      return <ScanningState onFound={(p) => { setParts(p); setState('iframe'); }}
                            onNotFound={() => setState('fallback')} />;
    case 'iframe':
      return <IframeState parts={parts} session={session} onSaved={() => setState('confirm')} />;
    case 'fallback':
      return <FallbackState onSubmit={(p) => { setParts(p); setState('iframe'); }} />;
    case 'confirm':
      return <ConfirmState onClose={() => window.close()}
                           onMore={() => setState('session_select')}
                           onOpenPartsIQ={() => chrome.tabs.create({ url: CONFIG.BUBBLE_BASE_URL })} />;
  }
};
```

---

## Content Script (`src/content/index.ts`)

Minimal. Runs on all pages, only detects URL changes.

```typescript
let currentUrl = window.location.href;

const notifyUrlChange = () => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    chrome.runtime.sendMessage({ type: 'url_changed', url: currentUrl });
  }
};

// MutationObserver for SPA navigation
const observer = new MutationObserver(notifyUrlChange);
observer.observe(document.body, { childList: true, subtree: true });

// History API interception
(['pushState', 'replaceState'] as const).forEach((method) => {
  const original = history[method];
  history[method] = function (...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    chrome.runtime.sendMessage({ type: 'url_changed', url: window.location.href });
    return result;
  };
});
```

---

## Background Service Worker (`src/background/index.ts`)

Routes messages and handles screenshot capture.

```typescript
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'take_screenshot':
      chrome.tabs.captureVisibleTab(
        null as unknown as number,
        { format: 'jpeg', quality: 90 },
        (dataUrl) => sendResponse({ screenshot: dataUrl })
      );
      return true; // async response

    case 'url_changed':
      chrome.runtime.sendMessage({
        type: 'page_url_changed',
        url: msg.url,
      }).catch(() => {}); // popup might not be open
      break;
  }
});
```

---

## Bubble Pages to Create (iframe-friendly)

These pages must be built in Bubble and optimized for iframe embedding:

### 1. `/ext-login`
- Clean login form (no PartsIQ header, nav, or sidebar)
- On success: `window.parent.postMessage({ type: 'partsiq:login_success', userId: '...' }, '*')`
- On failure: `window.parent.postMessage({ type: 'partsiq:login_failed', error: '...' }, '*')`

### 2. `/ext-parts`
- Receives parts via URL params or postMessage
- Displays parts in a selectable list with checkboxes
- Shows: part name, OEM, net price, gross price, delivery, stock
- Car selector: pick existing car by license plate or create new
- Order linking: assign to existing order
- On save: `window.parent.postMessage({ type: 'partsiq:parts_saved', count: N, sessionId: '...' }, '*')`
- Triggers Skyvern search by setting status field

### 3. `/ext-session`
- Create new collection session
- List recent sessions with part count
- Select existing session to continue adding
- On create: `window.parent.postMessage({ type: 'partsiq:session_created', sessionId: '...', name: '...' }, '*')`
- On select: `window.parent.postMessage({ type: 'partsiq:session_selected', sessionId: '...' }, '*')`

**All pages must:**
- Fire `partsiq:ready` on load
- Listen for postMessage from the extension
- Have no Bubble header/nav/sidebar (clean embed layout)

---

## Branding

- **Primary color:** PartsIQ brand blue (from existing app)
- **Logo:** PartsIQ logo mark in popup header
- **Font:** Match PartsIQ dashboard
- **Popup dimensions:** ~400px wide × 500px tall
- **Status chips:** TailwindCSS badges — IDLE / SCANNING / FOUND / ADDED
- **Use TailwindCSS** for all styling — no custom CSS unless necessary

---

## Setup Instructions

```bash
# 1. Clone boilerplate
git clone https://github.com/JohnBra/vite-web-extension.git partsiq-extension
cd partsiq-extension

# 2. Install dependencies
yarn

# 3. Clean up — remove pages we don't need
rm -rf src/pages/newtab
rm -rf src/pages/devtools
rm -rf src/pages/panel
rm -rf src/pages/options
rm -rf src/pages/sidepanel

# 4. Update manifest.json — remove references to deleted pages
# Remove: chrome_url_overrides, options_page, devtools_page, side_panel

# 5. Create our project structure
mkdir -p src/components/states
mkdir -p src/lib
mkdir -p src/types

# 6. Dev mode (Chrome)
yarn dev:chrome

# 7. Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → select dist_chrome/
```

---

## Build & Deploy

```bash
# Development (with hot reload)
yarn dev:chrome

# Production build
yarn build:chrome

# The dist_chrome/ folder is ready to:
# 1. Load unpacked for testing
# 2. Zip and upload to Chrome Web Store
```

---

## Environment Variables / Secrets

Stored in `chrome.storage.local`:

| Key | Description |
|---|---|
| `partsiq_openrouter_key` | OpenRouter API key for AI calls |
| `partsiq_auth_status` | Whether user is logged in (from iframe postMessage) |
| `partsiq_active_session` | Current collection session ID + metadata |

> **Security note:** The OpenRouter API key is stored client-side in MVP. Post-MVP, proxy AI calls through a backend to avoid exposing the key in the extension.

---

## Estimation

| Task | Hours | SP | Owner |
|---|---|---|---|
| 1. Setup & Architecture | 5–7h | 2 | Claude Code |
| 2. Popup UI | 14–18h | 5 | Claude Code + Manual |
| 3. Bubble Embeddable Pages | 8–11h | 3 | Manual (Bubble) |
| 4. Dashboard Install + Launch | 6–8h | 3 | Manual (Bubble) |
| 5. AI Screenshot Scraping | 13–16h | 8 | Claude Code + Manual |
| **TOTAL** | **46–60h** | **21** | **~7–10 business days** |

---

## Order of Implementation

**Recommended build order:**

1. **Etapa 1: Setup** → clone boilerplate, clean up, scaffold structure, create lib modules
2. **Etapa 5: AI Scraping** → get screenshot + AI working (test in isolation)
3. **Etapa 2: Popup UI** → wire up React state machine with real AI data
4. **Etapa 3: Bubble Pages** → build iframe pages in Bubble (can be parallel with 2)
5. **Etapa 4: Dashboard** → install prompts and launch flow (last)

This order validates the hardest/riskiest part (AI accuracy) early.

---

## Testing Checklist

- [ ] `yarn dev:chrome` builds without errors
- [ ] Extension loads unpacked in Chrome
- [ ] Popup opens on any website
- [ ] Login via Bubble iframe works
- [ ] Screenshot capture returns base64 image
- [ ] AI returns structured part data from screenshot
- [ ] Parts passed to Bubble iframe via URL params
- [ ] Fallback to postMessage for large part lists
- [ ] Session creation and selection works
- [ ] Adding parts to existing session works
- [ ] URL change detection triggers re-scan prompt
- [ ] Manual refresh/re-scan button works
- [ ] Manual OEM input fallback works
- [ ] Branding matches PartsIQ
- [ ] Test on: Molco, Parts 360, WM Parts, LKQ, RA Parts, Bright Motive, PartsLink24
