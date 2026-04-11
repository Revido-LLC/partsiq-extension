// ── Page info & scroll helpers ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'get_page_info') {
    sendResponse({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      currentScrollY: window.scrollY,
    });
  } else if (msg.type === 'scroll_to') {
    window.scrollTo(0, msg.y as number);
    setTimeout(() => sendResponse({ done: true }), 200);
    return true;
  } else if (msg.type === 'start_crop') {
    injectCropOverlay();
    sendResponse({ ok: true });
  }
});

// ── URL change detection ─────────────────────────────────────────────────────

let currentUrl = window.location.href;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const notifyUrlChange = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      chrome.runtime.sendMessage({ type: 'url_changed', url: currentUrl });
    }
  }, 100);
};

const observer = new MutationObserver(notifyUrlChange);
observer.observe(document.body, { childList: true, subtree: true });

(['pushState', 'replaceState'] as const).forEach((method) => {
  const original = history[method];
  history[method] = function (...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    chrome.runtime.sendMessage({ type: 'url_changed', url: window.location.href });
    return result;
  };
});

// ── Crop overlay ─────────────────────────────────────────────────────────────

let cropOverlay: HTMLDivElement | null = null;
let cropKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function removeCropOverlay() {
  cropOverlay?.remove();
  cropOverlay = null;
  if (cropKeyHandler) {
    document.removeEventListener('keydown', cropKeyHandler);
    cropKeyHandler = null;
  }
}

function injectCropOverlay() {
  if (cropOverlay) return;

  cropOverlay = document.createElement('div');
  cropOverlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.25);';

  let startX = 0;
  let startY = 0;
  let selectionEl: HTMLDivElement | null = null;

  cropOverlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    selectionEl = document.createElement('div');
    selectionEl.style.cssText =
      'position:fixed;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);pointer-events:none;';
    cropOverlay!.appendChild(selectionEl);
  });

  cropOverlay.addEventListener('mousemove', (e) => {
    if (!selectionEl) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    selectionEl.style.left = x + 'px';
    selectionEl.style.top = y + 'px';
    selectionEl.style.width = Math.abs(e.clientX - startX) + 'px';
    selectionEl.style.height = Math.abs(e.clientY - startY) + 'px';
  });

  cropOverlay.addEventListener('mouseup', (e) => {
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    removeCropOverlay();
    if (width > 10 && height > 10) {
      chrome.runtime.sendMessage({
        type: 'crop_done',
        rect: { x, y, width, height },
        dpr: window.devicePixelRatio,
      });
    }
  });

  cropKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      removeCropOverlay();
    }
  };
  document.addEventListener('keydown', cropKeyHandler);
  document.body.appendChild(cropOverlay);
}
