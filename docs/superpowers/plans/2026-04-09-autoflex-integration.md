# Autoflex Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user has Autoflex connected, the extension works with orders instead of vehicles — the Bubble iframe handles the UI; the extension only needs to track the work mode and send the right identifier to `save_part`/`remove_part`.

**Architecture:** `autoflex_connected` flag arrives on `partsiq:login_success`. It sets `workMode` ('vehicle' | 'order') for the session. `VehiclePanel` listens for both `partsiq:vehicle_selected` and `partsiq:order_selected` and calls the same callback. `bubble-api` sends `order_id` or `vehicle_id` based on `workMode`, the other field is `""`.

**Tech Stack:** React 19, TypeScript, Chrome Extension Manifest V3, Bubble postMessage API

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/types/parts.ts` | Modify | Add `Order`, `WorkMode`, `partsiq:order_selected` message type |
| `src/lib/constants.ts` | Modify | Add `ORDER` and `WORK_MODE` to `STORAGE_KEYS` |
| `src/lib/storage.ts` | Modify | Add order and workMode storage functions |
| `src/lib/translations.ts` | Modify | Add `changeOrder` and `selectOrder` keys |
| `src/lib/bubble-api.ts` | Modify | Accept `WorkContext` (vehicle or order) in `sendPartToBubble` |
| `src/components/states/LoginState.tsx` | Modify | Extract `autoflex_connected` from `partsiq:login_success` |
| `src/components/VehiclePanel.tsx` | Modify | Handle order_selected, show correct label per workMode |
| `src/pages/sidepanel/Sidebar.tsx` | Modify | Add workMode + order state, wire all logic |

---

### Task 1: Extend types

**Files:**
- Modify: `src/types/parts.ts`

- [ ] **Step 1: Add `Order`, `WorkMode`, and `partsiq:order_selected` to types**

Replace the entire file content:

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

export type SidebarState =
  | 'login'
  | 'scanning'
  | 'cropping'
  | 'cart'
  | 'done'; // shown after "Finalizar Busca"

export type CartItemStatus = 'pending' | 'sending' | 'sent' | 'error';

export interface CartItem {
  id: string;
  part: PartData;
  supplierName: string;
  sourceUrl: string;
  checked: boolean;
  status: CartItemStatus;
  bubblePartId?: string;
  errorMessage?: string;
  scannedAt: string;
}

export type StatusChipVariant =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'added'
  | 'error';

export interface Vehicle {
  plate: string;
  id?: string; // Bubble record ID, optional
}

export interface Order {
  plate: string;
  id: string; // Bubble order unique_id — required
}

export type WorkMode = 'vehicle' | 'order';

// PostMessage types
export interface BubbleMessage {
  type:
    | 'partsiq:ready'
    | 'partsiq:login_success'
    | 'partsiq:login_failed'
    | 'partsiq:login_required'
    | 'partsiq:vehicle_selected'
    | 'partsiq:order_selected'
    | 'partsiq:error';
  [key: string]: unknown;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1 | head -30
```

Expected: build succeeds (or only errors from files not yet updated — those will be fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add src/types/parts.ts && git commit -m "feat: add Order, WorkMode types and partsiq:order_selected message"
```

---

### Task 2: Extend constants and storage

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add ORDER and WORK_MODE storage keys to constants**

In `src/lib/constants.ts`, replace the `STORAGE_KEYS` block:

```typescript
  STORAGE_KEYS: {
    AUTH_STATUS: 'partsiq_auth_status',
    CART: 'partsiq_cart',
    VEHICLE: 'partsiq_vehicle',
    ORDER: 'partsiq_order',
    WORK_MODE: 'partsiq_work_mode',
  },
```

- [ ] **Step 2: Add order and workMode storage functions to storage.ts**

In `src/lib/storage.ts`, add the following at the end of the file (after `clearVehicle`):

```typescript
import type { CartItem, Vehicle, Order, WorkMode } from '@types/parts';

export async function getOrder(): Promise<Order | null> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.ORDER);
  return result[CONFIG.STORAGE_KEYS.ORDER] ?? null;
}

