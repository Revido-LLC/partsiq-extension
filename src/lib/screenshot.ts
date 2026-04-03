/**
 * Requests a screenshot from the background service worker.
 * Must be called from popup context (not content script).
 * @returns base64 data URL (data:image/jpeg;base64,...)
 */
export async function captureScreenshot(): Promise<string> {
  const response = await chrome.runtime.sendMessage({ type: 'take_screenshot' });
  if (!response || !response.screenshot) {
    throw new Error(response?.error ?? 'Screenshot capture failed: no response from background service worker.');
  }
  return response.screenshot as string;
}
