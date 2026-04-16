// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import BubbleIframe from './BubbleIframe';

// ── ResizeObserver mock ────────────────────────────────────────────────────
// NOTE: This mock supports one BubbleIframe per test. If a test renders
// multiple instances, only the last observer callback is reachable via
// simulateWidth.

type ROCallback = (entries: Array<{ contentRect: { width: number } }>) => void;
let lastROCallback: ROCallback | null = null;

class MockResizeObserver {
  constructor(cb: ROCallback) {
    lastROCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    lastROCallback = null;
  }
}

function simulateWidth(width: number) {
  act(() => {
    lastROCallback?.([{ contentRect: { width } }]);
  });
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  lastROCallback = null;
});

function getIframe(container: HTMLElement): HTMLIFrameElement {
  const iframe = container.querySelector('iframe');
  if (!iframe) throw new Error('iframe not found');
  return iframe;
}

function getWrapper(container: HTMLElement): Element {
  const wrapper = container.firstElementChild;
  if (!wrapper) throw new Error('wrapper not found');
  return wrapper;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BubbleIframe', () => {
  // ── Initial render (before ResizeObserver fires) ─────────────────────

  describe('initial render (before measurement)', () => {
    it('renders in no-zoom mode by default (zoom state starts at 1)', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      const iframe = getIframe(container);
      // Before any ResizeObserver callback, zoom=1 → no-zoom path
      expect(iframe.style.position).not.toBe('absolute');
      expect(iframe.style.transform).toBe('');
      expect(iframe.style.width).toBe('100%');
    });
  });

  // ── No zoom when wide enough ──────────────────────────────────────────

  describe('when container >= 370px (no zoom needed)', () => {
    it('uses flex:1 for height instead of height:100% on a 400px panel', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );
      simulateWidth(400);

      const iframe = getIframe(container);
      expect(iframe.style.width).toBe('100%');
      expect(iframe.style.flex).toContain('1');
      expect(iframe.style.minHeight).toBe('0px');
      expect(iframe.style.position).not.toBe('absolute');
      expect(iframe.style.transform).toBe('');
    });

    it('does not zoom at the exact threshold (370px)', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );
      simulateWidth(370);

      const iframe = getIframe(container);
      expect(iframe.style.transform).toBe('');
      expect(iframe.style.flex).toContain('1');
    });

    it('does not zoom on a wide panel (600px)', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );
      simulateWidth(600);

      const iframe = getIframe(container);
      expect(iframe.style.transform).toBe('');
    });
  });

  // ── Zoom applied when narrow ──────────────────────────────────────────

  describe('when container < 370px (zoom correction applied)', () => {
    it('uses transform scale on a 320px panel', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );
      simulateWidth(320);

      const iframe = getIframe(container);
      const expectedZoom = 320 / 370;
      expect(iframe.style.transform).toBe(`scale(${expectedZoom})`);
      expect(iframe.style.transformOrigin).toBe('0 0');
      expect(iframe.style.position).toBe('absolute');
      expect(iframe.style.top).toBe('0px');
      expect(iframe.style.left).toBe('0px');
      // Width/height expand inversely to zoom so visual size = container
      expect(parseFloat(iframe.style.width)).toBeCloseTo(100 / expectedZoom, 1);
      expect(parseFloat(iframe.style.height)).toBeCloseTo(100 / expectedZoom, 1);
    });

    it('applies stronger correction on a 280px panel', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );
      simulateWidth(280);

      const iframe = getIframe(container);
      const expectedZoom = 280 / 370;
      expect(iframe.style.transform).toBe(`scale(${expectedZoom})`);
      expect(parseFloat(iframe.style.width)).toBeCloseTo(100 / expectedZoom, 0);
    });

    it('does not use flex:1 in zoomed mode (uses explicit height instead)', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );
      simulateWidth(300);

      const iframe = getIframe(container);
      expect(iframe.style.flex).toBe('');
      expect(iframe.style.height).toContain('%');
    });
  });

  // ── Dynamic re-measurement ────────────────────────────────────────────

  describe('dynamic resizing', () => {
    it('switches from zoomed to normal when panel widens', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      simulateWidth(300);
      expect(getIframe(container).style.position).toBe('absolute');

      simulateWidth(400);
      expect(getIframe(container).style.position).not.toBe('absolute');
      expect(getIframe(container).style.width).toBe('100%');
      expect(getIframe(container).style.flex).toContain('1');
    });

    it('switches from normal to zoomed when panel narrows', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      simulateWidth(400);
      expect(getIframe(container).style.transform).toBe('');

      simulateWidth(300);
      expect(getIframe(container).style.transform).toContain('scale');
      expect(getIframe(container).style.position).toBe('absolute');
    });

    it('ignores tiny width changes below 0.01 zoom delta (jitter prevention)', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      // 320/370 ≈ 0.86486
      simulateWidth(320);
      const transformBefore = getIframe(container).style.transform;

      // 321/370 ≈ 0.86757 → delta ≈ 0.0027, below 0.01 threshold
      simulateWidth(321);
      expect(getIframe(container).style.transform).toBe(transformBefore);
    });

    it('applies update when width change exceeds 0.01 zoom delta', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      // 320/370 ≈ 0.86486
      simulateWidth(320);
      const transformBefore = getIframe(container).style.transform;

      // 300/370 ≈ 0.81081 → delta ≈ 0.054, above 0.01 threshold
      simulateWidth(300);
      expect(getIframe(container).style.transform).not.toBe(transformBefore);
    });
  });

  // ── Wrapper structure ────────────────────────────────────────────────

  describe('wrapper div', () => {
    it('has relative and flex flex-col classes', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      const wrapper = getWrapper(container);
      expect(wrapper.className).toContain('relative');
      expect(wrapper.className).toContain('flex');
      expect(wrapper.className).toContain('flex-col');
    });

    it('merges custom className with base classes', () => {
      const { container } = render(
        <BubbleIframe
          src="https://example.com"
          title="Test"
          className="flex-1 w-full"
        />,
      );

      const wrapper = getWrapper(container);
      expect(wrapper.className).toContain('relative');
      expect(wrapper.className).toContain('flex-1');
      expect(wrapper.className).toContain('w-full');
    });

    it('does not add padding around the iframe', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      const wrapper = getWrapper(container);
      expect(wrapper.className).not.toContain('px-');
      expect(wrapper.className).not.toContain('py-');
      expect(wrapper.className).not.toContain('p-[');
    });
  });

  // ── Component props ──────────────────────────────────────────────────

  describe('component props', () => {
    it('passes src and title to iframe', () => {
      const { container } = render(
        <BubbleIframe
          src="https://app.parts-iq.com/extension"
          title="Select vehicle"
        />,
      );

      const iframe = getIframe(container);
      expect(iframe.src).toBe('https://app.parts-iq.com/extension');
      expect(iframe.title).toBe('Select vehicle');
    });

    it('calls onLoad when iframe fires load event', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" onLoad={onLoad} />,
      );

      const iframe = getIframe(container);
      iframe.dispatchEvent(new Event('load'));
      expect(onLoad).toHaveBeenCalledOnce();
    });

    it('renders without onLoad (optional prop)', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      const iframe = getIframe(container);
      // Should not throw when load fires without handler
      expect(() => iframe.dispatchEvent(new Event('load'))).not.toThrow();
    });

    it('defaults className to empty string', () => {
      const { container } = render(
        <BubbleIframe src="https://example.com" title="Test" />,
      );

      const wrapper = getWrapper(container);
      // Should have base classes but no user className artifacts
      expect(wrapper.className).toBe('relative flex flex-col ');
    });
  });
});
