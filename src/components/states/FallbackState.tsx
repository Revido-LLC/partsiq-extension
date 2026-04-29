import { useState } from 'react';
import type { Lang, CartItem } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  cart: CartItem[];
  onAddManual: (item: CartItem) => void;
  onCrop: () => void;
  onScan: () => void;
  onClear: () => void;
}

export default function FallbackState({ lang, cart, onAddManual, onCrop, onScan, onClear }: Props) {
  const t = useT(lang);
  const [showManualForm, setShowManualForm] = useState(false);

  const sentItems = cart.filter(i => i.status === 'sent' || i.status === 'sending');

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = (data.get('name') as string).trim();
    const oem = (data.get('oem') as string).trim();
    if (!name) return;
    const item: CartItem = {
      id: crypto.randomUUID(),
      name,
      oem,
      price: null,
      deliveryDays: null,
      stock: null,
      supplier: '',
      sourceUrl: '',
      scannedAt: new Date().toISOString(),
      status: 'pending',
      checked: false,
    };
    onAddManual(item);
    setShowManualForm(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F0F0]">
      {/* Scan / Crop buttons */}
      <div className="flex gap-2 px-3 py-2 border-b border-[#E6E6E6] shrink-0">
        <button
          onClick={onCrop}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 3 6 6 3 6"/>
            <polyline points="18 3 18 6 21 6"/>
            <polyline points="6 21 6 18 3 18"/>
            <polyline points="18 21 18 18 21 18"/>
            <rect x="6" y="6" width="12" height="12" rx="1"/>
          </svg>
          {t.crop}
        </button>
        <button
          onClick={onScan}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E6E6E6] text-black text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          {t.scan}
        </button>
        <button
          onClick={onClear}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-[#E6E6E6] text-[#525252] text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          {t.clear}
        </button>
      </div>

      {/* No parts found message */}
      <div className="px-3 py-2.5 border-b border-[#E6E6E6]">
        <p className="text-xs text-[#525252] opacity-60">{t.noPartsFound}</p>
      </div>

      {/* Previously sent items */}
      {sentItems.length > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-hidden">
          {sentItems.map(item => (
            <div key={item.id} className="border-b border-[#E6E6E6] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="mt-0.5 accent-[#00C6B2]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-[#525252] truncate flex-1">{item.name}</span>
                    <span className="text-xs text-[#00C6B2] font-medium shrink-0">{t.sent}</span>
                  </div>
                  {item.oem && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-[#525252] opacity-60">{t.partNumber}:</span>
                      <span className="text-xs text-[#525252] truncate">{item.oem}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual add */}
      <div className="px-3 py-2 border-b border-[#E6E6E6]">
        {showManualForm ? (
          <form onSubmit={handleAdd} className="flex flex-col gap-1.5">
            <input
              name="name"
              placeholder={t.partName}
              className="border border-[#E6E6E6] rounded-full px-3 py-1.5 text-xs w-full text-[#525252] outline-none focus:border-[#00C6B2] transition-colors"
              required
            />
            <input
              name="oem"
              placeholder={t.partNumberLabel}
              className="border border-[#E6E6E6] rounded-full px-3 py-1.5 text-xs w-full text-[#525252] outline-none focus:border-[#00C6B2] transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="flex-1 px-3 py-1.5 bg-white border border-[#E6E6E6] text-[#525252] text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
              >
                {t.addPart}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowManualForm(true)}
            className="text-xs text-[#00C6B2] font-medium hover:underline"
          >
            {t.addManually}
          </button>
        )}
      </div>
    </div>
  );
}
