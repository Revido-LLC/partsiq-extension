# Design: Cart UI Redesign — Banner removal, button repositioning, icons

**Date:** 2026-04-16

## Overview

Three visual changes to the `CartState` + `Sidebar` layout:

1. Remove the "Page changed — scan now?" banner entirely
2. Move Crop/Scan buttons above the cart list (below the vehicle/order panel header), with icons
3. Move Clear unsent + Finish search to the same line in the footer, with icons

---

## Final Layout

```
┌─────────────────────────────┐
│ HJK-03-D      Change vehicle│  ← VehiclePanel / OrderPanel (unchanged)
├─────────────────────────────┤
│ [✂ Crop selection][⊡ Scan] │  ← NEW position for scan buttons (same line, with icons)
├─────────────────────────────┤
│  ... cart items ...          │
│  + Add part manually         │
├─────────────────────────────┤
│ [🗑 Clear unsent][✓ Finish] │  ← footer: same line, icons added
└─────────────────────────────┘
```

---

## Change 1 — Remove "Page changed" banner

**Files:** `src/components/states/CartState.tsx`, `src/pages/sidepanel/Sidebar.tsx`

### CartState.tsx
- Remove `pendingUrl: string | null` from `Props`
- Remove `onScan: () => void` from `Props`
- Remove `onDismissBanner: () => void` from `Props`
- Remove the entire banner JSX block (`{pendingUrl && (...)}`)
- Remove `onScan` and `onDismissBanner` from the destructured props

### Sidebar.tsx
- Remove `pendingUrl` state (`useState<string | null>(null)`)
- Remove `page_url_changed` handler from the `chrome.runtime.onMessage` listener
- Remove `handleBannerScan` function
- Remove `pendingUrl`, `onScan` (from banner), and `onDismissBanner` props from `<CartState />`

> **Note:** `onScan` prop is still needed in `CartState` for the Crop/Scan buttons (see Change 2). Only remove `onScan` from the banner JSX. Keep `onScan` and `onCrop` as props — they are used in Change 2.
> **Correction:** `onScan` stays as a prop. Only `onDismissBanner` and `pendingUrl` are removed.

---

## Change 2 — Move Crop/Scan buttons above cart list, add icons

### CartState.tsx
- Remove the `[Crop selection] [Scan page]` row from the footer (currently the first `div` inside the footer)
- Add a new `div` **above** the scrollable cart list (and below any banner — but banner is gone), containing the two buttons on the same line with icons:

```tsx
<div className="flex gap-2 px-3 py-2 border-b border-[#E6E6E6] shrink-0">
  <button
    onClick={onCrop}
    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 3 6 6 3 6"/><polyline points="18 3 18 6 21 6"/>
      <polyline points="6 21 6 18 3 18"/><polyline points="18 21 18 18 21 18"/>
      <rect x="6" y="6" width="12" height="12" rx="1"/>
    </svg>
    {t.crop}
  </button>
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

---

## Change 3 — Clear unsent + Finish search on same line with icons

### CartState.tsx
- Replace the current two-button footer (Clear unsent on its own row + Finish search on its own row) with a single `flex gap-2` row:

```tsx
<div className="flex gap-2">
  <button
    onClick={handleClearUnsent}
    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E6E6E6] text-[#525252] text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
    {t.clearUnsent}
  </button>
  <button
    onClick={onFinish}
    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    {t.finishSearch}
  </button>
</div>
```

The footer `div` now contains only this one row (no more stacked buttons).

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/states/CartState.tsx` | Remove banner JSX + props; move crop/scan buttons up with icons; footer becomes one row with icons |
| `src/pages/sidepanel/Sidebar.tsx` | Remove `pendingUrl` state, `page_url_changed` handler, `handleBannerScan`, and `onDismissBanner`/`pendingUrl` props from `<CartState />` |

## No Changes Required
- `src/lib/i18n.ts` — existing `t.crop`, `t.scan`, `t.clearUnsent`, `t.finishSearch` keys are reused
- `src/components/panels/VehiclePanel.tsx` / `OrderPanel.tsx` — unchanged
- No new types, no new storage keys
