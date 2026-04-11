import type { Lang } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  error: string | null;
  onRetry: () => void;
}

export default function ScanningState({ lang, error, onRetry }: Props) {
  const t = useT(lang);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
        <p className="text-sm text-red-600">{t.scanError}</p>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={onRetry}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-600">{t.scanning}</p>
    </div>
  );
}
