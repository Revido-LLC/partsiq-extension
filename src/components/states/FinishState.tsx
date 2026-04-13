import type { Lang } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  onNewQuote: () => void;
}

export default function FinishState({ lang, onNewQuote }: Props) {
  const t = useT(lang);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
      <div className="text-3xl text-[#00C6B2]">✓</div>
      <p className="text-sm font-medium text-[#525252]">{t.searchFinished}</p>
      <p className="text-xs text-[#525252] opacity-60">{t.checkStatus}</p>
      <button
        onClick={onNewQuote}
        className="px-6 py-2 bg-[#00C6B2] text-[#473150] text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
      >
        {t.newQuote}
      </button>
    </div>
  );
}
