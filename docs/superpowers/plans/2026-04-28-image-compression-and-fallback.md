# Image Compression & FallbackState Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `compressImage` to reduce image size before sending to Gemini, fixing 504 timeouts; redesign FallbackState to show Scan + Crop + Clear instead of Retry.

**Architecture:** `compressImage` lives in `image-utils.ts` and is called in `Sidebar.tsx` right after capturing (handleScan) or receiving (crop_ready) an image — before `extractPartsFromScreenshot`. FallbackState receives a new `onClear` prop for the Clear button; `handleClear` in Sidebar resets to idle. A new i18n key `clear` is added for the button label.

**Tech Stack:** TypeScript, React 19, Vitest, jsdom, OffscreenCanvas/ImageBitmap (Web APIs), Chrome Extension Manifest V3

---

## File Map

| File | Change |
|------|--------|
| `src/lib/image-utils.ts` | Add exported `compressImage` function |
| `src/lib/image-utils.test.ts` | Add `compressImage` test suite (5 tests) |
| `src/lib/i18n.ts` | Add `clear` key to both `en` and `nl` |
| `src/pages/sidepanel/Sidebar.tsx` | Import `compressImage`; call it in `handleScan` and `crop_ready`; add `handleClear`; pass `onClear` to `FallbackState` |
| `src/components/states/FallbackState.tsx` | Add `onClear` prop; add Clear button |

---

### Task 1: `compressImage` — failing tests first

**Files:**
- Modify: `src/lib/image-utils.test.ts`

- [ ] **Step 1: Add the failing `compressImage` test suite to the existing test file**

Append after the closing `});` of the `dataUrlToBlob` describe block. The full addition:

```typescript
// ── compressImage ───────────────────────────────────────────────────────────

describe('compressImage', () => {
  // jsdom has no OffscreenCanvas or createImageBitmap — mock both.

  let mockCtx: { drawImage: ReturnType<typeof vi.fn> };
  let mockCanvas: {
    width: number;
    height: number;
    getContext: ReturnType<typeof vi.fn>;
    convertToBlob: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCtx = { drawImage: vi.fn() };
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' })),
    };

    vi.stubGlobal(
      'OffscreenCanvas',
      vi.fn().mockImplementation((w: number, h: number) => {
        mockCanvas.width = w;
        mockCanvas.height = h;
        return mockCanvas;
      }),
    );

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 2800, height: 2100, close: vi.fn() }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a data URL string starting with data:image/jpeg', async () => {
    const { compressImage } = await import('./image-utils');
    const result = await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('scales down a landscape image so the longest side equals maxSide', async () => {
    // bitmap: 2800×2100 → scale = 1400/2800 = 0.5 → canvas 1400×1050
    const { compressImage } = await import('./image-utils');
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(OffscreenCanvas).toHaveBeenCalledWith(1400, 1050);
  });

  it('scales down a portrait image so the longest side equals maxSide', async () => {
    // bitmap: 700×2800 → scale = 1400/2800 = 0.5 → canvas 350×1400
    (createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValue({
      width: 700,
      height: 2800,
      close: vi.fn(),
    });
    const { compressImage } = await import('./image-utils');
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(OffscreenCanvas).toHaveBeenCalledWith(350, 1400);
  });

  it('does not upscale when image is already smaller than maxSide', async () => {
    // bitmap: 800×600 → scale = min(1, 1400/800) = 1 → canvas 800×600
    (createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn(),
    });
    const { compressImage } = await import('./image-utils');
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(OffscreenCanvas).toHaveBeenCalledWith(800, 600);
  });

  it('passes the quality parameter to convertToBlob', async () => {
    const { compressImage } = await import('./image-utils');
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.72 });
  });
});
```

Add `import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';` to the existing import line at the top.

Current import line (line 2):
```typescript
import { describe, it, expect } from 'vitest';
```

Replace with:
```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
```

- [ ] **Step 2: Run the new tests and confirm they fail**

```bash
cd C:/Users/Fillipe/partsiq-extension
npx vitest run src/lib/image-utils.test.ts
```

Expected: 5 failures containing `compressImage is not a function` or similar — the function does not exist yet. The `dataUrlToBlob` tests should still pass (5 pass, 5 fail).

