import { T, type Lang } from '@lib/translations';

interface Props {
  totalCount: number;
  selectedCount: number;
  sentCount: number;
  isScanning: boolean;
  lang: Lang;
  onRescan: () => void;
  onClear: () => void;
  onFinish: () => void;
}

const CartFooter = ({ totalCount, selectedCount, sentCount, isScanning, lang, onRescan, onClear, onFinish }: Props) => {
  const t = T[lang];
  return (
    <div className="px-4 py-2.5 flex flex-col gap-2">
      {/* Stats row */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-800">
          {selectedCount} {t.selected}
          {sentCount > 0 && (
            <span className="text-green-600 ml-1">· {sentCount} {t.sentCount}</span>
          )}
        </span>
        {totalCount > 0 && (
          <span className="text-[10px] text-gray-400">· {totalCount} {t.partsInCart}</span>
        )}
      </div>

      {/* Buttons row */}
      <div className="flex items-center justify-end gap-2">
        {totalCount > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded transition-colors"
          >
            {t.clear}
          </button>
        )}
        <button
          onClick={onRescan}
          disabled={isScanning}
          className="flex items-center gap-1.5 min-h-[45px] px-4 py-2.5 bg-white border border-black text-black text-sm font-normal rounded-[100px] transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <>
              <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
              {t.scanning}
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t.rescan}
            </>
          )}
        </button>
        <button
          onClick={onFinish}
          disabled={isScanning}
          className="flex items-center gap-1.5 min-h-[45px] px-4 py-2.5 bg-[#00C6B2] text-[#473150] text-sm font-semibold rounded-full transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.finish}
        </button>
      </div>
    </div>
  );
};

export default CartFooter;
