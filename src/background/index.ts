import { CONFIG } from '@lib/constants';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'take_screenshot':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) { sendResponse({ error: 'No active tab' }); return; }

          // Get page dimensions — fall back to single capture if content script is unavailable
          let scrollHeight: number, viewportHeight: number, currentScrollY: number;
          try {
            const pageInfo = await chrome.tabs.sendMessage(tab.id, { type: 'get_page_info' }) as
              { scrollHeight: number; viewportHeight: number; currentScrollY: number };
            ({ scrollHeight, viewportHeight, currentScrollY } = pageInfo);
          } catch {
            // Content script not available (restricted page or not yet injected) — single capture
            const dataUrl = await new Promise<string>(resolve =>
              chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
            );
            sendResponse({ screenshot: dataUrl });
            return;
          }

          // Scroll positions — max 4 captures to keep image size manageable
          const positions: number[] = [];
          for (let y = 0; y < scrollHeight && positions.length < 4; y += viewportHeight) {
            positions.push(y);
          }

          // Capture each scroll position
          const dataUrls: string[] = [];
          for (const y of positions) {
            await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y });
            await new Promise(r => setTimeout(r, 250));
            const dataUrl = await new Promise<string>(resolve =>
              chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY },
                resolve
              )
            );
            dataUrls.push(dataUrl);
          }

          // Restore original scroll position
          await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y: currentScrollY });

          // Single capture — return directly
          if (dataUrls.length === 1) {
            sendResponse({ screenshot: dataUrls[0] });
            return;
          }

          // Stitch captures vertically using OffscreenCanvas
          // Note: fetch(dataUrl) fails in MV3 service workers — decode base64 manually
          function dataUrlToBlob(dataUrl: string): Blob {
            const [header, b64] = dataUrl.split(',');
            const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
            const bytes = atob(b64);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
            return new Blob([arr], { type: mime });
          }

          const bitmaps = await Promise.all(
            dataUrls.map(url => createImageBitmap(dataUrlToBlob(url)))
          );
          const w = bitmaps[0].width;
          const h = bitmaps[0].height;
          const canvas = new OffscreenCanvas(w, h * bitmaps.length);
          const ctx = canvas.getContext('2d')!;
          bitmaps.forEach((bmp, i) => ctx.drawImage(bmp, 0, i * h));
          const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: CONFIG.SCREENSHOT_QUALITY / 100 });
          const reader = new FileReader();
          reader.onerror = () => sendResponse({ error: 'FileReader failed to convert canvas blob' });
          reader.onload = () => sendResponse({ screenshot: reader.result as string });
          reader.readAsDataURL(blob);
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
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
