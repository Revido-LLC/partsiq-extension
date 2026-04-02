import { CONFIG } from '@lib/constants';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'take_screenshot':
      chrome.tabs.captureVisibleTab(
        null as unknown as number,
        { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY },
        (dataUrl) => sendResponse({ screenshot: dataUrl })
      );
      return true; // CRITICAL: keeps message channel open for async response

    case 'url_changed':
      // Relay URL change from content script to popup (if open)
      chrome.runtime.sendMessage({
        type: 'page_url_changed',
        url: msg.url as string,
      }).catch(() => {
        // Popup may not be open — ignore error
      });
      break;
  }
});
