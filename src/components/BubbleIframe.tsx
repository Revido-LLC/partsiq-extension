import type React from 'react';
import { useRef, useState, useEffect } from 'react';

/**
 * Shared wrapper for all Bubble iframes.
 *
 * Uses ResizeObserver to measure the available CSS-pixel width.
 * If the container is narrower than the Bubble app's comfortable
 * minimum (e.g. because the browser over-scales the side panel),
 * we give the iframe a larger viewport via absolute positioning
 * and then visually scale it back with `transform: scale()`.
 *
 * On standard Chrome at normal width this is a complete no-op.
 * Fully browser-agnostic — no user-agent sniffing.
 */

/** Below this width (CSS px) the Bubble content starts looking cramped. */
const MIN_COMFORTABLE_WIDTH = 370;

interface Props {
  src: string;
  title: string;
  className?: string;
  onLoad?: () => void;
}

export default function BubbleIframe({ src, title, className = '', onLoad }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const next = w >= MIN_COMFORTABLE_WIDTH ? 1 : w / MIN_COMFORTABLE_WIDTH;
      setZoom(prev => (Math.abs(prev - next) > 0.01 ? next : prev));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const needsZoom = zoom < 1;

  // When zoomed: absolute-position the iframe at expanded size, then
  // scale it back visually with transform.
  // When normal: use flex to fill the wrapper reliably (height: 100%
  // can fail when the parent's height comes from flex-grow, not an
  // explicit CSS height property).
  const iframeStyle: React.CSSProperties = needsZoom
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        border: 'none',
        width: `${100 / zoom}%`,
        height: `${100 / zoom}%`,
        transform: `scale(${zoom})`,
        transformOrigin: '0 0',
      }
    : { border: 'none', width: '100%', flex: 1, minHeight: 0 };

  // When zoomed the iframe is position:absolute with percentage height,
  // which requires the containing block to have an explicit height.
  // flex-grow alone doesn't set a computed height, so we add height:100%.
  const wrapperStyle: React.CSSProperties | undefined = needsZoom
    ? { height: '100%' }
    : undefined;

  return (
    <div ref={wrapperRef} className={`relative flex flex-col ${className}`} style={wrapperStyle}>
      <iframe src={src} title={title} onLoad={onLoad} style={iframeStyle} />
    </div>
  );
}
