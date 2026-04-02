/**
 * Requests a screenshot from the background service worker.
 * Must be called from popup context (not content script).
 * Returns base64 data URL (JPEG).
 */
export async function captureScreenshot(): Promise<string> {
  const response = await chrome.runtime.sendMessage({ type: 'take_screenshot' });
  return response.screenshot as string;
}
