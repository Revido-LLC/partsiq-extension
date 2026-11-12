import type { HTMLAttributes } from 'react';

/** White rounded box — the building block of every side panel screen (WO panel style). */
export default function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`bg-white border border-pq-line rounded-lg px-3 py-2.5 flex flex-col gap-1.5 ${className}`}
    />
  );
}
