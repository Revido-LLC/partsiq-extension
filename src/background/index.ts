import { CONFIG } from '@lib/constants';

// Open the side panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.windowId) return;
  await chrome.sidePanel.open({ windowId: tab.windowId });
  // Give the side panel React app ~300ms to mount before sending the open signal
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: 'sidebar_opened',
      tabId: tab.id,
      url: tab.url ?? '',
    }).catch(() => {
      // Side panel may not be ready yet — it will auto-scan on mount anyway
    });
  }, 300);
});

/** Convert a base64 data URL to Uint8Array without FileReader (safe in SW). */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Convert Uint8Array to base64 data URL. */
function bytesToDataUrl(bytes: Uint8Array, mimeType = 'image/jpeg'): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'take_screenshot':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) { sendResponse({ error: 'No active tab' }); return; }

          const tabUrl = tab.url ?? '';

          // Restricted pages (chrome://, edge://, about:) — fall back to captureVisibleTab
          const isRestricted = !tabUrl || tabUrl.startsWith('chrome') || tabUrl.startsWith('edge') || tabUrl.startsWith('about');
          if (isRestricted) {
            const dataUrl = await new Promise<string>(resolve =>
              chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
            );
            sendResponse({ screenshot: dataUrl, tabUrl });
            return;
          }

          // CDP full-page capture with scroll-to-bottom to trigger lazy loading
          await chrome.debugger.attach({ tabId: tab.id }, '1.3');
          try {
            // Scroll to bottom to trigger lazy-loaded content, then back to top
            await chrome.debugger.sendCommand({ tabId: tab.id }, 'Runtime.evaluate', {
              expression: `(async () => {
                const delay = ms => new Promise(r => setTimeout(r, ms));
                const step = Math.floor(window.innerHeight * 0.8);
                for (let y = step; y < document.body.scrollHeight; y += step) {
                  window.scrollTo(0, y);
                  await delay(120);
                }
                window.scrollTo(0, 0);
                await delay(150);
              })()`
            });
            // Small wait for final renders after scroll
            await new Promise(r => setTimeout(r, 300));
            const result = await chrome.debugger.sendCommand(
              { tabId: tab.id },
              'Page.captureScreenshot',
              { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY, captureBeyondViewport: true }
            ) as { data: string };
            sendResponse({ screenshot: `data:image/jpeg;base64,${result.data}`, tabUrl });
          } finally {
            await chrome.debugger.detach({ tabId: tab.id }).catch(() => {});
          }
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
      return true; // CRITICAL: keeps message channel open for async response

    case 'url_changed':
      // Relay URL change from content script to popup/sidebar (if open)
      chrome.runtime.sendMessage({
        type: 'page_url_changed',
        url: msg.url as string,
      }).catch(() => {
        // Panel may not be open — ignore error
      });
      break;

    case 'start_crop':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) { sendResponse({ error: 'No active tab' }); return; }

          // Try sending to content script; if not loaded (e.g. tab was open before
          // extension reload), inject it first then retry.
          const sendOverlayMsg = () =>
            chrome.tabs.sendMessage(tab.id!, { type: 'show_crop_overlay' });
          try {
            await sendOverlayMsg();
          } catch {
            const manifest = chrome.runtime.getManifest();
            const scriptFile = (manifest as { content_scripts?: { js?: string[] }[] })
              .content_scripts?.[0]?.js?.[0];
            if (!scriptFile) throw new Error('Content script not found in manifest');
            await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: [scriptFile] });
            await sendOverlayMsg();
          }

          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
      return true;

    case 'cancel_crop':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) return;
          await chrome.tabs.sendMessage(tab.id, { type: 'dismiss_crop_overlay' }).catch(() => {});
        } catch { /* overlay may not be present — ignore */ }
      })();
      break;

    case 'crop_selected':
      (async () => {
        const { rect } = msg as {
          rect: { x: number; y: number; width: number; height: number; devicePixelRatio: number };
        };
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id) throw new Error('No active tab');

          // Capture visible viewport only (no scroll — user drew selection on visible area)
          await chrome.debugger.attach({ tabId: tab.id }, '1.3');
          let fullBase64: string;
          try {
            const result = await chrome.debugger.sendCommand(
              { tabId: tab.id },
              'Page.captureScreenshot',
              { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }
              // captureBeyondViewport intentionally omitted — visible viewport only
            ) as { data: string };
            fullBase64 = `data:image/jpeg;base64,${result.data}`;
          } finally {
            await chrome.debugger.detach({ tabId: tab.id }).catch(() => {});
          }

          // Crop via OffscreenCanvas
          const dpr = rect.devicePixelRatio;
          const srcBytes = dataUrlToBytes(fullBase64);
          const blob = new Blob([srcBytes], { type: 'image/jpeg' });
          const bitmap = await createImageBitmap(blob);

          const cw = Math.round(rect.width  * dpr);
          const ch = Math.round(rect.height * dpr);
          const canvas = new OffscreenCanvas(cw, ch);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(
            bitmap,
            Math.round(rect.x * dpr), Math.round(rect.y * dpr),
            Math.round(rect.width * dpr), Math.round(rect.height * dpr),
            0, 0, cw, ch
          );

          const cropBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
          const cropBytes = new Uint8Array(await cropBlob.arrayBuffer());
          const croppedDataUrl = bytesToDataUrl(cropBytes);

          chrome.runtime.sendMessage({ type: 'crop_done', screenshot: croppedDataUrl }).catch(() => {});
        } catch (err) {
          chrome.runtime.sendMessage({ type: 'crop_error', error: String(err) }).catch(() => {});
        }
      })();
      break; // result pushed via sendMessage — no sendResponse needed
  }
});
