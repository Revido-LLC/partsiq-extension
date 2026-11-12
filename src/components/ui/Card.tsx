import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Tighter padding (footer bars). A className padding would lose to the base one in the CSS order. */
  compact?: boolean;
}

/** White rounded box — the building block of every side panel screen (WO panel style). */
export default function Card({ className = '', compact = false, ...props }: Props) {
  const padding = compact ? 'px-2 py-2' : 'px-3 py-2.5';
  return (
    <div
      {...props}
      className={`bg-white border border-pq-line rounded-lg ${padding} flex flex-col gap-1.5 ${className}`}
    />
  );
}
