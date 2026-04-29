# PartsIQ UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 UX issues: FinishState opens same tab, cart clears pending on rescan, background color matches app.

**Architecture:** 4 independent tasks touching `FinishState`, `cart-utils`, `Sidebar`, `FallbackState`, and bg colors. Tasks 1 and 2 change tests first (TDD), tasks 3 and 4 are implementation-only. No new files. No new dependencies.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, TailwindCSS 4, Chrome Extension MV3

---

## File Map

| File | Change |
|------|--------|
| `src/components/states/FinishState.tsx` | `<a>` → `<button>` calling `chrome.tabs.update` |
| `src/components/states/FinishState.test.tsx` | Replace link-based assertions with button + chrome mock |
| `src/lib/cart-utils.ts` | Remove `currentUrl` param from `mergeCart`; body becomes `[...existing, ...incoming]` |
| `src/lib/cart-utils.test.ts` | Replace URL-filtering tests with concatenation tests |
| `src/pages/sidepanel/Sidebar.tsx` | `processScan`: filter pending/error before merge; pass `cart` to `FallbackState` |
| `src/components/states/FallbackState.tsx` | Add `cart: CartItem[]` prop; render sent items |
| `src/components/states/FallbackState.test.tsx` | New test file for FallbackState with cart prop |

Run tests with: `npx vitest run` (from `C:\Users\Fillipe\partsiq-extension`)

---

## Task 1: FinishState — navigate same tab

**Files:**
- Modify: `src/components/states/FinishState.test.tsx`
- Modify: `src/components/states/FinishState.tsx`

### Step 1: Update the tests for the new button-based behavior

Replace the entire `src/components/states/FinishState.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FinishState from './FinishState';
import type { Order } from '@types/parts';
import { CONFIG } from '@lib/constants';

const BASE = CONFIG.BUBBLE_BASE_URL;

const ORDER: Order = { id: 'order-abc-123', plate: 'XX-000-X' };

beforeEach(() => {
  vi.stubGlobal('chrome', {
    tabs: { update: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── URL / chrome.tabs.update logic ────────────────────────────────────────────

describe('FinishState check-status button', () => {
  describe('workMode="order" with an order that has an id', () => {
    it('calls chrome.tabs.update with sourced-parts URL', () => {
      render(
        <FinishState lang="en" workMode="order" order={ORDER} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({
        url: `${BASE}/dash/autoflex//sourced-parts?work-order-id=${ORDER.id}`,
      });
    });

    it('encodes the correct order id', () => {
      const differentOrder: Order = { id: 'woid-xyz-999', plate: 'AB-123-C' };
      render(
        <FinishState lang="en" workMode="order" order={differentOrder} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({
        url: `${BASE}/dash/autoflex//sourced-parts?work-order-id=woid-xyz-999`,
      });
    });
  });

  describe('workMode="order" with no order (null)', () => {
    it('calls chrome.tabs.update with the autoflex dashboard URL', () => {
      render(
        <FinishState lang="en" workMode="order" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({
        url: `${BASE}/dash/autoflex`,
      });
    });

    it('does not include work-order-id in the URL', () => {
      render(
        <FinishState lang="en" workMode="order" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      const calledUrl = (chrome.tabs.update as ReturnType<typeof vi.fn>).mock.calls[0][0].url as string;
      expect(calledUrl).not.toContain('work-order-id');
    });
  });

  describe('workMode="vehicle"', () => {
    it('calls chrome.tabs.update with the parts dashboard URL', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={ORDER} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({ url: `${BASE}/dash/parts` });
    });

    it('points to parts dashboard when order is null', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({ url: `${BASE}/dash/parts` });
    });

    it('does not include autoflex in the URL', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      const calledUrl = (chrome.tabs.update as ReturnType<typeof vi.fn>).mock.calls[0][0].url as string;
      expect(calledUrl).not.toContain('autoflex');
    });
  });
});

// ── onNewQuote callback ───────────────────────────────────────────────────────

