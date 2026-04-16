# Cart UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Page changed" banner, move Crop/Scan buttons above the cart list with icons, and put Clear unsent + Finish search on the same line with icons.

**Architecture:** All changes are contained in two files — `CartState.tsx` (UI restructure) and `Sidebar.tsx` (remove banner-related state/props). No new components, types, or i18n keys needed; existing `t.crop`, `t.scan`, `t.clearUnsent`, `t.finishSearch` are reused.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, Vitest + jsdom, @testing-library/react

---

## File Map

| File | What changes |
|------|-------------|
| `src/components/states/CartState.tsx` | Remove `pendingUrl`/`onDismissBanner` props + banner JSX; add crop/scan row with icons above list; footer becomes one `flex` row with icons |
| `src/pages/sidepanel/Sidebar.tsx` | Remove `pendingUrl` state, `page_url_changed` handler, `handleBannerScan`; remove `pendingUrl`/`onDismissBanner` from `<CartState />` call |

---

### Task 1: Remove banner from CartState — props, JSX, and Sidebar wiring

**Files:**
- Modify: `src/components/states/CartState.tsx`
- Modify: `src/pages/sidepanel/Sidebar.tsx`

- [ ] **Step 1: Update the `Props` interface in `CartState.tsx`**

  Remove `pendingUrl` and `onDismissBanner`. Keep `onScan` and `onCrop` — they are still used by the buttons.

  Replace the current `Props` interface (lines 6–18):

  ```ts
  interface Props {
    lang: Lang;
    cart: CartItem[];
    vehicle: Vehicle | null;
    order: Order | null;
    workMode: WorkMode;
    onScan: () => void;
    onCrop: () => void;
    onUpdateCart: (items: CartItem[]) => Promise<void>;
    onFinish: () => void;
  }
  ```

- [ ] **Step 2: Update the destructured props in `CartState`**

  Replace the current function signature (line 20–23):

  ```ts
  export default function CartState({
    lang, cart, vehicle, order, workMode,
    onScan, onCrop, onUpdateCart, onFinish,
  }: Props) {
  ```

- [ ] **Step 3: Remove the banner JSX block from `CartState.tsx`**

  Delete the entire block (currently lines 213–226):

  ```tsx
  {/* URL change banner */}
  {pendingUrl && (
    <div className="flex items-center justify-between px-3 py-2 bg-[#F0FDFB] border-b border-[#B3EEE6] text-xs">
      <span className="text-[#473150] font-medium">{t.pageChanged}</span>
      <div className="flex gap-2 ml-2">
        <button onClick={onScan} className="px-3 py-1 bg-[#00C6B2] text-[#473150] font-semibold rounded-full hover:opacity-90 transition-opacity">
          {t.scan}
        </button>
        <button onClick={onDismissBanner} className="px-2 py-1 border border-[#E6E6E6] text-[#525252] rounded-full hover:bg-gray-50 transition-colors">
          ✕
        </button>
      </div>
    </div>
  )}
  ```

- [ ] **Step 4: Update `Sidebar.tsx` — remove `pendingUrl` state**

  Find and delete this line (around line 37):
  ```ts
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  ```

- [ ] **Step 5: Update `Sidebar.tsx` — remove `page_url_changed` handler**

  In the `chrome.runtime.onMessage` handler (around lines 108–115), delete:

  ```ts
  if (msg.type === 'page_url_changed' && msg.url) {
    const s = stateRef.current;
    if (s === 'cart' || s === 'idle') {
      setPendingUrl(msg.url);
    }
  }
  ```

- [ ] **Step 6: Update `Sidebar.tsx` — remove `handleBannerScan`**

  Delete (around lines 325–328):
  ```ts
  const handleBannerScan = async () => {
    setPendingUrl(null);
    await handleScan();
  };
  ```

- [ ] **Step 7: Update `Sidebar.tsx` — remove `setPendingUrl(null)` calls and fix `handleFinish`**

  In `handleFinish` (around line 302), remove:
  ```ts
  setPendingUrl(null);
  ```

  In `handleNewQuote` there is no `setPendingUrl` call, so nothing to change there.

