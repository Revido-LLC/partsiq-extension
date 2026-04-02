import { useEffect } from 'react';
import type { BubbleMessage } from '@types/parts';
import { CONFIG } from '@lib/constants';

/**
 * Builds a Bubble embeddable page URL with optional query parameters.
 */
export function buildBubbleUrl(
  page: 'login' | 'parts' | 'session',
  params?: Record<string, string>
): string {
  const base = CONFIG.BUBBLE_BASE_URL + CONFIG.BUBBLE_PAGES[page];
  if (!params || Object.keys(params).length === 0) return base;

  const searchParams = new URLSearchParams(params);
  return `${base}?${searchParams.toString()}`;
}

/**
 * Sends a message to the Bubble iframe via postMessage.
 * Always targets the specific Bubble origin for security.
 */
export function sendToIframe(
  iframe: HTMLIFrameElement,
  message: { type: string; [key: string]: unknown }
): void {
  iframe.contentWindow?.postMessage(message, CONFIG.BUBBLE_BASE_URL);
}

/**
 * React hook for listening to postMessage events from the Bubble iframe.
 * Validates origin before invoking callback.
 */
export function useBubbleMessages(
  onMessage: (msg: BubbleMessage) => void
): void {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== CONFIG.BUBBLE_BASE_URL) return;
      onMessage(event.data as BubbleMessage);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);
}
