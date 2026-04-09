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