- [ ] **Step 8: Update `Sidebar.tsx` — fix the `<CartState />` call**

  Find the `<CartState ... />` JSX (around lines 403–416). Remove `pendingUrl`, `onScan={handleBannerScan}`, and `onDismissBanner` props. The updated call:

  ```tsx
  <CartState
    lang={lang}
    cart={cart}
    vehicle={vehicle}
    order={order}
    workMode={workMode}
    onScan={handleScan}
    onCrop={handleCrop}
    onUpdateCart={handleUpdateCart}
    onFinish={handleFinish}
  />
  ```

- [ ] **Step 9: Build to verify no TypeScript errors**

  ```bash
  cd ~/partsiq-extension && npm run build 2>&1
  ```

  Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 10: Commit**

  ```bash
  git add src/components/states/CartState.tsx src/pages/sidepanel/Sidebar.tsx
  git commit -m "feat: remove page-changed banner from cart state"
  ```

---

### Task 2: Add Crop/Scan buttons above cart list with icons

**Files:**
- Modify: `src/components/states/CartState.tsx`

- [ ] **Step 1: Remove the old Crop/Scan row from the footer**

  In the footer section of `CartState.tsx` (the `<div className="border-t border-[#E6E6E6] px-3 py-2.5 flex flex-col gap-2 shrink-0">` block), delete the first child div — the Crop/Scan row:

  ```tsx
  <div className="flex gap-2">
    <button
      onClick={onCrop}
      className="flex-1 px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
    >
      {t.crop}
    </button>
    <button
      onClick={onScan}
      className="flex-1 px-3 py-2 bg-white border border-[#E6E6E6] text-black text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
    >
      {t.scan}
    </button>
  </div>
  ```

- [ ] **Step 2: Add new Crop/Scan row with icons above the scrollable cart list**

  The `CartState` render starts with `<div className="relative flex flex-col h-full">`. Insert this block **immediately before** `{/* Cart items */}` (the `<div className="flex-1 overflow-y-auto scrollbar-hidden">`):

  ```tsx
  {/* Scan actions */}
  <div className="flex gap-2 px-3 py-2 border-b border-[#E6E6E6] shrink-0">
    <button
      onClick={onCrop}
      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 3 6 6 3 6"/>
        <polyline points="18 3 18 6 21 6"/>
        <polyline points="6 21 6 18 3 18"/>
        <polyline points="18 21 18 18 21 18"/>
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

- [ ] **Step 3: Build to verify no TypeScript errors**

  ```bash
  cd ~/partsiq-extension && npm run build 2>&1
  ```

  Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/states/CartState.tsx
  git commit -m "feat: move crop/scan buttons above cart list with icons"
  ```

---

### Task 3: Put Clear unsent + Finish search on the same line with icons

**Files:**
- Modify: `src/components/states/CartState.tsx`

- [ ] **Step 1: Replace the footer button rows**

  Find the footer `div` (currently `<div className="border-t border-[#E6E6E6] px-3 py-2.5 flex flex-col gap-2 shrink-0">`). After Task 2, it now contains only the `Clear unsent` and `Finish search` buttons as separate rows. Replace the entire footer content with a single `flex gap-2` row:

  ```tsx
  {/* Footer */}
  <div className="border-t border-[#E6E6E6] px-3 py-2.5 shrink-0">
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
  </div>
  ```

- [ ] **Step 2: Build to verify no TypeScript errors**

  ```bash
  cd ~/partsiq-extension && npm run build 2>&1
  ```

  Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/states/CartState.tsx
  git commit -m "feat: clear unsent and finish search on same line with icons"
  ```

---

### Task 4: Final build and manual verification

**Files:** No file changes.

- [ ] **Step 1: Run final build**

  ```bash
  cd ~/partsiq-extension && npm run build 2>&1
  ```

  Expected: `✓ built in X.XXs`

- [ ] **Step 2: Reload extension in Chrome**

  Go to `chrome://extensions`, click the reload icon on "Parts iQ".

- [ ] **Step 3: Verify layout**

  With a vehicle selected and items in the cart:
  - The "Page changed — scan now?" banner should **never** appear
  - Below the vehicle/order header: `[✂ Crop selection]` and `[⊡ Scan page]` on the same line
  - Footer: `[🗑 Clear unsent]` and `[✓ Finish search]` on the same line
