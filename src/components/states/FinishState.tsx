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
      <div className="text-3xl">✓</div>
      <p className="text-sm font-medium text-gray-800">{t.searchFinished}</p>
      <p className="text-xs text-gray-500">{t.checkStatus}</p>
      <button
        onClick={onNewQuote}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        {t.newQuote}
      </button>
    </div>
  );
}
