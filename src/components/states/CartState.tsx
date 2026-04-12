import { useState } from 'react';
import type { Lang, CartItem, Vehicle, Order, WorkMode } from '@types/parts';
import { useT } from '@lib/i18n';
import { CONFIG } from '@lib/constants';

interface Props {
  lang: Lang;
  cart: CartItem[];
  vehicle: Vehicle | null;
  order: Order | null;
  workMode: WorkMode;
  pendingUrl: string | null;
  onScan: () => void;
  onCrop: () => void;
  onUpdateCart: (items: CartItem[]) => Promise<void>;
  onFinish: () => void;
  onDismissBanner: () => void;
}

export default function CartState({
  lang, cart, vehicle, order, workMode,
  pendingUrl, onScan, onCrop, onUpdateCart, onFinish, onDismissBanner,
}: Props) {
  const t = useT(lang);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);

  const updateItem = async (id: string, patch: Partial<CartItem>) => {
    const updated = cart.map(item => item.id === id ? { ...item, ...patch } : item);
    await onUpdateCart(updated);
  };

  const removeItem = async (id: string) => {
    await onUpdateCart(cart.filter(item => item.id !== id));
  };

  const handleCheck = async (item: CartItem) => {
    if (item.status === 'sending') return;

    if (item.status === 'sent') {
      // Unsend
      await updateItem(item.id, { status: 'sending' });
      try {
        await fetch(CONFIG.BUBBLE_API.REMOVE_PART, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bubble_part_id: item.bubblePartId }),
        });
        await updateItem(item.id, { status: 'pending', checked: false, bubblePartId: undefined });
      } catch (err) {
        await updateItem(item.id, { status: 'sent', errorMsg: String(err) });
      }
      return;
    }

    if (item.status === 'pending' || item.status === 'error') {
      if (!item.oem.trim()) return; // checkbox disabled without oem
      await updateItem(item.id, { status: 'sending' });
      try {
        const body: Record<string, unknown> = {
          name: item.name,
          oem: item.oem,
          price: item.price,
          delivery_days: item.deliveryDays,
          stock: item.stock,
          supplier: item.supplier,
          source_url: item.sourceUrl,
          work_mode: workMode,
        };
        if (workMode === 'vehicle' && vehicle) body.vehicle_id = vehicle.id;
        if (workMode === 'order' && order) body.order_id = order.id;

        const resp = await fetch(CONFIG.BUBBLE_API.SAVE_PART, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        await updateItem(item.id, {
          status: 'sent',
          checked: true,
          bubblePartId: data?.id ?? data?.bubble_part_id,
          errorMsg: undefined,
        });
      } catch (err) {
        await updateItem(item.id, { status: 'error', errorMsg: String(err) });
      }
    }
  };

  const handleOemEdit = (item: CartItem) => {
    if (item.status === 'sent') return;
    setEditingId(item.id);
    setEditValue(item.oem);
  };

  const commitOemEdit = async (id: string) => {
    await updateItem(id, { oem: editValue.trim() });
    setEditingId(null);
  };

  const handleAddManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = (data.get('name') as string).trim();
    const oem = (data.get('oem') as string).trim();
    if (!name) return;
    const newItem: CartItem = {
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
    await onUpdateCart([...cart, newItem]);
    e.currentTarget.reset();
    setShowManualForm(false);
  };

  const handleClearUnsent = async () => {
    const unsent = cart.filter(i => i.status === 'pending' || i.status === 'error');
    if (unsent.length === 0) return;
    const confirmed = window.confirm(t.removeUnsentConfirm(unsent.length));
    if (!confirmed) return;
    await onUpdateCart(cart.filter(i => i.status === 'sent' || i.status === 'sending'));
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL change banner */}
      {pendingUrl && (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs">
          <span className="text-blue-700">{t.pageChanged}</span>
          <div className="flex gap-2 ml-2">
            <button onClick={onScan} className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">
              {t.scan}
            </button>
            <button onClick={onDismissBanner} className="px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {cart.map(item => {
          const disabled = !item.oem.trim() || item.status === 'sending';
          const isSent = item.status === 'sent';
          const isEditing = editingId === item.id;

          return (
            <div key={item.id} className="border-b border-gray-100 px-3 py-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={disabled}
                  onChange={() => handleCheck(item)}
                  className="mt-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                    {item.status === 'sending' && (
                      <span className="text-xs text-gray-400 shrink-0">{t.sending}</span>
                    )}
                    {item.status === 'sent' && (
                      <span className="text-xs text-green-600 shrink-0">{t.sent}</span>
                    )}
                    {!isSent && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-500 shrink-0 text-xs"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* OEM */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-500">{t.partNumber}:</span>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitOemEdit(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitOemEdit(item.id); }}
                        className="text-xs border-b border-blue-400 outline-none flex-1 min-w-0"
                      />
                    ) : (
                      <span className="text-xs text-gray-700 flex-1 truncate">
                        {item.oem || <span className="text-red-400 italic">missing</span>}
                      </span>
                    )}
                    {!isSent && !isEditing && (
                      <button
                        onClick={() => handleOemEdit(item)}
                        className="text-gray-400 hover:text-blue-500 text-xs"
                        title="Edit part number"
                      >
                        ✏️
                      </button>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                    {item.price != null && <span>€{item.price}</span>}
                    {item.deliveryDays != null && <span>{item.deliveryDays}d</span>}
                    {item.supplier && <span className="truncate">{item.supplier}</span>}
                  </div>

                  {item.status === 'error' && item.errorMsg && (
                    <p className="text-xs text-red-500 mt-0.5">{item.errorMsg}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Manual add */}
        <div className="px-3 py-2 border-b border-gray-100">
          {showManualForm ? (
            <form onSubmit={handleAddManual} className="flex flex-col gap-1.5">
              <input
                name="name"
                placeholder={t.partName}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
                required
              />
              <input
                name="oem"
                placeholder={t.partNumberLabel}
                className="border border-gray-300 rounded px-2 py-1 text-xs w-full"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="flex-1 px-2 py-1 border border-gray-300 text-xs rounded hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  {t.addPart}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowManualForm(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              {t.addManually}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-3 py-2 flex flex-col gap-1.5 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={onScan}
            className="flex-1 px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"
          >
            📷 {t.scan}
          </button>
          <button
            onClick={onCrop}
            className="flex-1 px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"
          >
            ✂️ {t.crop}
          </button>
        </div>
        <button
          onClick={handleClearUnsent}
          className="w-full px-2 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50 text-gray-600"
        >
          🗑 {t.clearUnsent}
        </button>
        <button
          onClick={onFinish}
          className="w-full px-2 py-1.5 bg-gray-800 text-white text-xs rounded hover:bg-gray-900"
        >
          {t.finishSearch}
        </button>
      </div>
    </div>
  );
}
