import { CONFIG } from '@lib/constants';
import { dataUrlToBlob } from '@lib/image-utils';
import { canCropOn } from '@lib/crop';

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

// ── External message handler (Bubble → extension) ──────────────────────────

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'open_sidepanel' && sender.tab?.id) {
    const tabId = sender.tab.id;
    // open() must run first, synchronously inside the user gesture
    const opening = chrome.sidePanel.open({ tabId });
    const workOrderId = typeof msg.workOrderId === 'string' ? msg.workOrderId : null;
    if (workOrderId) {
      void setTabWorkOrder(tabId, workOrderId).then(() =>
        broadcastWorkOrder(workOrderId, msg.search === true),
      );
    }
    opening
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }
});

// ── Autoflex work order per tab ─────────────────────────────────────────────

async function getTabWorkOrders(): Promise<Record<string, string>> {
  const key = CONFIG.STORAGE_KEYS.TAB_WORK_ORDERS;
  const data = await chrome.storage.session.get(key);
  return (data[key] as Record<string, string> | undefined) ?? {};
}

async function setTabWorkOrder(tabId: number, workOrderId: string | null): Promise<void> {
  const map = await getTabWorkOrders();
  if (workOrderId) map[String(tabId)] = workOrderId;
  else delete map[String(tabId)];
  await chrome.storage.session.set({ [CONFIG.STORAGE_KEYS.TAB_WORK_ORDERS]: map });
}

function broadcastWorkOrder(workOrderId: string | null, search = false): void {
  chrome.runtime
    .sendMessage({ type: 'work_order_active', workOrderId, search })
    .catch(() => {/* side panel not open */});
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

// ── Crop follows the active tab ─────────────────────────────────────────────
// After "Crop" the user may switch tabs: the overlay moves to the active supplier tab until
// an area is selected or Esc cancels. Autoflex tabs are skipped so the work order stays usable.

const CROP_ARMED_KEY = 'partsiq_crop_armed';
/** shown: the overlay (with its first-time hint) already appeared in some tab */
interface CropArmed { lang: string; tabId: number; shown: boolean }

async function getCropArmed(): Promise<CropArmed | null> {
  const data = await chrome.storage.session.get(CROP_ARMED_KEY);
  return (data[CROP_ARMED_KEY] as CropArmed | undefined) ?? null;
}

async function setCropArmed(v: CropArmed | null): Promise<void> {
  if (v) await chrome.storage.session.set({ [CROP_ARMED_KEY]: v });
  else await chrome.storage.session.remove(CROP_ARMED_KEY);
}

async function showCropIn(tabId: number, lang: string, hint: boolean): Promise<void> {
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
  await chrome.tabs.sendMessage(tabId, { type: 'start_crop', lang, hint });
}

function hideCropIn(tabId: number): void {
  chrome.tabs.sendMessage(tabId, { type: 'stop_crop' }).catch(() => {/* tab gone or restricted */});
}

async function moveCropTo(tabId: number): Promise<void> {
  const armed = await getCropArmed();
  if (!armed) return;
  if (armed.tabId !== tabId) hideCropIn(armed.tabId);
  await setCropArmed({ ...armed, tabId });
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!canCropOn(tab.url)) return;
    await showCropIn(tabId, armed.lang, !armed.shown);
    await setCropArmed({ ...armed, tabId, shown: true });
  } catch {/* restricted page: wait for the next tab */}
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void getTabWorkOrders().then(map => broadcastWorkOrder(map[String(tabId)] ?? null));
  void moveCropTo(tabId);
});

// The overlay is lost when the armed tab navigates: show it again on the new page
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== 'complete') return;
  void getCropArmed().then(armed => {
    if (armed?.tabId === tabId) void moveCropTo(tabId);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void setTabWorkOrder(tabId, null);
});

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'autoflex_work_order':
      (async () => {
        const tabId = sender.tab?.id;
        if (!tabId) return;
        const workOrderId = typeof msg.workOrderId === 'string' ? msg.workOrderId : null;
        await setTabWorkOrder(tabId, workOrderId);
        if (!workOrderId) await chrome.action.setBadgeText({ tabId, text: '' });
        if ((await activeTabId()) === tabId) broadcastWorkOrder(workOrderId);
      })();
      return false;

    case 'autoflex_badge':
      if (sender.tab?.id) {
        const count = Number(msg.count) || 0;
        void chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#00C6B2' });
        void chrome.action.setBadgeText({ tabId: sender.tab.id, text: count > 0 ? String(count) : '' });
      }
      return false;

    case 'get_active_work_order':
      (async () => {
        const tabId = await activeTabId();
        const map = await getTabWorkOrders();
        sendResponse({ workOrderId: tabId ? map[String(tabId)] ?? null : null });
      })();
      return true;

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
        const tabId = msg.tabId as number;
        const lang = (msg.lang as string) ?? 'en';
        const previous = await getCropArmed();
        if (previous && previous.tabId !== tabId) hideCropIn(previous.tabId);
        // Armed even when this tab can't show it (e.g. Autoflex): the next supplier tab will
        await setCropArmed({ lang, tabId, shown: false });
        await moveCropTo(tabId);
        sendResponse({ ok: true });
      })();
      return true;

    case 'crop_ready':
      // Esc in a tab cancels the crop everywhere (the side panel handles the message itself)
      if (sender.tab) void setCropArmed(null);
      return false;

    case 'crop_done':
      (async () => {
        await setCropArmed(null);
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
