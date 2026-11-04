// Helpers for detecting an Autoflex work order in the page URL.
// The panel (Bubble page `autoflex-panel?wo=`) expects the Autoflex order_id GUID.

export const AUTOFLEX_HOST = 'app.autoflex10.nl';

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function isAutoflexUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === AUTOFLEX_HOST;
  } catch {
    return false;
  }
}

/**
 * Returns the work-order GUID from an Autoflex URL (path, query or hash), or null.
 * Only URLs on the Autoflex host are considered.
 */
export function parseWorkOrderId(url: string | undefined | null): string | null {
  if (!isAutoflexUrl(url)) return null;
  const u = new URL(url as string);
  const match = (u.pathname + u.search + u.hash).match(GUID_RE);
  return match ? match[0].toUpperCase() : null;
}
