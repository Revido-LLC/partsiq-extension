import { useEffect, useRef } from 'react';
import type { BubbleMessage } from '@types/parts';
import { CONFIG } from '@lib/constants';

export function buildBubbleUrl(page: 'login' | 'extension'): string {
  return CONFIG.BUBBLE_BASE_URL + CONFIG.BUBBLE_PAGES[page];
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
