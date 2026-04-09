import type { CartItem, Vehicle, Order, WorkMode } from '@types/parts';
import type { Lang } from '@lib/translations';
import { CONFIG } from '@lib/constants';

const LANG_KEY = 'partsiq_language';

export async function getLanguage(): Promise<Lang> {
  const result = await chrome.storage.local.get(LANG_KEY);
  return (result[LANG_KEY] as Lang) ?? 'nl';
}

export async function setLanguage(lang: Lang): Promise<void> {
  await chrome.storage.local.set({ [LANG_KEY]: lang });
}

export async function getAuthStatus(): Promise<boolean> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.AUTH_STATUS);
  return result[CONFIG.STORAGE_KEYS.AUTH_STATUS] ?? false;
}

export async function setAuthStatus(loggedIn: boolean): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.AUTH_STATUS]: loggedIn });
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function itemDateString(scannedAt: string): string {
  const d = new Date(scannedAt);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export async function getCart(): Promise<CartItem[]> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.CART);
  const items: CartItem[] = result[CONFIG.STORAGE_KEYS.CART] ?? [];
  const today = todayDateString();
  return items.filter(item => itemDateString(item.scannedAt) === today);
}

export async function setCart(items: CartItem[]): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.CART]: items });
}

export async function clearCart(): Promise<void> {
  await chrome.storage.local.remove(CONFIG.STORAGE_KEYS.CART);
}

export async function getVehicle(): Promise<Vehicle | null> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.VEHICLE);
  return result[CONFIG.STORAGE_KEYS.VEHICLE] ?? null;
}

export async function setVehicle(vehicle: Vehicle): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.VEHICLE]: vehicle });
}

export async function clearVehicle(): Promise<void> {
  await chrome.storage.local.remove(CONFIG.STORAGE_KEYS.VEHICLE);
}

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