export async function setOrder(order: Order): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.ORDER]: order });
}

export async function clearOrder(): Promise<void> {
  await chrome.storage.local.remove(CONFIG.STORAGE_KEYS.ORDER);
}

export async function getWorkMode(): Promise<WorkMode> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.WORK_MODE);
  return (result[CONFIG.STORAGE_KEYS.WORK_MODE] as WorkMode) ?? 'vehicle';
}

export async function setWorkMode(mode: WorkMode): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.WORK_MODE]: mode });
}
```

Note: `storage.ts` already imports `CartItem` and `Vehicle` from `@types/parts` at line 1. Update that import line to:
```typescript
import type { CartItem, Vehicle, Order, WorkMode } from '@types/parts';
```

- [ ] **Step 3: Build to verify**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add src/lib/constants.ts src/lib/storage.ts && git commit -m "feat: add order and workMode storage keys and functions"
```

---

### Task 3: Add translations

**Files:**
- Modify: `src/lib/translations.ts`

- [ ] **Step 1: Add changeOrder and selectOrder to both languages**

In `src/lib/translations.ts`, add to the `en` block (after `changeCar: 'Change car',`):

```typescript
    changeOrder:     'Change order',
    selectOrder:     'Select an order to start.',
```

Add to the `nl` block (after `changeCar: 'Auto wijzigen',`):

```typescript
    changeOrder:     'Order wijzigen',
    selectOrder:     'Selecteer een order om te beginnen.',
```

- [ ] **Step 2: Build to verify**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add src/lib/translations.ts && git commit -m "feat: add changeOrder and selectOrder translation keys"
```

---

### Task 4: Update Bubble API

**Files:**
- Modify: `src/lib/bubble-api.ts`

- [ ] **Step 1: Update sendPartToBubble to accept WorkContext**

Replace the entire file:

```typescript
import type { PartData, Vehicle, Order, WorkMode } from '@types/parts';
import { CONFIG } from '@lib/constants';

export interface WorkContext {
  mode: WorkMode;
  vehicle: Vehicle | null;
  order: Order | null;
}

/**
 * Sends a single part to Bubble via Workflow API.
 * Returns the Bubble-assigned part ID on success.
 * Sends vehicle_id when mode is 'vehicle', order_id when mode is 'order'.
 * The unused field is sent as empty string.
 */
export async function sendPartToBubble(
  part: PartData,
  supplierName: string,
  ctx: WorkContext,
  sourceUrl: string
): Promise<{ partId: string }> {
  const plate = ctx.mode === 'order' ? ctx.order?.plate ?? '' : ctx.vehicle?.plate ?? '';

  const response = await fetch(`${CONFIG.BUBBLE_API_URL}/save_part`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      part_name: part.partName,
      oem_number: part.oemNumber ?? '',
      net_price: part.netPrice,
      gross_price: part.grossPrice,
      delivery_time: part.deliveryTime,
      stock_available: part.stockAvailable,
      supplier: supplierName || part.supplier || '',
      vehicle_plate: plate,
      vehicle_id: ctx.mode === 'vehicle' ? (ctx.vehicle?.id ?? '') : '',
      order_id:   ctx.mode === 'order'   ? (ctx.order?.id ?? '')   : '',
      confidence: part.confidence,
      source_url: sourceUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(`Bubble API error: ${response.status}`);
  }

  const data = await response.json();
  return { partId: data.response?.part_id ?? data.id ?? 'unknown' };
}

/**
 * Removes a previously saved part from Bubble.
 */
