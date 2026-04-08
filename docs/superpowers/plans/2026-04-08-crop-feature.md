# Crop Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Crop button to the sidebar footer that lets the user draw a selection rectangle on the page; the cropped region is sent to the existing AI extraction flow.

**Architecture:** A content script overlay handles drag-selection on the page and forwards coordinates to the background, which captures a viewport screenshot via CDP (no scroll), crops it with OffscreenCanvas, and sends the result back to the sidebar. The sidebar transitions through a new `'cropping'` state and feeds the pre-cropped image to `ScanningState` via an `overrideScreenshot` prop.

**Tech Stack:** TypeScript, React 19, Chrome Extension MV3, CDP (`chrome.debugger`), OffscreenCanvas, CSS `@keyframes`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/parts.ts` | Modify | Add `'cropping'` to `SidebarState` |
| `src/lib/translations.ts` | Modify | Add `crop`, `selectArea` keys (EN + NL) |
| `src/content/crop-overlay.ts` | **Create** | Overlay injection, drag-select UI, tutorial animation |
| `src/content/index.ts` | Modify | Import crop-overlay, listen for `show_crop_overlay` message |
| `src/background/index.ts` | Modify | Handle `start_crop` and `crop_selected` messages |
| `src/components/states/ScanningState.tsx` | Modify | Accept `overrideScreenshot?` prop to skip capture |
| `src/components/cart/CartFooter.tsx` | Modify | Add `onCrop` prop + Crop button |
| `src/pages/sidepanel/Sidebar.tsx` | Modify | `croppedImage` state, `triggerCrop()`, `crop_done`/`crop_cancelled` listener, `'cropping'` state render |

---

## Task 1: Add `'cropping'` to types + translations

**Files:**
- Modify: `src/types/parts.ts`
- Modify: `src/lib/translations.ts`

- [ ] **Step 1: Update `SidebarState` in `src/types/parts.ts`**

Replace:
```typescript
export type SidebarState =
  | 'login'
  | 'scanning'
  | 'cart'
  | 'done'; // shown after "Finalizar Busca"
```
With:
```typescript
export type SidebarState =
  | 'login'
  | 'scanning'
  | 'cropping'
  | 'cart'
  | 'done'; // shown after "Finalizar Busca"
```

- [ ] **Step 2: Add translation keys to `src/lib/translations.ts`**

In the `en` block, after `analyzingAI`:
```typescript
    crop:            'Crop',
    selectArea:      'Select an area on the page…',
```
In the `nl` block, after `analyzingAI`:
```typescript
    crop:            'Uitsnijden',
    selectArea:      'Selecteer een gebied op de pagina…',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn tsc --noEmit
```
Expected: no errors related to `SidebarState`.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/types/parts.ts src/lib/translations.ts
git commit -m "feat(crop): add cropping state type and translations"
```

---

## Task 2: Create crop overlay content script module

**Files:**
- Create: `src/content/crop-overlay.ts`

- [ ] **Step 1: Create `src/content/crop-overlay.ts` with full implementation**

