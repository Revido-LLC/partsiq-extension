// Helpers for detecting the open Autoflex work order.
// Autoflex is a Servoy single-page app: the URL never changes when a work order is
// opened, so the order number is read from the work order header in the page
// ("20240018 | 98-ZPZ-7 | HYUNDAI I 10"). The Bubble banner resolves it to the GUID.

/** Domains Autoflex runs on: autoflex10.work (test, evo.) and autoflex10.nl (production). */
export const AUTOFLEX_DOMAINS = ['autoflex10.work', 'autoflex10.nl'];

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

const isRendered = (el: Element): boolean => el.getClientRects().length > 0;

/** Order number of the work order currently open in Autoflex, or null. */
export function findOpenOrderNumber(
  root: ParentNode = document,
  isVisible: (el: Element) => boolean = isRendered,
): string | null {
  for (const form of root.querySelectorAll(`svy-form[name="${WORK_ORDER_FORM}"]`)) {
    if (!isVisible(form)) continue;
    const nr = parseOrderNumber(form.querySelector(TITLE_SELECTOR)?.textContent);
    if (nr) return nr;
  }
  return null;
}