export async function removePartFromBubble(bubblePartId: string): Promise<void> {
  const response = await fetch(`${CONFIG.BUBBLE_API_URL}/remove_part`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ part_id: bubblePartId }),
  });

  if (!response.ok) {
    throw new Error(`Bubble remove error: ${response.status}`);
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1 | head -40
```

Expected: TypeScript errors in `Sidebar.tsx` where `sendPartToBubble` is called with the old signature — those will be fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add src/lib/bubble-api.ts && git commit -m "feat: update sendPartToBubble to accept WorkContext with vehicle or order"
```

---

### Task 5: Update LoginState

**Files:**
- Modify: `src/components/states/LoginState.tsx`

- [ ] **Step 1: Extract autoflex_connected from partsiq:login_success and pass to onSuccess**

Update the `Props` interface and `handleMessage` function. Replace the entire file:

```typescript
import { useEffect, useState } from 'react';
import BubbleIframe from '@components/BubbleIframe';
import { buildBubbleUrl } from '@lib/iframe';
import { setAuthStatus } from '@lib/storage';
import type { BubbleMessage } from '@types/parts';
import { T, type Lang } from '@lib/translations';

interface Props {
  lang: Lang;
  onSuccess: (detectedLang?: Lang, autoflexConnected?: boolean) => void;
}

const LoginState = ({ lang, onSuccess }: Props) => {
  const [phase, setPhase] = useState<'checking' | 'form'>('checking');
  const [error, setError] = useState<string | null>(null);
  const t = T[lang];

  // Fallback: if Bubble doesn't respond in 5s, show login form
  useEffect(() => {
    const t = setTimeout(() => setPhase('form'), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleMessage = async (msg: BubbleMessage) => {
    if (msg.type === 'partsiq:login_success') {
      await setAuthStatus(true);
      const raw = msg.language;
      const detectedLang: Lang | undefined =
        raw === 'en' || raw === 'nl' ? raw : undefined;
      const autoflexConnected = msg.autoflex_connected === true;
      onSuccess(detectedLang, autoflexConnected);
    } else if (msg.type === 'partsiq:login_required') {
      setPhase('form');
    } else if (msg.type === 'partsiq:login_failed') {
      setPhase('form');
      setError('Login failed. Please try again.');
    }
  };

  const iframeUrl = buildBubbleUrl('login', { source: 'extension' });

  return (
    <div className="relative flex flex-col h-full flex-1">
      {phase === 'checking' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && phase === 'form' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs">
          {t.loginFailed}
        </div>
      )}
      <div className="flex-1 px-[10px] -mt-6 overflow-hidden">
        <BubbleIframe
          src={iframeUrl}
          onMessage={handleMessage}
          height="100%"
        />
      </div>
    </div>
  );
};

export default LoginState;
```

- [ ] **Step 2: Build to verify**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1 | head -40
```

Expected: TypeScript error in `Sidebar.tsx` because `onSuccess` callback signature changed — fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add src/components/states/LoginState.tsx && git commit -m "feat: pass autoflex_connected from login_success to onSuccess callback"
```

---

### Task 6: Update VehiclePanel

**Files:**
- Modify: `src/components/VehiclePanel.tsx`

- [ ] **Step 1: Handle order_selected and show correct label**

Replace the entire file:

```typescript
import { useState } from 'react';
import { buildBubbleUrl, useBubbleMessages } from '@lib/iframe';
import type { BubbleMessage, Vehicle, Order, WorkMode } from '@types/parts';
import { T, type Lang } from '@lib/translations';

interface Props {
  vehicle: Vehicle | null;
  order: Order | null;
  workMode: WorkMode;
  expanded: boolean;
  lang: Lang;
  onVehicleSelected: (vehicle: Vehicle) => void;
  onOrderSelected: (order: Order) => void;
  onExpand: () => void;
}

const VehiclePanel = ({
  vehicle,
  order,
  workMode,
  expanded,
  lang,
  onVehicleSelected,
  onOrderSelected,
  onExpand,
}: Props) => {
  const [iframeKey, setIframeKey] = useState(0);
  const t = T[lang];

  useBubbleMessages((msg: BubbleMessage) => {
    if (msg.type === 'partsiq:vehicle_selected') {
      const plate = msg.plate as string;
      if (plate) {
        onVehicleSelected({ plate, id: msg.id as string | undefined });
      }
    }
    if (msg.type === 'partsiq:order_selected') {
      const plate = msg.plate as string;
      const id = msg.id as string;
      if (plate && id) {
        onOrderSelected({ plate, id });
      }
    }
  });

  const handleExpand = () => {
    setIframeKey(k => k + 1); // force Bubble page reload on each re-open
    onExpand();
  };

  // Determine active plate and label for compact mode
  const activePlate = workMode === 'order' ? order?.plate : vehicle?.plate;
  const hasSelection = workMode === 'order' ? !!order : !!vehicle;
  const changeLabel = workMode === 'order' ? t.changeOrder : t.changeCar;

  // Compact: selection made and panel is collapsed
  if (hasSelection && !expanded) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M5 11h14M4 15h16M7 19h10M3 11l2-4h14l2 4" />
          </svg>
          <span className="text-sm font-medium text-blue-800 tracking-wide">{activePlate}</span>
        </div>
        <button
          onClick={handleExpand}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {changeLabel}
        </button>
      </div>
    );
  }

  // Expanded: iframe fills available area
  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {hasSelection && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {workMode === 'order' ? t.selectOrder : t.selectVehicle}
            </span>
          </div>
          <button
            onClick={() => {
              if (workMode === 'order' && order) onOrderSelected(order);
              else if (vehicle) onVehicleSelected(vehicle);
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {t.cancel}
          </button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <iframe
          key={iframeKey}
          src={buildBubbleUrl('vehicle', { source: 'extension' })}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          title="PartsIQ Vehicle / Order"
        />
      </div>
    </div>
  );
};

export default VehiclePanel;
```

- [ ] **Step 2: Build to verify**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1 | head -40
```

Expected: TypeScript errors in `Sidebar.tsx` for missing `order`, `workMode`, `onOrderSelected` props — fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add src/components/VehiclePanel.tsx && git commit -m "feat: VehiclePanel handles order_selected and shows changeOrder label"
```

---

### Task 7: Update Sidebar

**Files:**
- Modify: `src/pages/sidepanel/Sidebar.tsx`

- [ ] **Step 1: Add workMode + order state and imports**

Replace the import block at the top (lines 1-13) with:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import SidebarLayout from '@components/SidebarLayout';
import CartFooter from '@components/cart/CartFooter';
import CartPartCard from '@components/cart/CartPartCard';
import AddPartForm from '@components/cart/AddPartForm';
import LoginState from '@components/states/LoginState';
import ScanningState from '@components/states/ScanningState';
import VehiclePanel from '@components/VehiclePanel';
import {
  getCart, setCart, clearCart,
  getVehicle, setVehicle, clearVehicle,
  getOrder, setOrder, clearOrder,
  getWorkMode, setWorkMode,
  getLanguage, setLanguage,
} from '@lib/storage';
import { extractSupplierName } from '@lib/supplier';
import { sendPartToBubble, removePartFromBubble, type WorkContext } from '@lib/bubble-api';
import { T, type Lang } from '@lib/translations';
import type { CartItem, CartItemStatus, Order, PartData, SidebarState, Vehicle, WorkMode } from '@types/parts';
```

- [ ] **Step 2: Add order and workMode state variables**

After the existing state declarations (after line `const stateRef = useRef(state);`), add:

```typescript
  const [workMode, setWorkModeState] = useState<WorkMode>('vehicle');
  const [order, setOrderState] = useState<Order | null>(null);
```

- [ ] **Step 3: Load order and workMode from storage on boot**

In the boot `useEffect` (the one with `getCart`, `getVehicle`, `getLanguage`), add:

```typescript
    getOrder().then(setOrderState);
    getWorkMode().then(setWorkModeState);
```

So the effect becomes:

```typescript
  useEffect(() => {
    getCart().then(setCartState);
    getVehicle().then(v => {
      setVehicleState(v);
      if (v) setVehicleExpanded(false);
    });
    getOrder().then(o => {
      setOrderState(o);
      if (o) setVehicleExpanded(false);
    });
    getWorkMode().then(setWorkModeState);
    getLanguage().then(setLangState);
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
      setActiveTabUrl(tabs[0]?.url ?? '');
    });
  }, []);
