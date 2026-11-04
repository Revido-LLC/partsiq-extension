// Content script for app.autoflex10.nl:
// detects the open work order, shows the Parts iQ banner (Bubble page in an iframe,
// isolated in a Shadow DOM) and relays banner messages to the background.
import { CONFIG } from '@lib/constants';
import { parseWorkOrderId } from '@lib/autoflex';

const DEFAULT_HEIGHT = 56;
const HIDDEN_KEY = (wo: string) => `partsiq_banner_hidden_${wo}`;

let currentWo: string | null = null;
let host: HTMLDivElement | null = null;
let iframe: HTMLIFrameElement | null = null;
let originalPaddingTop: string | null = null;

function bannerUrl(wo: string): string {
  const query = new URLSearchParams({ wo, ext: chrome.runtime.id });
  return `${CONFIG.BUBBLE_BASE_URL}${CONFIG.BUBBLE_PAGES.autoflexBanner}?${query}`;
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

function showBanner(wo: string): void {
  if (sessionStorage.getItem(HIDDEN_KEY(wo))) return;
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
  iframe!.src = bannerUrl(wo);
}

function check(): void {
  const wo = parseWorkOrderId(location.href);
  if (wo === currentWo) return;
  currentWo = wo;
  chrome.runtime.sendMessage({ type: 'autoflex_work_order', workOrderId: wo }).catch(() => {});
  if (wo) showBanner(wo);
  else removeBanner();
}

window.addEventListener('message', (event) => {
  if (event.origin !== CONFIG.BUBBLE_ORIGIN || !iframe || event.source !== iframe.contentWindow) return;
  const data = event.data as { type?: string; count?: number; height?: number } | null;
  switch (data?.type) {
    case 'partsiq:banner_hide':
      if (currentWo) sessionStorage.setItem(HIDDEN_KEY(currentWo), '1');
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

// SPA navigation: Navigation API when available, plus a light poll as fallback.
const nav = (window as unknown as { navigation?: EventTarget }).navigation;
nav?.addEventListener('navigatesuccess', check);
window.addEventListener('popstate', check);
setInterval(check, 1000);
check();
