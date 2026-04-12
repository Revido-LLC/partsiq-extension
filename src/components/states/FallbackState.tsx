import type { Lang, CartItem } from '@types/parts';
import { useT } from '@lib/i18n';

interface Props {
  lang: Lang;
  onAddManual: (item: CartItem) => void;
  onCrop: () => void;
  onScan: () => void;
}

export default function FallbackState({ lang, onAddManual, onCrop, onScan }: Props) {
  const t = useT(lang);

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
    e.currentTarget.reset();
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <p className="text-sm text-gray-700">{t.noPartsFound}</p>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <input
          name="name"
          placeholder={t.partName}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
          required
        />
        <input
          name="oem"
          placeholder={t.partNumberLabel}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          {t.addPart}
        </button>
      </form>

      <button
        onClick={onScan}
        className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
      >
        📷 {t.scan}
      </button>

      <button
        onClick={onCrop}
        className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
      >
        ✂️ {t.tryWithCrop}
      </button>
    </div>
  );
}