---

### Task 2: Implement `compressImage` in `image-utils.ts`

**Files:**
- Modify: `src/lib/image-utils.ts`
- Test: `src/lib/image-utils.test.ts`

- [ ] **Step 3: Add `compressImage` to `image-utils.ts`**

Append after `dataUrlToBlob`:

```typescript
/**
 * Resize and recompress an image.
 *
 * - If the largest dimension is greater than `maxSide`, the image is scaled
 *   down proportionally so that the largest side equals `maxSide`.
 * - If both sides are already ≤ `maxSide`, scale = 1 (no resize, only
 *   JPEG recompression is applied).
 * - Always outputs JPEG regardless of the input format.
 *
 * @param dataUrl  Full data URL including the `data:<mime>;base64,` header.
 * @param maxSide  Maximum pixel length of the longest side.
 * @param quality  JPEG quality in the 0–1 range (e.g. 0.72).
 * @returns        New data URL (`data:image/jpeg;base64,...`).
 */
export async function compressImage(
  dataUrl: string,
  maxSide: number,
  quality: number,
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(outBlob);
  });
}
```

- [ ] **Step 4: Run the tests and confirm they all pass**

```bash
npx vitest run src/lib/image-utils.test.ts
```

Expected: 10 tests pass (5 `dataUrlToBlob` + 5 `compressImage`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/image-utils.ts src/lib/image-utils.test.ts
git commit -m "feat: add compressImage to image-utils"
```

---

### Task 3: Call `compressImage` in `Sidebar.tsx`

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx`

- [ ] **Step 6: Import `compressImage` at the top of `Sidebar.tsx`**

Current import (line 13):
```typescript
import { captureScreenshot } from '@lib/screenshot';
```

Replace with:
```typescript
import { captureScreenshot } from '@lib/screenshot';
import { compressImage } from '@lib/image-utils';
```

- [ ] **Step 7: Apply compression in `handleScan` (scan flow)**

Current `handleScan` (lines 263–275):
```typescript
const handleScan = async () => {
  setState('scanning');
  setScanError(null);
  setScanScreenshot(null);
  try {
    const dataUrl = await captureScreenshot();
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    setScanScreenshot(base64);
    await processScan(base64);
  } catch (err) {
    setScanError(String(err));
  }
};
```

Replace with:
```typescript
const handleScan = async () => {
  setState('scanning');
  setScanError(null);
  setScanScreenshot(null);
  try {
    const dataUrl = await captureScreenshot();
    const compressedDataUrl = await compressImage(dataUrl, 1400, 0.72);
    const base64 = compressedDataUrl.includes(',') ? compressedDataUrl.split(',')[1] : compressedDataUrl;
    setScanScreenshot(base64);
    await processScan(base64);
  } catch (err) {
    setScanError(String(err));
  }
};
```

- [ ] **Step 8: Apply compression in the `crop_ready` handler**

Current `crop_ready` handler block (lines 108–118):
```typescript
if (msg.type === 'crop_ready') {
  if (msg.error) {
    setScanError(msg.error);
    setState('scanning');
  } else if (msg.imageBase64) {
    setState('scanning');
    setScanScreenshot(null);
    const raw = msg.imageBase64;
    const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
    processScanRef.current(base64, true);
  }
}
```

Replace with:
```typescript
if (msg.type === 'crop_ready') {
  if (msg.error) {
    setScanError(msg.error);
    setState('scanning');
  } else if (msg.imageBase64) {
    setState('scanning');
    setScanScreenshot(null);
    void (async () => {
      const raw = msg.imageBase64!;
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      const compressedDataUrl = await compressImage(
        `data:image/jpeg;base64,${base64}`,
        1400,
        0.75,
      );
      const compressedBase64 = compressedDataUrl.includes(',')
        ? compressedDataUrl.split(',')[1]
        : compressedDataUrl;
      processScanRef.current(compressedBase64, true);
    })();
  }
}
```

- [ ] **Step 9: Build to check for TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/pages/sidepanel/Sidebar.tsx
git commit -m "feat: compress images before AI extraction in scan and crop flows"
```

---

### Task 4: FallbackState — add Clear button

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `src/components/states/FallbackState.tsx`
- Modify: `src/pages/sidepanel/Sidebar.tsx`

- [ ] **Step 11: Add `clear` translation key to `i18n.ts`**

In the `en` block, after `retry: 'Retry',` (line 28):
```typescript
    retry: 'Retry',
```

Replace with:
```typescript
    retry: 'Retry',
    clear: 'Clear',
```

In the `nl` block, after `retry: 'Opnieuw',` (line 61):
```typescript
    retry: 'Opnieuw',
```

Replace with:
```typescript
    retry: 'Opnieuw',
    clear: 'Wissen',
```

- [ ] **Step 12: Add `onClear` prop and Clear button to `FallbackState.tsx`**

Current Props interface (lines 5–11):
```typescript
interface Props {
  lang: Lang;
  cart: CartItem[];
  onAddManual: (item: CartItem) => void;
  onCrop: () => void;
  onScan: () => void;
}
```

Replace with:
```typescript
interface Props {
  lang: Lang;
  cart: CartItem[];
  onAddManual: (item: CartItem) => void;
  onCrop: () => void;
  onScan: () => void;
  onClear: () => void;
}
```

Current function signature (line 13):
```typescript
export default function FallbackState({ lang, cart, onAddManual, onCrop, onScan }: Props) {
```

Replace with:
```typescript
export default function FallbackState({ lang, cart, onAddManual, onCrop, onScan, onClear }: Props) {
```

The Scan/Crop button row (lines 45–69) currently ends after the Scan button's closing `</button>` and the outer `</div>`. Add the Clear button after the Scan button, before the closing `</div>`:

Current (lines 59–69):
```typescript
        <button
          onClick={onScan}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E6E6E6] text-black text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          {t.scan}
        </button>
      </div>
```

Replace with:
```typescript
        <button
          onClick={onScan}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E6E6E6] text-black text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          {t.scan}
        </button>
        <button
          onClick={onClear}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E6E6E6] text-[#525252] text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          {t.clear}
        </button>
      </div>
```

- [ ] **Step 13: Add `handleClear` to `Sidebar.tsx` and pass `onClear` to `FallbackState`**

In `Sidebar.tsx`, add `handleClear` after `handleCrop` (after line 293):

```typescript
const handleClear = () => {
  setCartState([]);
  void setCart([]);
  setIframeReady(false);
  setVehicleExpanded(true);
  setState('idle');
};
```

Then update the FallbackState render (lines 419–431):

Current:
```typescript
          <FallbackState
            lang={lang}
            cart={cart}
            onScan={handleScan}
            onAddManual={(item) => {
              const updated = [...cartRef.current, item];
              setCartState(updated);
              void setCart(updated);
              setState('cart');
            }}
            onCrop={handleCrop}
          />
```

Replace with:
```typescript
          <FallbackState
            lang={lang}
            cart={cart}
            onScan={handleScan}
            onAddManual={(item) => {
              const updated = [...cartRef.current, item];
              setCartState(updated);
              void setCart(updated);
              setState('cart');
            }}
            onCrop={handleCrop}
            onClear={handleClear}
          />
```

- [ ] **Step 14: Build to check for TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 15: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 16: Commit**

```bash
git add src/lib/i18n.ts src/components/states/FallbackState.tsx src/pages/sidepanel/Sidebar.tsx
git commit -m "feat: redesign FallbackState with Scan/Crop/Clear buttons"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|-----------------|-----------|
| `compressImage(dataUrl, maxSide, quality)` in `image-utils.ts` | Task 1 + 2 |
| Tests for `compressImage` | Task 1 |
| Scan: compress with maxSide=1400, quality=0.72 | Task 3, Step 7 |
| Crop: compress with maxSide=1400, quality=0.75 | Task 3, Step 8 |
| Timeout in `ai.ts` unchanged | Not touched — correct |
| FallbackState: no Retry button | Task 4 (Retry never existed in current code — not needed) |
| FallbackState: Scan button | Already present — not touched |
| FallbackState: Crop button | Already present — not touched |
| FallbackState: Finish/Clear button | Task 4, Step 12 |
| No extra state in Sidebar | `handleClear` uses existing state setters only |
