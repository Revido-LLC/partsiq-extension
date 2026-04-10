# Layout & Design Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align CartFooter buttons to the right with Bubble design tokens, make OEM pencil icon more visible, and disable checkbox when part has no OEM number.

**Architecture:** Pure UI changes to two components. No new files needed. Design tokens applied via Tailwind inline values (`bg-[#00C6B2]` etc.) since Tailwind 4 is already in use. Tooltip implemented with a Tailwind `group` hover pattern — no extra dependencies.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, Vite. Build: `yarn build:chrome` → `dist_chrome/`. Reload at `chrome://extensions` after each build.

---

## Files to Modify

| File | Changes |
|---|---|
| `src/components/cart/CartFooter.tsx` | Button styles (Primary + Outline per Bubble tokens), right-align buttons row |
| `src/components/cart/CartPartCard.tsx` | OEM pencil icon bigger + more visible; checkbox disabled + tooltip when no OEM |

---

## Task 1: CartFooter — Bubble Button Styles + Right Alignment

**Files:**
- Modify: `src/components/cart/CartFooter.tsx`

- [ ] **Step 1: Replace the buttons row with the updated layout**

Replace the entire `{/* Buttons row */}` block (lines 31–67) with:

```tsx
{/* Buttons row */}
<div className="flex items-center justify-end gap-2">
  {totalCount > 0 && (
    <button
      onClick={onClear}
      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded transition-colors"
    >
      {t.clear}
    </button>
  )}
  <button
    onClick={onRescan}
    disabled={isScanning}
    className="flex items-center gap-1.5 min-h-[45px] px-4 py-2.5 bg-white border border-black text-black text-sm font-normal rounded-[100px] transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isScanning ? (
      <>
        <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
        {t.scanning}
      </>
    ) : (
      <>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {t.rescan}
      </>
    )}
  </button>
  <button
    onClick={onFinish}
    disabled={isScanning}
    className="flex items-center gap-1.5 min-h-[45px] px-4 py-2.5 bg-[#00C6B2] text-[#473150] text-sm font-semibold rounded-full transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {t.finish}
  </button>
</div>
```

Key changes vs current code:
- `justify-end` added to buttons row → right-aligned
- Rescan: `bg-white border border-black text-black font-normal rounded-[100px] min-h-[45px] px-4 py-2.5 text-sm` (Outline style)
- Finish: `bg-[#00C6B2] text-[#473150] font-semibold rounded-full min-h-[45px] px-4 py-2.5 text-sm` (Primary style)
- Spinner border changed to `border-black` on Rescan (matches outline text color)

- [ ] **Step 2: Build and verify**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome
```

Expected: build completes with no TypeScript errors. Then reload extension at `chrome://extensions` and confirm:
- Buttons appear on the right side of the footer
- Rescan = white/outlined pill button, h≥45px
- Finish = teal (`#00C6B2`) pill button with dark purple text, h≥45px

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension
git add src/components/cart/CartFooter.tsx
git commit -m "style: update CartFooter buttons to match Bubble design tokens"
```

---

## Task 2: CartPartCard — OEM Pencil Icon + Checkbox Disabled State

**Files:**
- Modify: `src/components/cart/CartPartCard.tsx`

- [ ] **Step 1: Make pencil icon more visible**

Find the pencil SVG (line 94) and update its classes:

```tsx
// Before:
<svg className="w-2.5 h-2.5 text-gray-300 group-hover:text-blue-400 transition-colors" ...>

// After:
<svg className="w-4 h-4 text-[#525252] group-hover:text-[#000000] transition-colors" ...>
```

Only the `className` changes — the SVG path stays identical.

- [ ] **Step 2: Add `hasOem` constant and update checkbox**

At the top of the component body (after line 22, after `const { part, status, checked, id, errorMessage } = item;`), add:

```tsx
const hasOem = Boolean(part.oemNumber && part.oemNumber.trim() !== '');
```

Then replace the checkbox wrapper `<div className="pt-0.5">` block (lines 46–54) with:

```tsx
{/* Checkbox — disabled when no OEM */}
<div className="relative group/oemtip pt-0.5">
  <input
    type="checkbox"
    checked={checked}
    disabled={status === 'sending' || !hasOem}
    onChange={() => onToggle(id)}
    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
  />
  {!hasOem && (
    <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/oemtip:block bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-20">
      Add an OEM number to select this part
    </div>
  )}
</div>
```

- [ ] **Step 3: Build and verify**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome
```

Expected: build completes with no TypeScript errors. Reload extension at `chrome://extensions` and confirm:
- Pencil icon is clearly visible (`16px`, gray at rest, black on hover)
- Part with OEM: checkbox works normally
- Part without OEM: checkbox is dimmed, not clickable; hovering shows tooltip "Add an OEM number to select this part"

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension
git add src/components/cart/CartPartCard.tsx
git commit -m "style: larger OEM pencil icon; disable checkbox when no OEM with tooltip"
```
