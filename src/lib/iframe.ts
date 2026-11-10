import { useEffect, useRef } from 'react';
import type { BubbleMessage } from '@types/parts';
import { CONFIG } from '@lib/constants';

export type BubblePage = keyof typeof CONFIG.BUBBLE_PAGES;

export function buildBubbleUrl(
  page: BubblePage,
  params: Record<string, string | undefined> = {},
): string {
  const url = CONFIG.BUBBLE_BASE_URL + CONFIG.BUBBLE_PAGES[page];
  const query = new URLSearchParams();
  if (page === 'login') query.set('source', 'extension');
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${url}?${qs}` : url;
}

export function useBubbleMessages(
  onMessage: (msg: BubbleMessage) => void
): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== CONFIG.BUBBLE_ORIGIN) return;
      onMessageRef.current(event.data as BubbleMessage);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
}
