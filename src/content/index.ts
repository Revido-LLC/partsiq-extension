import { showCropOverlay, hideCropOverlay } from './crop-overlay';

let currentUrl = window.location.href;

// Debounce to avoid flooding background on DOM-heavy SPAs
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const safeSendMessage = (msg: object) => {
  if (!chrome.runtime?.id) return;
  chrome.runtime.sendMessage(msg).catch(() => {});
};

const notifyUrlChange = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      safeSendMessage({ type: 'url_changed', url: currentUrl });
    }
  }, 100);
};

// MutationObserver for SPA navigation (React/Vue/Angular DOM mutations)
const observer = new MutationObserver(notifyUrlChange);
observer.observe(document.body, { childList: true, subtree: true });

// History API interception for pushState/replaceState
(['pushState', 'replaceState'] as const).forEach((method) => {
  const original = history[method];
  history[method] = function (...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    safeSendMessage({ type: 'url_changed', url: window.location.href });
    return result;
  };
});

// Crop overlay trigger from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'show_crop_overlay') {
    showCropOverlay();
  }
  if (msg.type === 'dismiss_crop_overlay') {
    hideCropOverlay();
  }
});
