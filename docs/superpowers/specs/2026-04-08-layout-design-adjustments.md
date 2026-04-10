# Layout & Design Adjustments — PartsIQ Extension

**Date:** 2026-04-08
**Scope:** CartFooter buttons, CartPartCard OEM pencil icon, CartPartCard checkbox disabled state

---

## Design Tokens (from Bubble web app)

| Token | Hex | Usage |
|---|---|---|
| Primary 60 | `#00C6B2` | Button primary background |
| Secondary 80 | `#473150` | Button primary text |
| Gray 80 | `#000000` | Button outline text |
| Gray 70 | `#525252` | Body text, icons default |
| Gray 10 | `#FFFFFF` | Button outline background |
| Font | Inter | All text |

---

## Change 1 — CartFooter Buttons

**What:** Align buttons to the right, increase size, apply Bubble design tokens exactly.

**Button Primary (e.g. "Finalizar Busca"):**
- Background: `#00C6B2`
- Text color: `#473150`
- Font: Inter, 14px, weight 600
- Border radius: `9999px` (pill)
- Min height: `45px`
- Padding: `10px 16px`
- Fit width to content

**Button Outline (e.g. "Re-scan"):**
- Background: `#FFFFFF`
- Text color: `#000000`
- Font: Inter, 14px, weight 400
- Border: `1px solid` (color: `#000000`)
- Border radius: `100px` (rounded)
- Min height: `45px`
- Padding: `10px 16px`
- Fit width to content

**Layout:** Buttons grouped and aligned to the **right** of the footer row (`justify-end`).

---

## Change 2 — CartPartCard OEM Pencil Icon

**What:** Make the edit icon next to the OEM number more visible.

**Current state:** Icon exists but is too small and low-contrast.

**Updated spec:**
- Icon size: `16px`
- Color: `#525252` (Gray 70) at rest
- Color on hover: `#000000` (Gray 80)
- Icon: pencil/edit (existing icon, just resized and recolored)
- Cursor: `pointer` on hover

---

## Change 3 — CartPartCard Checkbox Disabled When No OEM

**What:** If a part has no OEM number, its checkbox must be non-interactive.

**Behavior:**
- Checkbox appears visually disabled: reduced opacity (`opacity-40`), `cursor-not-allowed`
- Clicking the checkbox does nothing (event prevented)
- On hover over the checkbox (or the disabled part row), show a tooltip: `"Add an OEM number to select this part"`
- Tooltip triggers on hover only

**No OEM definition:** `part.oem` is `null`, `undefined`, or empty string `""`.

---

## Files to Modify

1. `src/components/cart/CartFooter.tsx` — button styles + alignment
2. `src/components/cart/CartPartCard.tsx` — OEM pencil icon + checkbox disabled state
