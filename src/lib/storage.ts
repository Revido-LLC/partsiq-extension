import type { CartItem, Lang, WorkMode, Vehicle, Order } from '@types/parts';
import { CONFIG } from '@lib/constants';

// Legacy Session type for backward compatibility with old popup code
export interface Session {
  id: string;
  name: string;
  createdAt: string;
  partCount: number;
}

const K = CONFIG.STORAGE_KEYS;
const today = () => new Date().toISOString().slice(0, 10);

export async function getAuthStatus(): Promise<boolean> {
  const r = await chrome.storage.local.get(K.AUTH_STATUS);
  return r[K.AUTH_STATUS] ?? false;
}
export async function setAuthStatus(v: boolean): Promise<void> {
  await chrome.storage.local.set({ [K.AUTH_STATUS]: v });
}

export async function getLang(): Promise<Lang> {
  const r = await chrome.storage.local.get(K.LANG);
  return (r[K.LANG] as Lang) ?? 'en';
}
export async function setLang(v: Lang): Promise<void> {
  await chrome.storage.local.set({ [K.LANG]: v });
}

export async function getWorkMode(): Promise<WorkMode> {
  const r = await chrome.storage.local.get(K.WORK_MODE);
  return (r[K.WORK_MODE] as WorkMode) ?? 'vehicle';
}
export async function setWorkMode(v: WorkMode): Promise<void> {
  await chrome.storage.local.set({ [K.WORK_MODE]: v });
}

export async function getVehicle(): Promise<Vehicle | null> {
  const r = await chrome.storage.local.get(K.VEHICLE);
  return r[K.VEHICLE] ?? null;
}
export async function setVehicle(v: Vehicle | null): Promise<void> {
  await chrome.storage.local.set({ [K.VEHICLE]: v });
}

export async function getOrder(): Promise<Order | null> {
  const r = await chrome.storage.local.get(K.ORDER);
  return r[K.ORDER] ?? null;
}
export async function setOrder(v: Order | null): Promise<void> {
  await chrome.storage.local.set({ [K.ORDER]: v });
}

export async function getCart(): Promise<CartItem[]> {
  const r = await chrome.storage.local.get([K.CART, K.CART_DATE]);
  if (r[K.CART_DATE] !== today()) {
    await chrome.storage.local.set({ [K.CART]: [], [K.CART_DATE]: today() });
    return [];
  }
  return (r[K.CART] as CartItem[]) ?? [];
}
export async function setCart(items: CartItem[]): Promise<void> {
  await chrome.storage.local.set({ [K.CART]: items, [K.CART_DATE]: today() });
}

// ---- Backward Compatibility (Legacy popup API) ----
// These functions are kept for backward compatibility with old popup code
// and will be removed in Task 14 (Delete old popup files)

export async function getActiveSession(): Promise<Session | null> {
  const r = await chrome.storage.local.get(K.ORDER);
  if (!r[K.ORDER]) return null;
  const order = r[K.ORDER] as Order;
  return {
    id: order.id,
    name: `Session for ${order.plate}`,
    createdAt: new Date().toISOString(),
    partCount: 0,
  };
}

export async function setActiveSession(session: Session | null): Promise<void> {
  if (session) {
    // Map legacy Session back to new Order model
    const order: Order = {
      id: session.id,
      plate: session.name,
    };
    await chrome.storage.local.set({ [K.ORDER]: order });
  } else {
    await chrome.storage.local.set({ [K.ORDER]: null });
  }
}
