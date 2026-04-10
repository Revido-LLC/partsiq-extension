import { useEffect, useRef } from 'react';
import type { Lang } from '@lib/translations';
import { CONFIG } from '@lib/constants';
import { buildBubbleUrl } from '@lib/iframe';

/**
 * Silently verifies the Bubble session by mounting a hidden iframe to /auth/.
 * - On login_success: calls onSuccess with updated lang + autoflexConnected
 * - On login_required/failed: calls onExpired
 * - On timeout (5s): does nothing — assumes session is still valid
 *
 * Only runs when trigger > 0. Increment trigger to re-run the check.
 */
export function useSilentAuth(
  trigger: number,
  onSuccess: (lang?: Lang, autoflexConnected?: boolean) => void,
  onExpired: () => void,
): void {
  const onSuccessRef = useRef(onSuccess);
  const onExpiredRef = useRef(onExpired);
  onSuccessRef.current = onSuccess;
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (trigger === 0) return;

    const bubbleOrigin = new URL(CONFIG.BUBBLE_BASE_URL).origin;
    let settled = false;

    const iframe = document.createElement('iframe');
    iframe.src = buildBubbleUrl('login', { source: 'extension' });
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    document.body.appendChild(iframe);

    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      iframe.remove();
    };

    // Timeout: no response in 5s → session assumed valid, do nothing
    const timer = setTimeout(settle, 5000);

    const handler = (event: MessageEvent) => {
      if (event.origin !== bubbleOrigin || settled) return;
      const msg = event.data;
      if (!msg?.type) return;

      if (msg.type === 'partsiq:login_success') {
        const raw = msg.language;
        const lang: Lang | undefined = raw === 'en' || raw === 'nl' ? raw : undefined;
        const autoflexConnected = msg.autoflex_connected === true;
        settle();
        onSuccessRef.current(lang, autoflexConnected);
      } else if (msg.type === 'partsiq:login_required' || msg.type === 'partsiq:login_failed') {
        settle();
        onExpiredRef.current();
      }
    };

    window.addEventListener('message', handler);
    return settle;
  }, [trigger]);
}
