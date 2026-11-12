import type { Lang, WorkMode, Order } from '@types/parts';
import { useT } from '@lib/i18n';
import { CONFIG } from '@lib/constants';
import Card from '@components/ui/Card';
import Plate from '@components/ui/Plate';
import PillButton from '@components/ui/PillButton';

interface Props {
  lang: Lang;
  workMode: WorkMode;
  order: Order | null;
  /** Plate of the finished order/vehicle (snapshot taken before the session is cleared) */
  plate?: string;
  /** Parts sent in the finished session (snapshot) */
  sentCount?: number;
  onNewQuote: () => void;
}

export default function FinishState({ lang, workMode, order, plate, sentCount = 0, onNewQuote }: Props) {
  const t = useT(lang);
  const dashUrl = workMode === 'order' && order
    ? `${CONFIG.BUBBLE_BASE_URL}/dash/autoflex//sourced-parts?work-order-id=${order.id}`
    : workMode === 'order'
      ? `${CONFIG.BUBBLE_BASE_URL}/dash/autoflex`
      : `${CONFIG.BUBBLE_BASE_URL}/dash/parts`;

  return (
    <div className="flex flex-col h-full gap-2 bg-pq-page p-2.5">
      <Card className="shrink-0 flex-row items-center gap-2">
        <span className="text-base font-bold text-black">Parts iQ</span>
        <span className="flex-1" />
        <Plate plate={plate} />
      </Card>

      <Card className="items-center gap-2.5 px-4 py-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pq-ok-bg text-2xl text-pq-teal">✓</div>
        <p className="text-base font-bold text-black">{t.searchFinished}</p>
        {sentCount > 0 && <p className="text-[13px] font-medium text-pq-muted">{t.partsSent(sentCount)}</p>}
        <PillButton variant="primary" onClick={onNewQuote} className="w-full py-2">
          {t.newQuote}
        </PillButton>
        <button
          onClick={() => { void chrome.tabs.update({ url: dashUrl }).catch(() => {}); }}
          className="text-[13px] font-medium text-pq-teal hover:underline"
        >
          {t.checkStatus}
        </button>
      </Card>
    </div>
  );
}
