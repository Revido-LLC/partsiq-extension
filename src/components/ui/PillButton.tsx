import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary';
}

const VARIANTS = {
  primary: 'bg-pq-teal border-pq-teal hover:opacity-90',
  secondary: 'bg-white border-pq-line hover:bg-pq-page',
} as const;

/** Pill button with the WO panel's teal (primary) or white (secondary) look. */
export default function PillButton({ variant, className = '', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-semibold text-pq-ink transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}
