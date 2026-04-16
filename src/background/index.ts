import { CONFIG } from '@lib/constants';
import { dataUrlToBlob } from '@lib/image-utils';

// Open sidebar when extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {/* ignore if API not available */});

// ── Screenshot helper ────────────────────────────────────────────────────────

async function captureFullPage(tab: chrome.tabs.Tab): Promise<string> {
  if (!tab.id) throw new Error('No tab id');

  let scrollHeight: number, viewportHeight: number, currentScrollY: number;
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'get_page_info' }) as
      { scrollHeight: number; viewportHeight: number; currentScrollY: number };
    ({ scrollHeight, viewportHeight, currentScrollY } = info);
  } catch {
    // Restricted page — single capture
    return new Promise<string>(resolve =>
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
    );
  }

  const positions: number[] = [];
  for (let y = 0; y < scrollHeight && positions.length < 4; y += viewportHeight) {
    positions.push(y);
  }

  const dataUrls: string[] = [];
  for (const y of positions) {
    await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y });
    await new Promise(r => setTimeout(r, 250));
    const dataUrl = await new Promise<string>(resolve =>
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
    );
    dataUrls.push(dataUrl);
  }
  await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y: currentScrollY });

  if (dataUrls.length === 1) return dataUrls[0];

  const bitmaps = await Promise.all(dataUrls.map(u => createImageBitmap(dataUrlToBlob(u))));
  const w = bitmaps[0].width;
  const h = bitmaps[0].height;
  const canvas = new OffscreenCanvas(w, h * bitmaps.length);
  const ctx = canvas.getContext('2d')!;
  bitmaps.forEach((bmp, i) => ctx.drawImage(bmp, 0, i * h));
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: CONFIG.SCREENSHOT_QUALITY / 100 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function cropScreenshot(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  dpr: number
): Promise<string> {
  const bitmap = await createImageBitmap(dataUrlToBlob(dataUrl));
  const canvas = new OffscreenCanvas(rect.width * dpr, rect.height * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    bitmap,
    rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr,
    0, 0, rect.width * dpr, rect.height * dpr
  );
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: CONFIG.SCREENSHOT_QUALITY / 100 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'take_screenshot':
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab) { sendResponse({ error: 'No active tab' }); return; }
          const screenshot = await captureFullPage(tab);
          sendResponse({ screenshot });
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
      return true;

    case 'take_crop_init':
      (async () => {
        try {
          const tabId = msg.tabId as number;
          // Ensure content script is loaded (tabs opened before extension load won't have it)
          try {
            await chrome.tabs.sendMessage(tabId, { type: 'ping' });
          } catch {
            const manifest = chrome.runtime.getManifest();
            const files = manifest.content_scripts?.[0]?.js ?? [];
            if (files.length > 0) {
              await chrome.scripting.executeScript({ target: { tabId }, files });
            }
          }
          await chrome.tabs.sendMessage(tabId, { type: 'start_crop', lang: msg.lang ?? 'en' });
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ error: String(err) });
        }
      })();
      return true;

    case 'crop_done':
      (async () => {
        try {
          const tab = sender.tab;
          if (!tab?.windowId) throw new Error('No sender tab');
          const dataUrl = await new Promise<string>(resolve =>
            chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY }, resolve)
          );
          const cropped = await cropScreenshot(
            dataUrl,
            msg.rect as { x: number; y: number; width: number; height: number },
            (msg.dpr as number) ?? 1
          );
          chrome.runtime.sendMessage({ type: 'crop_ready', imageBase64: cropped }).catch(() => {});
        } catch (err) {
          chrome.runtime.sendMessage({ type: 'crop_ready', error: String(err) }).catch(() => {});
        }
      })();
      return true;

  }
});