```

- [ ] **Step 4: Update LoginState onSuccess handler**

The existing `onSuccess` handler in the render:

```typescript
        <LoginState lang={lang} onSuccess={(detectedLang) => {
          if (detectedLang) { setLangState(detectedLang); setLanguage(detectedLang); }
          setIsLoggedIn(true);
        }} />
```

Replace with:

```typescript
        <LoginState lang={lang} onSuccess={(detectedLang, autoflexConnected) => {
          if (detectedLang) { setLangState(detectedLang); setLanguage(detectedLang); }
          const mode: WorkMode = autoflexConnected ? 'order' : 'vehicle';
          setWorkModeState(mode);
          setWorkMode(mode);
          setIsLoggedIn(true);
        }} />
```

- [ ] **Step 5: Update triggerScan and triggerCrop guards**

Currently both check `if (!vehicle)`. Update to check the active selection based on workMode:

Replace `triggerScan`:
```typescript
  const triggerScan = useCallback(() => {
    if (stateRef.current === 'scanning') return;
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!hasSelection) {
      setVehicleExpanded(true);
      return;
    }
    setUrlChangeBanner(null);
    setState('scanning');
  }, [vehicle, order, workMode]);
```

Replace `triggerCrop`:
```typescript
  const triggerCrop = useCallback(async () => {
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!hasSelection) {
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
  }, [vehicle, order, workMode]);