describe('FinishState onNewQuote button', () => {
  it('calls onNewQuote when the New quote button is clicked', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={onNewQuote} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New quote' }));
    expect(onNewQuote).toHaveBeenCalledOnce();
  });

  it('calls onNewQuote only once per click', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState lang="en" workMode="order" order={ORDER} onNewQuote={onNewQuote} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New quote' }));
    fireEvent.click(screen.getByRole('button', { name: 'New quote' }));
    expect(onNewQuote).toHaveBeenCalledTimes(2);
  });

  it('does not call onNewQuote before any interaction', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={onNewQuote} />,
    );
    expect(onNewQuote).not.toHaveBeenCalled();
  });
});

// ── Translated text ───────────────────────────────────────────────────────────

describe('FinishState translated text', () => {
  describe('lang="en"', () => {
    it('renders "Search finished." as the status message', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(screen.getByText('Search finished.')).toBeInTheDocument();
    });

    it('renders "Check part status in Parts iQ." as button text', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', { name: 'Check part status in Parts iQ.' }),
      ).toBeInTheDocument();
    });

    it('renders "New quote" as button text', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(screen.getByRole('button', { name: 'New quote' })).toBeInTheDocument();
    });
  });

  describe('lang="nl"', () => {
    it('renders "Zoekopdracht afgerond." as the status message', () => {
      render(
        <FinishState lang="nl" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(screen.getByText('Zoekopdracht afgerond.')).toBeInTheDocument();
    });

    it('renders Dutch check-status button text', () => {
      render(
        <FinishState lang="nl" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', {
          name: 'Controleer de status van de onderdelen in Parts iQ.',
        }),
      ).toBeInTheDocument();
    });

    it('renders "Nieuwe offerte" as button text', () => {
      render(
        <FinishState lang="nl" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', { name: 'Nieuwe offerte' }),
      ).toBeInTheDocument();
    });
  });
});

// ── Visual / structural sanity ────────────────────────────────────────────────

