import type { CartItem, Lang, WorkMode, Vehicle, Order } from '@types/parts';
import { CONFIG } from '@lib/constants';

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

export async function getAutoflex(): Promise<boolean> {
  const r = await chrome.storage.local.get(K.AUTOFLEX);
  return r[K.AUTOFLEX] ?? false;
}
export async function setAutoflex(v: boolean): Promise<void> {
  await chrome.storage.local.set({ [K.AUTOFLEX]: v });
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
