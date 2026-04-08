import { useState, useRef, useEffect } from 'react';
import type { CartItem, CartItemStatus } from '@types/parts';
import { T, type Lang } from '@lib/translations';

interface Props {
  item: CartItem;
  lang: Lang;
  onToggle: (id: string) => void;
  onRetry: (id: string) => void;
  onUpdateOem: (id: string, oemNumber: string) => void;
}

const STATUS_CLASS: Record<CartItemStatus, string> = {
  pending: 'bg-gray-100 text-gray-500',
  sending: 'bg-blue-100 text-blue-600 animate-pulse',
  sent:    'bg-green-100 text-green-700',
  error:   'bg-red-100 text-red-600',
};

const CartPartCard = ({ item, lang, onToggle, onRetry, onUpdateOem }: Props) => {
  const { part, status, checked, id, errorMessage } = item;
  const hasOem = Boolean(part.oemNumber && part.oemNumber.trim() !== '');
  const t = T[lang];
  const [editingOem, setEditingOem] = useState(false);
  const [oemDraft, setOemDraft] = useState(part.oemNumber ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingOem) inputRef.current?.focus();
  }, [editingOem]);

  const commitOem = () => {
    onUpdateOem(id, oemDraft.trim());
    setEditingOem(false);
  };

  const handleOemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitOem();
    if (e.key === 'Escape') { setOemDraft(part.oemNumber ?? ''); setEditingOem(false); }
  };

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 transition-colors ${
      checked ? 'bg-white' : 'bg-gray-50 opacity-60'
    }`}>
      {/* Checkbox — disabled when no OEM */}
      <div className="relative group/oemtip pt-0.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={status === 'sending' || !hasOem}
          onChange={() => onToggle(id)}
          className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40${!hasOem ? ' pointer-events-none' : ''}`}
        />
        {!hasOem && (
          <>
            <div className="absolute inset-0 cursor-not-allowed" />
            <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/oemtip:block bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-20">
              Add an OEM number to select this part
            </div>
          </>
        )}
      </div>

      {/* Part info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate leading-tight">
            {part.partName}
          </p>
          <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_CLASS[status]}`}>
            {t[status]}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {editingOem ? (
            <input
              ref={inputRef}
              type="text"
              value={oemDraft}
              onChange={e => setOemDraft(e.target.value)}
              onKeyDown={handleOemKeyDown}
              onBlur={commitOem}
              className="text-xs font-mono px-1.5 py-0.5 border border-blue-400 rounded bg-white focus:outline-none w-32"
            />
          ) : (
            <button
              onClick={() => { setOemDraft(part.oemNumber ?? ''); setEditingOem(true); }}
              className="group flex items-center gap-1"
              title="Edit OEM number"
            >
              {part.oemNumber ? (
                <span className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">OEM:</span>
                  <span className="text-xs text-gray-500 font-mono group-hover:text-blue-600 transition-colors">{part.oemNumber}</span>
                </span>
              ) : (
                <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded group-hover:bg-orange-100 transition-colors">
                  {t.noOem}
                </span>
              )}
              <svg className="w-4 h-4 text-[#525252] group-hover:text-[#000000] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          )}

          {part.netPrice != null && (
            <span className="text-xs text-gray-500">€{part.netPrice.toFixed(2)}</span>
          )}
          {part.deliveryTime && (
            <span className="text-xs text-gray-400">{part.deliveryTime}</span>
          )}
          {part.confidence != null && part.confidence < 0.7 && (
            <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded">
              {t.lowConfidence}
            </span>
          )}
        </div>

        {status === 'error' && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-red-500 truncate">{errorMessage}</span>
            <button
              onClick={() => onRetry(id)}
              className="text-[10px] text-blue-600 hover:underline flex-shrink-0"
            >
              {t.retry}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPartCard;
