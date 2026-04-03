import type { Session } from '@types/parts';
import { CONFIG } from '@lib/constants';

export async function getAuthStatus(): Promise<boolean> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.AUTH_STATUS);
  return result[CONFIG.STORAGE_KEYS.AUTH_STATUS] ?? false;
}

export async function setAuthStatus(loggedIn: boolean): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.AUTH_STATUS]: loggedIn });
}

export async function getActiveSession(): Promise<Session | null> {
  const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.ACTIVE_SESSION);
  return result[CONFIG.STORAGE_KEYS.ACTIVE_SESSION] ?? null;
}

export async function setActiveSession(session: Session | null): Promise<void> {
  await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.ACTIVE_SESSION]: session });
}

