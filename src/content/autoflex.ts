// Content script for Autoflex (autoflex10.eu production, autoflex10.work test):
// detects the open work order (by its order number in the page header — the Servoy
// app never changes the URL), shows the Parts iQ banner (Bubble page in an iframe,
// isolated in a Shadow DOM) and relays banner messages to the background.
// The banner resolves the order number to the Autoflex GUID and posts it back.
import { CONFIG } from '@lib/constants';
import { findOpenOrderNumber, createPageOffsetter } from '@lib/autoflex';

const DEFAULT_HEIGHT = 48;
const HIDDEN_KEY = (nr: string) => `partsiq_banner_hidden_${nr}`;

let currentNr: string | null = null;
let host: HTMLDivElement | null = null;
let iframe: HTMLIFrameElement | null = null;
let bannerHeight = 0;
const applyOffset = createPageOffsetter(document);

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
  bannerHeight = h;
  applyOffset(h);
}

function removeBanner(): void {
  host?.remove();
  host = null;
  iframe = null;
  if (bannerHeight) {
    bannerHeight = 0;
    applyOffset(0);
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
    iframe.style.cssText = 'display:block;width:100%;height:0;border:0;background:transparent;';
    shadow.appendChild(iframe);
    document.documentElement.appendChild(host);
  }
  // Stay invisible until the Bubble page confirms it loaded (partsiq:banner_ready):
  // a missing page (404 before the Bubble release) or an outage never shows up.
  setHeight(0);
  iframe!.src = bannerUrl(nr);
}

function check(): void {
  const nr = findOpenOrderNumber();
  if (host && bannerHeight) applyOffset(bannerHeight); // Servoy may re-render #mainForm
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
    case 'partsiq:banner_ready':
      setHeight(DEFAULT_HEIGHT);
      break;
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
