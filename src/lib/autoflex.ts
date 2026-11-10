// Helpers for detecting the open Autoflex work order.
// Autoflex is a Servoy single-page app: the URL never changes when a work order is
// opened, so the order number is read from the work order header in the page
// ("20240018 | 98-ZPZ-7 | HYUNDAI I 10"). The Bubble banner resolves it to the GUID.

/** Domains Autoflex runs on: autoflex10.eu (production), autoflex10.work (test, evo.), autoflex10.nl. */
export const AUTOFLEX_DOMAINS = ['autoflex10.eu', 'autoflex10.work', 'autoflex10.nl'];

/** Servoy form that holds an open work order, and its title label. */
export const WORK_ORDER_FORM = 'orders_dtl';
const TITLE_SELECTOR = '[data-afl="orders_dtl.title_label"], [data-cy="orders_dtl.title_label"]';

const ORDER_HEADER_RE = /^\s*(\d{4,})\s*\|/;

export function isAutoflexUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return AUTOFLEX_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Order number from a work order header text, or null. */
export function parseOrderNumber(text: string | null | undefined): string | null {
  const match = (text ?? '').match(ORDER_HEADER_RE);
  return match ? match[1] : null;
}

/** License plate (2nd part) from a work order header text, or '' (no plate / not a header). */
export function parseOrderPlate(text: string | null | undefined): string {
  if (!parseOrderNumber(text)) return '';
  return (text ?? '').split('|')[1]?.trim() ?? '';
}

const isRendered = (el: Element): boolean => el.getClientRects().length > 0;

function findOpenOrderHeader(root: ParentNode, isVisible: (el: Element) => boolean): string | null {
  for (const form of root.querySelectorAll(`svy-form[name="${WORK_ORDER_FORM}"]`)) {
    if (!isVisible(form)) continue;
    const text = form.querySelector(TITLE_SELECTOR)?.textContent;
    if (parseOrderNumber(text)) return text ?? null;
  }
  return null;
}

/** Order number of the work order currently open in Autoflex, or null. */
export function findOpenOrderNumber(
  root: ParentNode = document,
  isVisible: (el: Element) => boolean = isRendered,
): string | null {
  return parseOrderNumber(findOpenOrderHeader(root, isVisible));
}

/** License plate shown in the header of the open work order, or ''. */
export function findOpenOrderPlate(
  root: ParentNode = document,
  isVisible: (el: Element) => boolean = isRendered,
): string {
  return parseOrderPlate(findOpenOrderHeader(root, isVisible));
}

/**
 * Returns a function that pushes the Autoflex page down by `h` px (0 = restore).
 * Servoy lays the whole app out in #mainForm (position:absolute; inset:0), so body
 * padding does not move it: shift that container instead (body padding as fallback).
 * Restoring puts back the exact original value — clearing `top` would turn
 * `inset:0` into `top:auto` and push the whole app off screen.
 */
export function createPageOffsetter(doc: Document): (h: number) => void {
  let originalMainTop: string | null = null;
  let originalBodyPadding: string | null = null;
  return (h: number) => {
    const main = doc.getElementById('mainForm');
    if (main) {
      if (originalMainTop === null) originalMainTop = main.style.top || '0px';
      main.style.top = h ? `${h}px` : originalMainTop;
      if (!h) originalMainTop = null;
    } else {
      if (originalBodyPadding === null) originalBodyPadding = doc.body.style.paddingTop;
      doc.body.style.paddingTop = h ? `${h}px` : originalBodyPadding;
      if (!h) originalBodyPadding = null;
    }
  };
}

/**
 * The order the extension must use for crop/scan when a work order is open in Autoflex.
 * Returns null when nothing changes (no open work order, or the extension already uses it);
 * otherwise the open work order with the plate the Autoflex banner reported ('' when unknown:
 * save_part finds the car by the GUID). A missing plate on the current order is filled in.
 */
export function orderForOpenWorkOrder(
  current: { id: string; plate: string } | null,
  openWorkOrderId: string | null,
  plate = '',
): { id: string; plate: string } | null {
  if (!openWorkOrderId) return null;
  if (current && current.id.toLowerCase() === openWorkOrderId.toLowerCase()) {
    return !current.plate && plate ? { ...current, plate } : null;
  }
  return { id: openWorkOrderId, plate };
}