describe('FinishState structure', () => {
  it('renders the checkmark indicator', () => {
    render(
      <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
    );
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders exactly two buttons and no links', () => {
    const { container } = render(
      <FinishState lang="en" workMode="order" order={ORDER} onNewQuote={vi.fn()} />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(2);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run src/components/states/FinishState.test.tsx
```

Expected: multiple FAIL — `getByRole('button', { name: 'Check part status...' })` not found because it's still an `<a>`.

- [ ] **Step 3: Update FinishState.tsx**

Replace the `<a>` with a `<button>` that calls `chrome.tabs.update`:

```tsx
import type { Lang, WorkMode, Order } from '@types/parts';
import { useT } from '@lib/i18n';
import { CONFIG } from '@lib/constants';

interface Props {
  lang: Lang;
  workMode: WorkMode;
  order: Order | null;
  onNewQuote: () => void;
}

export default function FinishState({ lang, workMode, order, onNewQuote }: Props) {
  const t = useT(lang);
  const dashUrl = workMode === 'order' && order
    ? `${CONFIG.BUBBLE_BASE_URL}/dash/autoflex//sourced-parts?work-order-id=${order.id}`
    : workMode === 'order'
      ? `${CONFIG.BUBBLE_BASE_URL}/dash/autoflex`
      : `${CONFIG.BUBBLE_BASE_URL}/dash/parts`;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
      <div className="text-3xl text-[#00C6B2]">✓</div>
      <p className="text-sm font-medium text-[#525252]">{t.searchFinished}</p>
      <button
        onClick={() => chrome.tabs.update({ url: dashUrl })}
        className="px-4 py-2 border border-[#00C6B2] text-[#00C6B2] text-xs font-medium rounded-full hover:bg-[#F0FDFB] transition-colors"
      >
        {t.checkStatus}
      </button>
      <button
        onClick={onNewQuote}
        className="px-6 py-2 bg-[#00C6B2] text-[#473150] text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
      >
        {t.newQuote}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run src/components/states/FinishState.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension
git add src/components/states/FinishState.tsx src/components/states/FinishState.test.tsx
git commit -m "feat: open check-status in same tab via chrome.tabs.update"
```

---

## Task 2: Simplify mergeCart

**Files:**
- Modify: `src/lib/cart-utils.test.ts`
- Modify: `src/lib/cart-utils.ts`

### Step 1: Replace the `mergeCart` test suite

In `src/lib/cart-utils.test.ts`, replace the entire `describe('mergeCart', ...)` block (lines 39–150) with:

```typescript
describe('mergeCart', () => {
  it('concatenates existing and incoming, existing first', () => {
    const existing = [makeCartItem({ id: 'a' }), makeCartItem({ id: 'b' })];
    const incoming = [makeCartItem({ id: 'c' })];

    const result = mergeCart(existing, incoming);

    expect(result.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns incoming when existing is empty', () => {
    const incoming = [makeCartItem({ id: '1' })];

    const result = mergeCart([], incoming);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns existing when incoming is empty', () => {
    const existing = [makeCartItem({ id: '1' })];

    const result = mergeCart(existing, []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when both are empty', () => {
    expect(mergeCart([], [])).toEqual([]);
  });

  it('does not mutate existing or incoming', () => {
    const existing = [makeCartItem({ id: 'a' })];
    const incoming = [makeCartItem({ id: 'b' })];

    mergeCart(existing, incoming);

    expect(existing).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run src/lib/cart-utils.test.ts
```

Expected: FAIL — TypeScript will complain that `mergeCart(existing, incoming)` is missing the third argument.

- [ ] **Step 3: Update cart-utils.ts**

Replace the `mergeCart` function in `src/lib/cart-utils.ts`:

```typescript
/**
 * Merges an incoming set of cart items into the existing cart.
 * Pending/error cleanup is done by the caller before invoking this function.
 * This function simply concatenates existing (sent/sending items) with incoming.
 */
export const mergeCart = (
  existing: CartItem[],
  incoming: CartItem[],
): CartItem[] => [...existing, ...incoming];
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run src/lib/cart-utils.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension
git add src/lib/cart-utils.ts src/lib/cart-utils.test.ts
git commit -m "refactor: simplify mergeCart — remove URL filtering (caller cleans pending)"
```

---

## Task 3: processScan cleanup + FallbackState shows sent items

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx`
- Modify: `src/components/states/FallbackState.tsx`
- Create: `src/components/states/FallbackState.test.tsx`

### Step 1: Write failing tests for FallbackState with cart prop

Create `src/components/states/FallbackState.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FallbackState from './FallbackState';
import type { CartItem } from '@types/parts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeSentItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'sent-1',
    name: 'Oil Filter',
    oem: 'PH3614',
    price: 12.5,
    deliveryDays: 2,
    stock: 10,
    supplier: 'SupplierX',
    sourceUrl: 'https://example.com',
    scannedAt: '2026-04-27T00:00:00.000Z',
    status: 'sent',
    checked: true,
    ...overrides,
  };
}

const defaultProps = {
  lang: 'en' as const,
  cart: [],
  onAddManual: vi.fn(),
  onCrop: vi.fn(),
  onScan: vi.fn(),
};

describe('FallbackState — empty cart', () => {
  it('shows the "no parts found" message', () => {
    render(<FallbackState {...defaultProps} cart={[]} />);
    expect(screen.getByText(/no parts found/i)).toBeInTheDocument();
  });

  it('shows crop and scan buttons', () => {
    render(<FallbackState {...defaultProps} cart={[]} />);
    expect(screen.getByRole('button', { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
  });
});

describe('FallbackState — cart with sent items', () => {
  it('renders the sent item name', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[makeSentItem({ name: 'Spark Plug' })]}
      />,
    );
    expect(screen.getByText('Spark Plug')).toBeInTheDocument();
  });

  it('renders all sent items when multiple exist', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[
          makeSentItem({ id: '1', name: 'Oil Filter' }),
          makeSentItem({ id: '2', name: 'Air Filter' }),
        ]}
      />,
    );
    expect(screen.getByText('Oil Filter')).toBeInTheDocument();
    expect(screen.getByText('Air Filter')).toBeInTheDocument();
  });

  it('does not render pending items', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[
          makeSentItem({ id: '1', name: 'Sent Part', status: 'sent' }),
          makeSentItem({ id: '2', name: 'Pending Part', status: 'pending' }),
        ]}
      />,
    );
    expect(screen.getByText('Sent Part')).toBeInTheDocument();
    expect(screen.queryByText('Pending Part')).not.toBeInTheDocument();
  });

  it('still shows crop and scan buttons when sent items exist', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[makeSentItem()]}
      />,
    );
    expect(screen.getByRole('button', { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run src/components/states/FallbackState.test.tsx
```

Expected: FAIL — `FallbackState` doesn't accept `cart` prop yet.

- [ ] **Step 3: Update FallbackState.tsx — add cart prop and sent items rendering**

Replace `src/components/states/FallbackState.tsx` with:

```tsx
import { useState } from 'react';
import type { Lang, CartItem } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  cart: CartItem[];
  onAddManual: (item: CartItem) => void;
  onCrop: () => void;
  onScan: () => void;
}

export default function FallbackState({ lang, cart, onAddManual, onCrop, onScan }: Props) {
  const t = useT(lang);
  const [showManualForm, setShowManualForm] = useState(false);

  const sentItems = cart.filter(i => i.status === 'sent');

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
    setShowManualForm(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F0F0]">
      {/* Scan / Crop buttons */}
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

      {/* No parts found message */}
      <div className="px-3 py-2.5 border-b border-[#E6E6E6]">
        <p className="text-xs text-[#525252] opacity-60">{t.noPartsFound}</p>
      </div>

      {/* Previously sent items */}
      {sentItems.length > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-hidden">
          {sentItems.map(item => (
            <div key={item.id} className="border-b border-[#E6E6E6] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="mt-0.5 accent-[#00C6B2]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-[#525252] truncate flex-1">{item.name}</span>
                    <span className="text-xs text-[#00C6B2] font-medium shrink-0">{t.sent}</span>
                  </div>
                  {item.oem && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-[#525252] opacity-60">{t.partNumber}:</span>
                      <span className="text-xs text-[#525252] truncate">{item.oem}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual add */}
      <div className="px-3 py-2 border-b border-[#E6E6E6]">
        {showManualForm ? (
          <form onSubmit={handleAdd} className="flex flex-col gap-1.5">
            <input
              name="name"
              placeholder={t.partName}
              className="border border-[#E6E6E6] rounded-full px-3 py-1.5 text-xs w-full text-[#525252] outline-none focus:border-[#00C6B2] transition-colors"
              required
            />
            <input
              name="oem"
              placeholder={t.partNumberLabel}
              className="border border-[#E6E6E6] rounded-full px-3 py-1.5 text-xs w-full text-[#525252] outline-none focus:border-[#00C6B2] transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="flex-1 px-3 py-1.5 bg-white border border-[#E6E6E6] text-[#525252] text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
              >
                {t.addPart}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowManualForm(true)}
            className="text-xs text-[#00C6B2] font-medium hover:underline"
          >
            {t.addManually}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update Sidebar.tsx — processScan cleanup + pass cart to FallbackState**

In `src/pages/sidepanel/Sidebar.tsx`, make two changes:

**Change A** — `processScan` function (replace the entire function):

```typescript
const processScan = async (base64: string, isCrop = false): Promise<void> => {
  setScanError(null);
  try {
    const parts = await extractPartsFromScreenshot(base64);
    // Always clear pending/error before updating cart — keeps list clean across scans
    const kept = cartRef.current.filter(i => i.status === 'sent' || i.status === 'sending');
    if (parts.length === 0) {
      setCartState(kept);
      await setCart(kept);
      setState('fallback');
      return;
    }
    const url = await getCurrentUrl();
    const autoSend = isCrop && parts.length <= 2;
    const newItems = aiPartsToCartItems(parts, url, autoSend);
    const merged = mergeCart(kept, newItems);
    setCartState(merged);
    await setCart(merged);
    setState('cart');
  } catch (err) {
    setScanError(String(err));
    setState('scanning');
  }
};
```

**Change B** — `FallbackState` render (around line 413): add `cart={cart}` prop:

```tsx
{state === 'fallback' && (
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
)}
```

- [ ] **Step 5: Run FallbackState tests — expect all pass**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run src/components/states/FallbackState.test.tsx
```

Expected: all PASS.

- [ ] **Step 6: Run full test suite to check nothing is broken**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run
```

Expected: all PASS. (TypeScript error if `mergeCart` call in `Sidebar.tsx` still passes 3 args — fix by removing the third `url` argument.)

- [ ] **Step 7: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension
git add src/pages/sidepanel/Sidebar.tsx src/components/states/FallbackState.tsx src/components/states/FallbackState.test.tsx
git commit -m "feat: clear pending on rescan, show sent items in fallback state"
```

---

## Task 4: Background color — match app sidebar

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx`
- Modify: `src/components/states/CartState.tsx`
- Modify: `src/components/states/ScanningState.tsx`

No new tests needed — purely visual.

- [ ] **Step 1: Update Sidebar.tsx root containers**

In `src/pages/sidepanel/Sidebar.tsx`, there are three root `<div>` returns. Update each:

**Return 1** — `checking`/`login` state (around line 327):
```tsx
<div className="relative h-full bg-[#F0F0F0]">
```

**Return 2** — `finish` state: `FinishState` component itself defines its own background, no wrapper div in Sidebar — skip.

**Return 3** — `idle` with `vehicleExpanded` (around line 372):
```tsx
<div className={`relative flex flex-col h-screen bg-[#F0F0F0]${!autoflex ? ' pt-5' : ''}`}>
```

**Return 4** — main cart/fallback/scanning wrapper (around line 388):
```tsx
<div className="flex flex-col h-screen bg-[#F0F0F0]">
```

- [ ] **Step 2: Update CartState.tsx root container**

In `src/components/states/CartState.tsx` line 210:
```tsx
<div className="relative flex flex-col h-full bg-[#F0F0F0]">
```

- [ ] **Step 3: Update ScanningState.tsx root containers**

In `src/components/states/ScanningState.tsx`, the error branch (line 16) and normal branch (line 30):

```tsx
// Error branch:
<div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center bg-[#F0F0F0]">

// Normal branch:
<div className="flex flex-col items-center justify-center h-full gap-4 px-4 bg-[#F0F0F0]">
```

Note: `FallbackState.tsx` already has `bg-[#F0F0F0]` added in Task 3.

- [ ] **Step 4: Run full test suite**

```bash
cd C:\Users\Fillipe\partsiq-extension && npx vitest run
```

Expected: all PASS (no test changes needed for color).

- [ ] **Step 5: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension
git add src/pages/sidepanel/Sidebar.tsx src/components/states/CartState.tsx src/components/states/ScanningState.tsx
git commit -m "style: set background to #F0F0F0 to match app sidebar"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: FinishState `<a>` → `<button>` + `chrome.tabs.update`
- ✅ Task 2: `mergeCart` simplified (URL filtering removed)
- ✅ Task 3: `processScan` clears pending before merge; `FallbackState` shows sent items
- ✅ Task 4: Background `#F0F0F0` applied to all relevant containers

**Placeholder scan:** No TBDs or TODOs found.

**Type consistency:**
- `mergeCart` signature changes from `(existing, incoming, currentUrl)` to `(existing, incoming)` — updated in both `cart-utils.ts` and `Sidebar.tsx` call site in Task 3 Step 4
- `FallbackState` Props interface adds `cart: CartItem[]` — updated in both component and Sidebar render in Task 3 Steps 3 & 4
- `chrome.tabs.update({ url })` — matches Chrome MV3 API (no tabId = updates active tab)