```

- [ ] **Step 6: Update handleToggle to use WorkContext**

Replace the existing `handleToggle`:

```typescript
  const handleToggle = useCallback(async (id: string) => {
    const item = cart.find(i => i.id === id);
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!item || item.status === 'sending' || !hasSelection) return;

    const ctx: WorkContext = { mode: workMode, vehicle, order };

    if (!item.checked) {
      updateCartItem(id, { checked: true, status: 'sending', errorMessage: undefined });
      try {
        const { partId } = await sendPartToBubble(
          item.part,
          item.supplierName,
          ctx,
          item.sourceUrl
        );
        updateCartItem(id, { status: 'sent', bubblePartId: partId });
      } catch (err) {
        updateCartItem(id, { status: 'error', errorMessage: String(err) });
      }
    } else {
      if (item.bubblePartId) {
        updateCartItem(id, { status: 'sending' });
        try {
          await removePartFromBubble(item.bubblePartId);
          updateCartItem(id, { checked: false, status: 'pending', bubblePartId: undefined });
        } catch (err) {
          updateCartItem(id, { status: 'error', errorMessage: String(err) });
        }
      } else {
        updateCartItem(id, { checked: false, status: 'pending' });
      }
    }
  }, [cart, vehicle, order, workMode, updateCartItem]);
```

- [ ] **Step 7: Update handleRetry to use WorkContext**

Replace `handleRetry`:

```typescript
  const handleRetry = useCallback(async (id: string) => {
    const item = cart.find(i => i.id === id);
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!item || !hasSelection) return;
    const ctx: WorkContext = { mode: workMode, vehicle, order };
    updateCartItem(id, { status: 'sending', errorMessage: undefined });
    try {
      const { partId } = await sendPartToBubble(
        item.part,
        item.supplierName,
        ctx,
        item.sourceUrl
      );
      updateCartItem(id, { status: 'sent', checked: true, bubblePartId: partId });
    } catch (err) {
      updateCartItem(id, { status: 'error', errorMessage: String(err) });
    }
  }, [cart, vehicle, order, workMode, updateCartItem]);
```

- [ ] **Step 8: Update handleFinish to clear order**

Replace `handleFinish`:

```typescript
  const handleFinish = useCallback(async () => {
    await clearCart();
    await clearVehicle();
    await clearOrder();
    setCartState([]);
    setVehicleState(null);
    setOrderState(null);
    setVehicleExpanded(true);
    setUrlChangeBanner(null);
    setState('done');
  }, []);
