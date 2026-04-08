# Crop Feature Design

**Date:** 2026-04-08
**Status:** Approved

## Overview

Add a **Crop** button alongside the existing **Re-scan** button in the sidebar footer. Crop mode lets the user draw a selection rectangle directly on the page and sends only that region through the existing AI extraction flow.

---

## State Machine

New state `'cropping'` added to `SidebarState`:

```
cart → [Crop clicked]        → cropping → [user selects area] → scanning (with pre-cropped image) → cart
cart → [Scan/Re-scan clicked] → scanning (current flow)                                           → cart
```

During `'cropping'`, the sidebar displays a message like *"Select an area on the page…"* plus a **Cancel** button that exits back to `'cart'`.

---

## Message Flow

```
Sidebar  →  background:     { type: 'start_crop', tabId }
Background  →  content script: { type: 'show_crop_overlay' }

[user draws rectangle on page]

Content script  →  background:  { type: 'crop_selected', rect: { x, y, width, height } }
Background: captureVisibleTab (no scroll) + crop via OffscreenCanvas
Background  →  Sidebar:     { type: 'crop_done', screenshot: base64 }

Sidebar: sets croppedImage state, transitions to 'scanning'
ScanningState: receives overrideScreenshot prop → skips captureScreenshot(), uses provided image
```

---

## Crop Overlay (content script)

File: `src/content/crop-overlay.ts`

**Lifecycle:**
1. Receives `show_crop_overlay` message → injects overlay DOM + styles into page
2. Shows tutorial animation for ~2.5 s (or cancels early on first mousedown)
3. User clicks + drags → live selection rectangle rendered
4. On mouseup → sends `crop_selected` with rect coordinates → removes overlay
5. ESC key → cancels → sends `crop_cancelled` → removes overlay

**Overlay DOM structure:**
```
#partsiq-crop-overlay (fixed, full viewport, cursor: crosshair, z-index: 2147483647)
  #partsiq-crop-hint      (tutorial animation — cursor + dashed box keyframes)
  #partsiq-crop-selection (live selection rectangle, border: 2px solid #00C6B2)
```

**Coordinate space:** DOM viewport coordinates (px). No scroll offset needed because `captureVisibleTab` captures only the visible viewport.

---

## Tutorial Animation

Shown inside the overlay for ~2.5 s before the user interacts.

**Sequence (CSS @keyframes):**
1. Animated cursor icon fades in at center of screen
2. Cursor pulses (simulating click-down)
3. Cursor moves diagonally (bottom-right) while a dashed rectangle grows from the origin
4. Rectangle fully drawn → brief pause → everything fades out
5. Animation removed; user can now draw freely

Implementation: `<style>` tag injected alongside the overlay, pure CSS `@keyframes`. Removed on first `mousedown` or after animation completes.

---

## Cropping Logic (background)

On `crop_selected`:
1. `chrome.tabs.captureVisibleTab` → full viewport JPEG base64
2. Decode image via `createImageBitmap` (supported in MV3 service worker)
3. Get device pixel ratio from the rect message (content script includes `window.devicePixelRatio`)
4. Scale rect coordinates by DPR → pixel coordinates in the captured image
5. Draw crop onto `OffscreenCanvas(rect.width * dpr, rect.height * dpr)`
6. `canvas.convertToBlob('image/jpeg')` → base64 → send `crop_done` to sidebar

---

## Files Changed

| File | Change |
|------|--------|
| `src/content/crop-overlay.ts` | **new** — overlay injection, drag selection, tutorial animation |
| `src/background/index.ts` | add handlers for `start_crop`, `crop_selected` |
| `src/components/cart/CartFooter.tsx` | add `onCrop` prop + Crop button (scissors icon, outlined style) |
| `src/components/states/ScanningState.tsx` | add `overrideScreenshot?: string` prop — skips capture if provided |
| `src/pages/sidepanel/Sidebar.tsx` | add `'cropping'` state, `triggerCrop()`, `crop_done` / `crop_cancelled` listener |
| `src/types/parts.ts` | add `'cropping'` to `SidebarState` union |
| `src/lib/translations.ts` | add keys: `crop`, `cropping`, `selectArea`, `cropCancel` (NL + EN) |
| `manifest.json` | ensure `content_scripts` covers `<all_urls>` or add `scripting` permission for dynamic injection |

---

## Error Handling

- If content script is not reachable (restricted page): background sends `crop_error` → sidebar shows toast and returns to `'cart'`
- If user cancels (ESC): `crop_cancelled` message → sidebar returns to `'cart'`
- If crop region is too small (< 20×20 px): overlay ignores mouseup, user must re-draw

---

## Out of Scope

- Multi-crop (selecting multiple regions in one session)
- Crop within the sidebar miniature (Option B)
- Saving crop coordinates for reuse
