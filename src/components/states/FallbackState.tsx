import { useState } from 'react';
import type { Lang, CartItem } from '@types/parts';
import { useT } from '@lib/i18n';
import Card from '@components/ui/Card';
import PillButton from '@components/ui/PillButton';
import Tag from '@components/ui/Tag';

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

  const pillInput = 'border border-pq-line rounded-full px-3.5 py-1.5 text-[13px] w-full text-pq-muted bg-white outline-none focus:border-pq-teal transition-colors';

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Scan / Crop buttons + no parts found */}
      <Card className="shrink-0">
        <span className="text-sm font-semibold text-black">{t.addFromSupplierTitle}</span>
        <span className="text-[13px] font-medium text-pq-muted">{t.noPartsFound}</span>
        <div className="flex gap-2 pt-0.5">
          <PillButton variant="primary" onClick={onCrop} className="flex-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 3 6 6 3 6"/>
              <polyline points="18 3 18 6 21 6"/>
              <polyline points="6 21 6 18 3 18"/>
              <polyline points="18 21 18 18 21 18"/>
              <rect x="6" y="6" width="12" height="12" rx="1"/>
            </svg>
            {t.crop}
          </PillButton>
          <PillButton variant="secondary" onClick={onScan} className="flex-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            {t.scan}
          </PillButton>
        </div>
      </Card>

      {/* Previously sent items */}
      {sentItems.length > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-hidden flex flex-col gap-2">
          {sentItems.map(item => (
            <Card key={item.id} className="shrink-0">
              <div className="flex items-start gap-2">
                <input type="checkbox" checked readOnly className="mt-1 accent-pq-teal" />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-black truncate flex-1">{item.name}</span>
                    <Tag tone="purple">{t.sent}</Tag>
                  </div>
                  {item.oem && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-pq-muted opacity-70">{t.partNumber}:</span>
                      <span className="text-xs font-medium text-pq-muted truncate">{item.oem}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Manual add */}
      {showManualForm ? (
        <Card className="shrink-0">
          <form onSubmit={handleAdd} className="flex flex-col gap-1.5">
            <input name="name" placeholder={t.partName} className={pillInput} required />
            <input name="oem" placeholder={t.partNumberLabel} className={pillInput} />
            <div className="flex gap-2">
              <PillButton variant="secondary" onClick={() => setShowManualForm(false)} className="flex-1">
                {t.cancel}
              </PillButton>
              <PillButton variant="primary" type="submit" className="flex-1">
                {t.addPart}
              </PillButton>
            </div>
          </form>
        </Card>
      ) : (
        <button
          onClick={() => setShowManualForm(true)}
          className="self-start px-1 text-[13px] text-pq-teal font-medium hover:underline"
        >
          {t.addManually}
        </button>
      )}
    </div>
  );
}
