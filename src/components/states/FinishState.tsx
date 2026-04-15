import type { Lang, WorkMode } from '@types/parts';
import { useT } from '@lib/i18n';
import { CONFIG } from '@lib/constants';

interface Props {
  lang: Lang;
  workMode: WorkMode;
  onNewQuote: () => void;
}

export default function FinishState({ lang, workMode, onNewQuote }: Props) {
  const t = useT(lang);
  const dashUrl = workMode === 'order'
    ? `${CONFIG.BUBBLE_BASE_URL}/dash/autoflex`
    : `${CONFIG.BUBBLE_BASE_URL}/dash/parts`;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
      <div className="text-3xl text-[#00C6B2]">✓</div>
      <p className="text-sm font-medium text-[#525252]">{t.searchFinished}</p>
      <a
        href={dashUrl}
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2 border border-[#00C6B2] text-[#00C6B2] text-xs font-medium rounded-full hover:bg-[#F0FDFB] transition-colors"
      >
        {t.checkStatus}
      </a>
      <button
        onClick={onNewQuote}
        className="px-6 py-2 bg-[#00C6B2] text-[#473150] text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
      >
        {t.newQuote}
      </button>
    </div>
  );
}
