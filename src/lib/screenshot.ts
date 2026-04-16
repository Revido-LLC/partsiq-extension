import { CONFIG } from '@lib/constants';
import { dataUrlToBlob } from '@lib/image-utils';

async function captureVisible(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      { format: 'jpeg', quality: CONFIG.SCREENSHOT_QUALITY },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(dataUrl);
        }
      }
    );
  });
}

export async function captureScreenshot(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  let scrollHeight: number, viewportHeight: number, currentScrollY: number;
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'get_page_info' }) as {
      scrollHeight: number;
      viewportHeight: number;
      currentScrollY: number;
    };
    ({ scrollHeight, viewportHeight, currentScrollY } = info);
  } catch {
    return captureVisible();
  }

  const maxCaptures = 8;
  const positions: number[] = [];
  for (let y = 0; y < scrollHeight && positions.length < maxCaptures; y += viewportHeight) {
    positions.push(y);
  }

  if (positions.length <= 1) {
    return captureVisible();
  }

  const dataUrls: string[] = [];
  for (const y of positions) {
    await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y });
    await new Promise(r => setTimeout(r, 250));
    dataUrls.push(await captureVisible());
  }
  await chrome.tabs.sendMessage(tab.id, { type: 'scroll_to', y: currentScrollY });

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
