import type { StatusChipVariant } from '@types/parts';

interface Props {
  variant: StatusChipVariant;
}

const VARIANT_STYLES: Record<StatusChipVariant, string> = {
  idle: 'bg-gray-100 text-gray-600',
  scanning: 'bg-blue-100 text-blue-700 animate-pulse',
  found: 'bg-green-100 text-green-700',
  added: 'bg-teal-100 text-teal-700',
  error: 'bg-red-100 text-red-700',
};

const VARIANT_LABELS: Record<StatusChipVariant, string> = {
  idle: 'IDLE',
  scanning: 'SCANNING',
  found: 'FOUND',
  added: 'ADDED',
  error: 'ERROR',
};

const StatusChip = ({ variant }: Props) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${VARIANT_STYLES[variant]}`}>
      {VARIANT_LABELS[variant]}
    </span>
  );
};

export default StatusChip;