```typescript
interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

let overlayEl: HTMLDivElement | null = null;

export function showCropOverlay(): void {
  if (overlayEl) return;

  // ── Inject styles ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'partsiq-crop-styles';
  style.textContent = `
    #partsiq-crop-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.45);
      z-index: 2147483647;
      cursor: crosshair;
      user-select: none;
    }
    #partsiq-crop-selection {
      display: none;
      position: fixed;
      border: 2px solid #00C6B2;
      background: rgba(0,198,178,0.08);
      pointer-events: none;
    }
    #partsiq-crop-hint {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: piq-hint-fade 2.5s ease forwards;
    }
    .piq-cursor {
      position: absolute;
      top: 0; left: 0;
      animation: piq-cursor-move 2.5s ease forwards;
    }
    .piq-hint-box {
      position: absolute;
      top: 20px; left: 20px;
      border: 2px dashed #00C6B2;
      border-radius: 2px;
      animation: piq-box-grow 2.5s ease forwards;
    }
    @keyframes piq-hint-fade {
      0%   { opacity: 0; }
      10%  { opacity: 1; }
      80%  { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes piq-cursor-move {
      0%   { transform: translate(0,0) scale(1); }
      20%  { transform: translate(0,0) scale(0.85); }
      30%  { transform: translate(0,0) scale(1); }
      85%  { transform: translate(120px,90px) scale(1); }
      100% { transform: translate(120px,90px) scale(1); }
    }
    @keyframes piq-box-grow {
      0%   { width:0; height:0; opacity:0; }
      30%  { width:0; height:0; opacity:1; }
      85%  { width:120px; height:90px; opacity:1; }
      100% { width:120px; height:90px; opacity:0; }
    }
  `;
  document.head.appendChild(style);

  // ── Create overlay ───────────────────────────────────────────────────────
  overlayEl = document.createElement('div');
  overlayEl.id = 'partsiq-crop-overlay';

  // Tutorial hint
  const hintEl = document.createElement('div');
  hintEl.id = 'partsiq-crop-hint';
  hintEl.innerHTML = `
    <div class="piq-cursor">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="white"
           style="filter:drop-shadow(1px 1px 2px rgba(0,0,0,0.7))">
        <path d="M3 0 L3 18 L7 14 L10 20 L12 19 L9 13 L14 13 Z"/>
      </svg>
    </div>
    <div class="piq-hint-box"></div>
  `;
  overlayEl.appendChild(hintEl);

  // Selection rectangle
  const selEl = document.createElement('div');
  selEl.id = 'partsiq-crop-selection';
  overlayEl.appendChild(selEl);

  document.body.appendChild(overlayEl);

  // Remove hint after animation
  let hintGone = false;
  const removeHint = () => {
    if (hintGone) return;
    hintGone = true;
    hintEl.remove();
  };
  const hintTimer = setTimeout(removeHint, 2500);

  // ── Drag logic ───────────────────────────────────────────────────────────
  let dragging = false;
  let startX = 0, startY = 0;

  const onMouseDown = (e: MouseEvent) => {
    clearTimeout(hintTimer);
    removeHint();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selEl.style.display = 'block';
    selEl.style.left   = startX + 'px';
    selEl.style.top    = startY + 'px';
    selEl.style.width  = '0px';
    selEl.style.height = '0px';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selEl.style.left   = x + 'px';
    selEl.style.top    = y + 'px';
    selEl.style.width  = w + 'px';
    selEl.style.height = h + 'px';
  };

  const onMouseUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 20 || h < 20) {
      selEl.style.display = 'none';
      return; // too small — let user retry
    }

    cleanup();
    const rect: CropRect = { x, y, width: w, height: h, devicePixelRatio: window.devicePixelRatio };
    safeSend({ type: 'crop_selected', rect });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
      safeSend({ type: 'crop_cancelled' });
    }
  };

  overlayEl.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);

  function cleanup() {
    clearTimeout(hintTimer);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
    overlayEl?.remove();
    document.getElementById('partsiq-crop-styles')?.remove();
    overlayEl = null;
  }
}

function safeSend(msg: object): void {
  if (!chrome.runtime?.id) return;
  chrome.runtime.sendMessage(msg).catch(() => {});
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/content/crop-overlay.ts
git commit -m "feat(crop): add crop overlay content script module with tutorial animation"
```

---

## Task 3: Wire crop overlay into content script

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Add import and message listener to `src/content/index.ts`**

At the top of the file, add the import:
```typescript
import { showCropOverlay } from './crop-overlay';
```

At the bottom of the file, add:
```typescript
// Crop overlay trigger from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'show_crop_overlay') {
    showCropOverlay();
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/content/index.ts
git commit -m "feat(crop): wire crop overlay into content script"
```

---

## Task 4: Add crop message handlers to background service worker

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Add helper function `dataUrlToImageBytes` before the message listener**

Add this helper before the `chrome.runtime.onMessage.addListener` call:

```typescript
/** Convert a base64 data URL to Uint8Array without FileReader (safe in SW). */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Convert Uint8Array to base64 data URL. */
function bytesToDataUrl(bytes: Uint8Array, mimeType = 'image/jpeg'): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}
```

- [ ] **Step 2: Add `start_crop` case inside the existing `switch (msg.type)` block**

Add after the `case 'url_changed':` block:

```typescript
    case 'start_crop':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) { sendResponse({ error: 'No active tab' }); return; }
          await chrome.tabs.sendMessage(tab.id, { type: 'show_crop_overlay' });
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
      return true;
```

- [ ] **Step 3: Add `crop_selected` case inside the existing `switch (msg.type)` block**

Add after the `start_crop` case:

```typescript
    case 'crop_selected':
      (async () => {
        const { rect } = msg as {
          rect: { x: number; y: number; width: number; height: number; devicePixelRatio: number };
        };
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) throw new Error('No active tab');

          // Capture visible viewport only (no scroll — user drew selection on visible area)
          await chrome.debugger.attach({ tabId: tab.id }, '1.3');
          let fullBase64: string;
          try {
            const result = await chrome.debugger.sendCommand(
              { tabId: tab.id },
              'Page.captureScreenshot',
              { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }
              // captureBeyondViewport intentionally omitted — visible viewport only
            ) as { data: string };
            fullBase64 = `data:image/jpeg;base64,${result.data}`;
          } finally {
            await chrome.debugger.detach({ tabId: tab.id }).catch(() => {});
          }

          // Crop via OffscreenCanvas
          const dpr = rect.devicePixelRatio;
          const srcBytes = dataUrlToBytes(fullBase64);
          const blob = new Blob([srcBytes], { type: 'image/jpeg' });
          const bitmap = await createImageBitmap(blob);

          const cw = Math.round(rect.width  * dpr);
          const ch = Math.round(rect.height * dpr);
          const canvas = new OffscreenCanvas(cw, ch);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(
            bitmap,
            Math.round(rect.x * dpr), Math.round(rect.y * dpr),
            Math.round(rect.width * dpr), Math.round(rect.height * dpr),
            0, 0, cw, ch
          );

          const cropBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
          const cropBytes = new Uint8Array(await cropBlob.arrayBuffer());
          const croppedDataUrl = bytesToDataUrl(cropBytes);

          chrome.runtime.sendMessage({ type: 'crop_done', screenshot: croppedDataUrl }).catch(() => {});
        } catch (err) {
          chrome.runtime.sendMessage({ type: 'crop_error', error: String(err) }).catch(() => {});
        }
      })();
      return true;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/background/index.ts
git commit -m "feat(crop): handle start_crop and crop_selected in background service worker"
```

---

## Task 5: Update ScanningState to accept pre-cropped image

**Files:**
- Modify: `src/components/states/ScanningState.tsx`

- [ ] **Step 1: Add `overrideScreenshot` prop**

Replace the `Props` interface:
```typescript
interface Props {
  tabUrl?: string;
  lang: Lang;
  overrideScreenshot?: string;
  onFound: (parts: PartData[], tabUrl: string) => void;
  onNotFound: () => void;
}
```

Replace the component signature:
```typescript
const ScanningState = ({ tabUrl = '', lang, overrideScreenshot, onFound, onNotFound }: Props) => {
```

- [ ] **Step 2: Use `overrideScreenshot` in `runScan`**

Replace the line:
```typescript
      const base64 = await captureScreenshot();
```
With:
```typescript
      const base64 = overrideScreenshot ?? await captureScreenshot();
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/components/states/ScanningState.tsx
git commit -m "feat(crop): add overrideScreenshot prop to ScanningState"
```

---

## Task 6: Add Crop button to CartFooter

**Files:**
- Modify: `src/components/cart/CartFooter.tsx`

- [ ] **Step 1: Add `onCrop` prop and `isBusy` to `CartFooter`**

Replace the `Props` interface:
```typescript
interface Props {
  totalCount: number;
  selectedCount: number;
  sentCount: number;
  isScanning: boolean;
  isCropping: boolean;
  lang: Lang;
  onRescan: () => void;
  onCrop: () => void;
  onClear: () => void;
  onFinish: () => void;
}
```

Replace the component signature:
```typescript
const CartFooter = ({ totalCount, selectedCount, sentCount, isScanning, isCropping, lang, onRescan, onCrop, onClear, onFinish }: Props) => {
```

- [ ] **Step 2: Add `isBusy` derived variable and Crop button**

Add after `const t = T[lang];`:
```typescript
  const isBusy = isScanning || isCropping;
```

Replace `disabled={isScanning}` on the Re-scan button with `disabled={isBusy}`.

Replace `disabled={isScanning}` on the Finish button with `disabled={isBusy}`.

Add the Crop button between the Re-scan button and Finish button:
```tsx
        <button
          onClick={onCrop}
          disabled={isBusy}
          className="flex items-center gap-1.5 min-h-[45px] px-4 py-2.5 bg-white border border-black text-black text-sm font-normal rounded-[100px] transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCropping ? (
            <>
              <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              {t.selectArea}
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h4.5v2H5v2.5H3V3zm13.5 0H21v4.5h-2V5h-2.5V3zM3 16.5h2V19h2.5v2H3v-4.5zm13.5 2.5H19v-2.5h2V21h-4.5v-2z" />
              </svg>
              {t.crop}
            </>
          )}
        </button>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn tsc --noEmit
```
Expected: no errors (Sidebar.tsx will show errors until Task 7 — that is expected at this stage).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/components/cart/CartFooter.tsx
git commit -m "feat(crop): add Crop button to CartFooter"
```

---

## Task 7: Wire crop flow in Sidebar

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx`

- [ ] **Step 1: Add `croppedImage` state**

After the existing `const [urlChangeBanner, ...]` state line, add:
```typescript
  const [croppedImage, setCroppedImage] = useState<string | undefined>(undefined);
```

- [ ] **Step 2: Extend the message listener to handle crop messages**

Inside the existing `const listener = (msg: ...) => { ... }` function, add after the `sidebar_opened` check:
```typescript
      if (msg.type === 'crop_done' && msg.screenshot) {
        setCroppedImage(msg.screenshot as string);
        setState('scanning');
      }
      if (msg.type === 'crop_cancelled' || msg.type === 'crop_error') {
        setState('cart');
      }
```

Update the listener's type annotation to include the new fields:
```typescript
    const listener = (msg: { type: string; url?: string; screenshot?: string }) => {
```

- [ ] **Step 3: Add `triggerCrop` callback**

After the existing `triggerScan` callback, add:
```typescript
  const triggerCrop = useCallback(async () => {
    if (!vehicle) {
      setVehicleExpanded(true);
      return;
    }
    setUrlChangeBanner(null);
    setState('cropping');
    try {
      await chrome.runtime.sendMessage({ type: 'start_crop' });
    } catch {
      setState('cart');
    }
  }, [vehicle]);
```

- [ ] **Step 4: Clear `croppedImage` when scan finishes**

In `handlePartsFound`, add `setCroppedImage(undefined);` as the first line:
```typescript
  const handlePartsFound = useCallback((parts: PartData[], tabUrl: string) => {
    setCroppedImage(undefined);
    // ... rest of existing code unchanged
```

In the `onNotFound` callback passed to `ScanningState` (inside the JSX), replace:
```tsx
          onNotFound={() => setState('cart')}
```
With:
```tsx
          onNotFound={() => { setCroppedImage(undefined); setState('cart'); }}
```

- [ ] **Step 5: Update `isScanning` → `isBusy` variables and pass new props**

Replace the existing derived variables block:
```typescript
  const selectedCount = cart.filter(i => i.checked).length;
  const sentCount     = cart.filter(i => i.status === 'sent').length;
  const isScanning    = state === 'scanning';
```
With:
```typescript
  const selectedCount = cart.filter(i => i.checked).length;
  const sentCount     = cart.filter(i => i.status === 'sent').length;
  const isScanning    = state === 'scanning';
  const isCropping    = state === 'cropping';
```

Update the `CartFooter` JSX to pass the new props:
```tsx
    <CartFooter
      totalCount={cart.length}
      selectedCount={selectedCount}
      sentCount={sentCount}
      isScanning={isScanning}
      isCropping={isCropping}
      lang={lang}
      onRescan={triggerScan}
      onCrop={triggerCrop}
      onClear={() => {
        clearCart();
        setCartState([]);
      }}
      onFinish={handleFinish}
    />
```

- [ ] **Step 6: Pass `overrideScreenshot` to `ScanningState`**

Find the `<ScanningState` JSX and add the prop:
```tsx
        <ScanningState
          tabUrl={activeTabUrl}
          lang={lang}
          overrideScreenshot={croppedImage}
          onFound={(parts, tabUrl) => handlePartsFound(parts, tabUrl)}
          onNotFound={() => { setCroppedImage(undefined); setState('cart'); }}
        />
```

- [ ] **Step 7: Add `'cropping'` state render**

After the `state === 'done'` block and before `const selectedCount = ...`, add:

```tsx
  // ── Render: cropping (waiting for user to draw selection on page) ─────────
  if (state === 'cropping') {
    const footer = (
      <CartFooter
        totalCount={cart.length}
        selectedCount={cart.filter(i => i.checked).length}
        sentCount={cart.filter(i => i.status === 'sent').length}
        isScanning={false}
        isCropping={true}
        lang={lang}
        onRescan={triggerScan}
        onCrop={triggerCrop}
        onClear={() => { clearCart(); setCartState([]); }}
        onFinish={handleFinish}
      />
    );
    return (
      <SidebarLayout
        vehiclePanel={vehiclePanelNode}
        vehiclePanelExpanded={vehicleExpanded}
        footer={footer}
      >
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#00C6B2] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 3h4.5v2H5v2.5H3V3zm13.5 0H21v4.5h-2V5h-2.5V3zM3 16.5h2V19h2.5v2H3v-4.5zm13.5 2.5H19v-2.5h2V21h-4.5v-2z"/>
            </svg>
          </div>
          <p className="text-sm text-gray-600">{T[lang].selectArea}</p>
          <button
            onClick={() => setState('cart')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            {T[lang].cancel}
          </button>
        </div>
      </SidebarLayout>
    );
  }
```

Note: `vehiclePanelNode` is referenced here but is defined below. Move its definition above the `state === 'done'` block, or inline it. The safest fix is to define `vehiclePanelNode` early in the component, before any conditional returns. Move this block:
```tsx
  const vehiclePanelNode = (
    <VehiclePanel
      vehicle={vehicle}
      expanded={vehicleExpanded}
      lang={lang}
      onVehicleSelected={(v) => { ... }}
      onExpand={() => setVehicleExpanded(true)}
    />
  );
```
to just after the `handleFinish` callback, before the `if (!isLoggedIn)` block.

- [ ] **Step 8: Verify TypeScript compiles with no errors**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git add src/pages/sidepanel/Sidebar.tsx
git commit -m "feat(crop): wire crop flow into Sidebar — cropping state, triggerCrop, crop_done listener"
```

---

## Task 8: Build and manual smoke test

- [ ] **Step 1: Build the extension**

```bash
cd C:/Users/Fillipe/partsiq-extension && yarn build:chrome
```
Expected: build completes with no errors, `dist_chrome/` updated.

- [ ] **Step 2: Load in Chrome and test Scan button (regression)**

1. Open `chrome://extensions/` → reload the PartsIQ extension
2. Open any supplier page (e.g., autodoc.nl)
3. Open PartsIQ sidebar, select a vehicle
4. Click **Re-scan** → scan runs normally → parts appear in cart
5. Expected: existing scan flow unchanged

- [ ] **Step 3: Test Crop button basic flow**

1. On a supplier page with visible parts
2. Click **Crop** button
3. Expected: sidebar shows *"Select an area on the page…"* with cancel button
4. Expected: overlay appears on the page with dark background + tutorial animation (~2.5 s)
5. After animation, drag a rectangle over part data
6. Expected: overlay disappears, sidebar transitions to scanning state, parts extracted from cropped region appear in cart

- [ ] **Step 4: Test tutorial animation**

1. Click Crop
2. Watch for cursor animation moving diagonally with dashed box growing
3. Expected: animation plays ~2.5 s then fades, cursor becomes crosshair

- [ ] **Step 5: Test ESC cancel**

1. Click Crop → overlay appears
2. Press ESC
3. Expected: overlay disappears, sidebar returns to cart state

- [ ] **Step 6: Test too-small selection (< 20×20 px)**

1. Click Crop → overlay appears
2. Click without dragging (or drag tiny area)
3. Expected: selection clears, overlay stays, user can retry

- [ ] **Step 7: Final commit**

```bash
cd C:/Users/Fillipe/partsiq-extension
git commit --allow-empty -m "feat(crop): crop selection feature complete"
```
