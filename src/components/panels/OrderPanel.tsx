import type { Lang, Order } from '@types/parts';
import { useT } from '@lib/i18n';
import { buildBubbleUrl } from '@lib/iframe';

interface Props {
  order: Order | null;
  expanded: boolean;
  lang: Lang;
  iframeReady: boolean;
  onExpand: () => void;
}

export default function OrderPanel({ order, expanded, lang, iframeReady, onExpand }: Props) {
  const t = useT(lang);

  if (expanded) {
    return (
      <div className="relative flex flex-col h-full px-[10px]">
        <iframe
          src={buildBubbleUrl('extension')}
          className="flex-1 w-full border-0"
          title="Select order"
        />
        {!iframeReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="w-8 h-8 border-4 border-[#B3EEE6] border-t-[#00C6B2] rounded-full animate-spin" />
          </div>
        )}
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
