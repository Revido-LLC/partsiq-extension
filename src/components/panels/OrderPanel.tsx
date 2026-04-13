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
      <div className="flex flex-col h-full">
        <iframe
          src={buildBubbleUrl('extension')}
          className="flex-1 w-full border-0"
          title="Select order"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-[#E6E6E6] shrink-0">
      <span className="font-medium text-sm text-[#525252]">
        {order?.plate || order?.id || '—'}
      </span>
      <button
        onClick={onExpand}
        className="text-xs text-[#00C6B2] font-medium hover:underline ml-2"
      >
        {t.changeOrder}
      </button>
    </div>
  );
}
