import type { Lang, Order } from '@types/parts';
import { useT } from '@lib/i18n';
import { buildBubbleUrl } from '@lib/iframe';

interface Props {
  order: Order | null;
  expanded: boolean;
  lang: Lang;
  onExpand: () => void;
}

export default function OrderPanel({ order, expanded, lang, onExpand }: Props) {
  const t = useT(lang);

  if (expanded) {
    return (
      <div className="flex flex-col" style={{ height: '100%' }}>
        <iframe
          src={buildBubbleUrl('extension')}
          className="flex-1 w-full border-0"
          title="Select order"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
      <span className="font-medium text-sm text-gray-800">
        {order?.plate || order?.id || '—'}
      </span>
      <button
        onClick={onExpand}
        className="text-xs text-blue-600 hover:underline ml-2"
      >
        {t.changeOrder}
      </button>
    </div>
  );
}