```

- [ ] **Step 9: Update vehiclePanelNode to pass new props**

Replace the `vehiclePanelNode` const:

```typescript
  const vehiclePanelNode = (
    <VehiclePanel
      vehicle={vehicle}
      order={order}
      workMode={workMode}
      expanded={vehicleExpanded}
      lang={lang}
      onVehicleSelected={(v) => {
        if (vehicle) { clearCart(); setCartState([]); }
        setVehicleState(v);
        setVehicle(v);
        setVehicleExpanded(false);
        setState('cart');
      }}
      onOrderSelected={(o) => {
        if (order) { clearCart(); setCartState([]); }
        setOrderState(o);
        setOrder(o);
        setVehicleExpanded(false);
        setState('cart');
      }}
      onExpand={() => setVehicleExpanded(true)}
    />
  );
```

- [ ] **Step 10: Update empty cart prompt to use workMode**

Find the JSX block:
```tsx
      {/* Empty cart + no vehicle = prompt to select vehicle */}
      {state === 'cart' && cart.length === 0 && !vehicle && (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <p className="text-sm text-gray-500">{T[lang].selectVehicle}</p>
        </div>
      )}
```

Replace with:
```tsx
      {/* Empty cart + no selection = prompt to select vehicle or order */}
      {state === 'cart' && cart.length === 0 && (workMode === 'order' ? !order : !vehicle) && (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <p className="text-sm text-gray-500">
            {workMode === 'order' ? T[lang].selectOrder : T[lang].selectVehicle}
          </p>
        </div>
      )}
```

Also update the "Empty cart + has vehicle = prompt to scan" check:

Find:
```tsx
      {/* Empty cart + has vehicle = prompt to scan */}
      {state === 'cart' && cart.length === 0 && vehicle && (
```

Replace with:
```tsx
      {/* Empty cart + has selection = prompt to scan */}
      {state === 'cart' && cart.length === 0 && (workMode === 'order' ? !!order : !!vehicle) && (
```

Also update the `AddPartForm` guard (around line 388):

Find:
```tsx
          {state === 'cart' && vehicle && (
```

Replace with:
```tsx
          {state === 'cart' && (workMode === 'order' ? !!order : !!vehicle) && (
```

- [ ] **Step 11: Build to verify clean compile**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1
```

Expected: `✓ built in Xs` with no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add src/pages/sidepanel/Sidebar.tsx && git commit -m "feat: wire workMode and order state into Sidebar — Autoflex integration complete"
```

---

### Task 8: Final build and smoke check

- [ ] **Step 1: Clean build**

```bash
cd C:\Users\Fillipe\partsiq-extension && yarn build:chrome 2>&1
```

Expected: clean build, `dist_chrome/` updated.

- [ ] **Step 2: Load in Chrome**

1. Open `chrome://extensions`
2. Click "Reload" on the PartsIQ extension
3. Open the sidebar on any supplier page

- [ ] **Step 3: Smoke test — vehicle mode (Autoflex NOT connected)**

Bubble login page should send `partsiq:login_success` with `autoflex_connected: false` (or omitted).
- Extension should show vehicle selection (same as today)
- Selecting a vehicle should collapse VehiclePanel showing plate + "Change car"
- Checking a part should call `save_part` with `vehicle_id` set and `order_id: ""`

- [ ] **Step 4: Smoke test — order mode (Autoflex connected)**

With Bubble sending `partsiq:login_success` with `autoflex_connected: true`:
- Extension should show the same Bubble iframe (Bubble renders orders)
- Selecting an order should call `partsiq:order_selected` with plate + id
- VehiclePanel collapses showing plate + "Change order"
- Checking a part should call `save_part` with `order_id` set and `vehicle_id: ""`

- [ ] **Step 5: Commit if any last fixes were made**

```bash
cd C:\Users\Fillipe\partsiq-extension && git add -p && git commit -m "fix: smoke test corrections"
```
