import type { AiPart } from '@lib/ai';
import type { CartItem } from '@types/parts';

/**
 * Converts AI-extracted parts into CartItem objects ready for the cart.
 * When autoSend is true the items are pre-checked so they can be sent
 * automatically without the user having to tick each one.
 */
export const aiPartsToCartItems = (
  parts: AiPart[],
  sourceUrl: string,
  autoSend = false,
): CartItem[] =>
  parts.map(p => ({
    id: crypto.randomUUID(),
    name: p.name,
    oem: p.oem ?? '',
    price: p.price,
    deliveryDays: p.delivery_days,
    stock: p.stock,
    supplier: p.supplier ?? '',
    sourceUrl,
    scannedAt: new Date().toISOString(),
    status: 'pending' as const,
    checked: autoSend,
    autoSend,
  }));

/**
 * Merges an incoming set of cart items into the existing cart.
 * Any pending or error items that share the same source URL are dropped first
 * (they are replaced by the fresh scan), then the incoming items are appended.
 */
export const mergeCart = (
  existing: CartItem[],
  incoming: CartItem[],
  currentUrl: string,
): CartItem[] => {
  const kept = existing.filter(
    item =>
      !(
        item.sourceUrl === currentUrl &&
        (item.status === 'pending' || item.status === 'error')
      ),
  );
  return [...kept, ...incoming];
};
