// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { buildBubbleUrl, useBubbleMessages } from '@lib/iframe';
import { CONFIG } from '@lib/constants';
import type { BubbleMessage } from '@types/parts';

// ── buildBubbleUrl ──────────────────────────────────────────────────────────

describe('buildBubbleUrl', () => {
  describe('login page', () => {
    it('returns the login path appended to the base URL', () => {
      const url = buildBubbleUrl('login');
      expect(url).toBe(
        `${CONFIG.BUBBLE_BASE_URL}${CONFIG.BUBBLE_PAGES.login}?source=extension`,
      );
    });

    it('appends ?source=extension query param', () => {
      const url = buildBubbleUrl('login');
      expect(url).toContain('?source=extension');
    });

    it('starts with the configured base URL', () => {
      expect(buildBubbleUrl('login')).toMatch(
        new RegExp(`^${CONFIG.BUBBLE_BASE_URL}`),
      );
    });
  });

  describe('extension page', () => {
    it('returns the extension path appended to the base URL', () => {
      const url = buildBubbleUrl('extension');
      expect(url).toBe(
        `${CONFIG.BUBBLE_BASE_URL}${CONFIG.BUBBLE_PAGES.extension}`,
      );
    });

    it('does NOT append a query string', () => {
      const url = buildBubbleUrl('extension');
      expect(url).not.toContain('?');
    });

    it('starts with the configured base URL', () => {
      expect(buildBubbleUrl('extension')).toMatch(
        new RegExp(`^${CONFIG.BUBBLE_BASE_URL}`),
      );
    });
  });

  describe('concrete expected values', () => {
    it('login URL equals the fully resolved string', () => {
      expect(buildBubbleUrl('login')).toBe(
        `${CONFIG.BUBBLE_BASE_URL}${CONFIG.BUBBLE_PAGES.login}?source=extension`,
      );
    });

    it('extension URL equals the fully resolved string', () => {
      expect(buildBubbleUrl('extension')).toBe(
        `${CONFIG.BUBBLE_BASE_URL}${CONFIG.BUBBLE_PAGES.extension}`,
      );
    });

    it('login and extension URLs are distinct', () => {
      expect(buildBubbleUrl('login')).not.toBe(buildBubbleUrl('extension'));
    });
  });
});

// ── useBubbleMessages ───────────────────────────────────────────────────────

function dispatchMessage(origin: string, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { origin, data }));
  });
}

describe('useBubbleMessages', () => {
  let onMessage: ReturnType<typeof vi.fn<(msg: BubbleMessage) => void>>;

  beforeEach(() => {
    onMessage = vi.fn<(msg: BubbleMessage) => void>();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('message origin filtering', () => {
    it('calls onMessage when the origin matches BUBBLE_ORIGIN', () => {
      renderHook(() => useBubbleMessages(onMessage));

      const msg: BubbleMessage = { type: 'switch_to_vehicle' };
      dispatchMessage(CONFIG.BUBBLE_ORIGIN, msg);

      expect(onMessage).toHaveBeenCalledOnce();
      expect(onMessage).toHaveBeenCalledWith(msg);
    });

    it('ignores messages from a different origin', () => {
      renderHook(() => useBubbleMessages(onMessage));

      dispatchMessage('https://evil.example.com', { type: 'phishing' });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('ignores messages from an empty-string origin', () => {
      renderHook(() => useBubbleMessages(onMessage));

      dispatchMessage('', { type: 'any' });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('ignores messages from a subdomain of BUBBLE_ORIGIN', () => {
      renderHook(() => useBubbleMessages(onMessage));

      dispatchMessage('https://sub.app.parts-iq.com', { type: 'any' });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('ignores messages where origin is only a prefix of BUBBLE_ORIGIN', () => {
      renderHook(() => useBubbleMessages(onMessage));

      dispatchMessage('https://app.parts-iq.co', { type: 'any' });

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe('message data forwarding', () => {
    it('passes the raw event.data to onMessage', () => {
      renderHook(() => useBubbleMessages(onMessage));

      const payload: BubbleMessage = { type: 'auth_ok', userId: 'u-123' };
      dispatchMessage(CONFIG.BUBBLE_ORIGIN, payload);

      expect(onMessage).toHaveBeenCalledWith(payload);
    });

    it('handles multiple consecutive messages', () => {
      renderHook(() => useBubbleMessages(onMessage));

      dispatchMessage(CONFIG.BUBBLE_ORIGIN, { type: 'first' });
      dispatchMessage(CONFIG.BUBBLE_ORIGIN, { type: 'second' });
      dispatchMessage(CONFIG.BUBBLE_ORIGIN, { type: 'third' });

      expect(onMessage).toHaveBeenCalledTimes(3);
    });

    it('skips non-matching messages interspersed with matching ones', () => {
      renderHook(() => useBubbleMessages(onMessage));

      dispatchMessage(CONFIG.BUBBLE_ORIGIN, { type: 'ok' });
      dispatchMessage('https://other.com', { type: 'nope' });
      dispatchMessage(CONFIG.BUBBLE_ORIGIN, { type: 'also_ok' });

      expect(onMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('listener lifecycle', () => {
    it('removes the message listener on unmount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useBubbleMessages(onMessage));
      unmount();

      // The same handler reference that was added should be removed
      expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('does not call onMessage after unmount', () => {
      const { unmount } = renderHook(() => useBubbleMessages(onMessage));
      unmount();

      dispatchMessage(CONFIG.BUBBLE_ORIGIN, { type: 'late' });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('does not re-register the listener when onMessage reference changes', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      const { rerender } = renderHook(
        ({ cb }: { cb: (msg: BubbleMessage) => void }) =>
          useBubbleMessages(cb),
        { initialProps: { cb: onMessage } },
      );

      const callCountAfterMount = addSpy.mock.calls.filter(
        ([event]) => event === 'message',
      ).length;

      rerender({ cb: vi.fn() });

      const callCountAfterRerender = addSpy.mock.calls.filter(
        ([event]) => event === 'message',
      ).length;

      // No additional listener added when only the callback prop changes
      expect(callCountAfterRerender).toBe(callCountAfterMount);
    });

    it('always invokes the latest onMessage callback without re-subscribing', () => {
      const firstCb = vi.fn();
      const secondCb = vi.fn();

      const { rerender } = renderHook(
        ({ cb }: { cb: (msg: BubbleMessage) => void }) =>
          useBubbleMessages(cb),
        { initialProps: { cb: firstCb } },
      );

      rerender({ cb: secondCb });

      dispatchMessage(CONFIG.BUBBLE_ORIGIN, { type: 'ping' });

      expect(secondCb).toHaveBeenCalledOnce();
      expect(firstCb).not.toHaveBeenCalled();
    });
  });
});
