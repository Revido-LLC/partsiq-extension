import type { ReactNode } from 'react';

const TONES = {
  purple: 'bg-pq-tag text-pq-ink',
  green: 'bg-pq-ok-bg text-pq-ok',
  amber: 'bg-pq-warn-bg text-pq-warn',
  neutral: 'bg-pq-page text-pq-muted',
} as const;

/** Small rounded label (status, savings, sent…). */
export default function Tag({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-2xl px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
