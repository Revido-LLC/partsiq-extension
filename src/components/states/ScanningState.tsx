import type { Lang } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  error: string | null;
  screenshot: string | null;
  onRetry: () => void;
}

export default function ScanningState({ lang, error, screenshot, onRetry }: Props) {
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
    <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
      {screenshot && (
        <div className="w-full rounded overflow-hidden border border-gray-200 relative">
          <img
            src={`data:image/jpeg;base64,${screenshot}`}
            alt="screenshot"
            className="w-full object-cover opacity-80"
            style={{ maxHeight: '180px' }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
      {!screenshot && (
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}
      <p className="text-sm text-gray-600 text-center">{t.analyzing}</p>
    </div>
  );
}
