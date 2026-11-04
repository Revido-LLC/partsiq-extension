// Content script for Autoflex (autoflex10.work / autoflex10.nl):
// detects the open work order (by its order number in the page header — the Servoy
// app never changes the URL), shows the Parts iQ banner (Bubble page in an iframe,
// isolated in a Shadow DOM) and relays banner messages to the background.
// The banner resolves the order number to the Autoflex GUID and posts it back.
import { CONFIG } from '@lib/constants';
import { findOpenOrderNumber } from '@lib/autoflex';

const DEFAULT_HEIGHT = 56;
const HIDDEN_KEY = (nr: string) => `partsiq_banner_hidden_${nr}`;

let currentNr: string | null = null;
let host: HTMLDivElement | null = null;
let iframe: HTMLIFrameElement | null = null;
let originalPaddingTop: string | null = null;

function bannerUrl(nr: string): string {
  const query = new URLSearchParams({ nr, ext: chrome.runtime.id });
  return `${CONFIG.BUBBLE_BASE_URL}${CONFIG.BUBBLE_PAGES.autoflexBanner}?${query}`;
}

function sendWorkOrder(workOrderId: string | null): void {
  chrome.runtime.sendMessage({ type: 'autoflex_work_order', workOrderId }).catch(() => {});
}

function setHeight(height: number): void {
  if (!host || !iframe) return;
  const h = Math.max(0, Math.min(height, 200));
  iframe.style.height = `${h}px`;
  if (originalPaddingTop === null) originalPaddingTop = document.body.style.paddingTop;
  document.body.style.paddingTop = `${h}px`;
}

function removeBanner(): void {
  host?.remove();
  host = null;
  iframe = null;
  if (originalPaddingTop !== null) {
    document.body.style.paddingTop = originalPaddingTop;
    originalPaddingTop = null;
  }
}

function showBanner(nr: string): void {
  if (sessionStorage.getItem(HIDDEN_KEY(nr))) return;
  if (!host) {
    host = document.createElement('div');
    host.id = 'partsiq-banner-host';
    host.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;';
    const shadow = host.attachShadow({ mode: 'closed' });
    iframe = document.createElement('iframe');
    iframe.title = 'Parts iQ';
    iframe.style.cssText = `display:block;width:100%;height:${DEFAULT_HEIGHT}px;border:0;background:transparent;`;
    shadow.appendChild(iframe);
    document.documentElement.appendChild(host);
    setHeight(DEFAULT_HEIGHT);
  }
  iframe!.src = bannerUrl(nr);
}

function check(): void {
  const nr = findOpenOrderNumber();
  if (nr === currentNr) return;
  currentNr = nr;
  // The GUID arrives later from the banner (partsiq:banner_wo); clear the old one now.
  sendWorkOrder(null);
  if (nr) showBanner(nr);
  else removeBanner();
}

window.addEventListener('message', (event) => {
  if (event.origin !== CONFIG.BUBBLE_ORIGIN || !iframe || event.source !== iframe.contentWindow) return;
  const data = event.data as { type?: string; count?: number; height?: number; workOrderId?: string } | null;
  switch (data?.type) {
    case 'partsiq:banner_wo':
      if (currentNr && typeof data.workOrderId === 'string' && data.workOrderId) sendWorkOrder(data.workOrderId);
      break;
    case 'partsiq:banner_hide':
      if (currentNr) sessionStorage.setItem(HIDDEN_KEY(currentNr), '1');
      removeBanner();
      break;
    case 'partsiq:banner_count':
      chrome.runtime.sendMessage({ type: 'autoflex_badge', count: data.count ?? 0 }).catch(() => {});
      break;
    case 'partsiq:banner_height':
      if (typeof data.height === 'number') setHeight(data.height);
      break;
  }
});

// Servoy swaps forms without navigating: watch the DOM (debounced) plus a light poll.
let pending = false;
new MutationObserver(() => {
  if (pending) return;
  pending = true;
  setTimeout(() => { pending = false; check(); }, 300);
}).observe(document.body, { childList: true, subtree: true, characterData: true });
setInterval(check, 1500);
check();
