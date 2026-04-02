let currentUrl = window.location.href;

// Debounce to avoid flooding background on DOM-heavy SPAs
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

// MutationObserver for SPA navigation (React/Vue/Angular DOM mutations)
const observer = new MutationObserver(notifyUrlChange);
observer.observe(document.body, { childList: true, subtree: true });

// History API interception for pushState/replaceState
(['pushState', 'replaceState'] as const).forEach((method) => {
  const original = history[method];
  history[method] = function (...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    chrome.runtime.sendMessage({ type: 'url_changed', url: window.location.href });
    return result;
  };
});
