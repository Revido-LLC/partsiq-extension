// Crop follows the active tab: after "Crop" the user may switch to any supplier tab and
// select the area there. This decides which tabs get the crop overlay.
import { isAutoflexUrl } from '@lib/autoflex';

/** True for pages where the crop overlay is shown (not Autoflex, not browser/store pages). */
export function canCropOn(url: string | undefined): boolean {
  if (!url) return false;
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.hostname === 'chromewebstore.google.com' || u.hostname === 'chrome.google.com') return false;
  return !isAutoflexUrl(url);
}

export type SupplierNotice = 'cropWaiting' | 'scanNeedsSupplier';

/**
 * What the panel says when Crop/Scan is clicked on a page that is not a supplier page
 * (Autoflex, browser pages). Crop stays armed and appears on the next supplier tab;
 * Scan does nothing, otherwise it would read the work order itself as parts.
 */
export function supplierNoticeFor(action: 'crop' | 'scan', url: string | undefined): SupplierNotice | null {
  if (canCropOn(url)) return null;
  return action === 'crop' ? 'cropWaiting' : 'scanNeedsSupplier';
}
