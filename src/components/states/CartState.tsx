import { useState, useRef, useEffect } from 'react';
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const cartRef = useRef(cart);
  cartRef.current = cart;
  const autoSendTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const sendItemRef = useRef<(item: CartItem) => Promise<void>>(async () => {});

  const updateItem = async (id: string, patch: Partial<CartItem>) => {
    const updated = cartRef.current.map(item => item.id === id ? { ...item, ...patch } : item);
    await onUpdateCart(updated);
  };

  const removeItem = async (id: string) => {
    await onUpdateCart(cart.filter(item => item.id !== id));
  };

  const sendItem = async (item: CartItem) => {
    if (!item.oem.trim()) return;
    await updateItem(item.id, { status: 'sending', autoSend: false });
    try {
      const body: Record<string, unknown> = {
        part_name: item.name,
        oem_number: item.oem,
        net_price: item.price ?? 0,
        gross_price: item.price ?? 0,
        delivery_time: item.deliveryDays != null ? String(item.deliveryDays) : '0',
        stock_available: (item.stock ?? 0) > 0,
        supplier: item.supplier,
        source_url: item.sourceUrl,
        work_mode: workMode,
        autoflex_integration: workMode === 'order' ? 'yes' : 'no',
        confidence: 90,
      };
      if (workMode === 'vehicle' && vehicle) {
        body.vehicle_id = vehicle.id;
        body.vehicle_plate = vehicle.plate;
      }
      if (workMode === 'order' && order) {
        body.order_id = order.id;
        body.vehicle_id = order.id;
        body.vehicle_plate = order.plate;
      }
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
        bubblePartId: data?.response?.id ?? data?.id ?? data?.bubble_part_id,
        errorMsg: undefined,
      });
    } catch (err) {
      await updateItem(item.id, { status: 'error', errorMsg: String(err) });
    }
  };

  sendItemRef.current = sendItem;

  // Auto-send timer: fires 5s after crop auto-check if item remains checked
  useEffect(() => {
    cart.forEach(item => {
      if (item.autoSend && item.checked && item.status === 'pending') {
        if (!autoSendTimers.current.has(item.id)) {
          const timer = setTimeout(() => {
            autoSendTimers.current.delete(item.id);
            const current = cartRef.current.find(i => i.id === item.id);
            if (current && current.checked && current.status === 'pending') {
              void sendItemRef.current(current);
            }
          }, 5000);
          autoSendTimers.current.set(item.id, timer);
        }
      } else {
        const timer = autoSendTimers.current.get(item.id);
        if (timer !== undefined) {
          clearTimeout(timer);
          autoSendTimers.current.delete(item.id);
        }
      }
    });
  }, [cart]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      autoSendTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const handleCheck = async (item: CartItem) => {
    if (item.status === 'sending') return;

    // Auto-send pending: uncheck cancels the timer
    if (item.autoSend && item.checked && autoSendTimers.current.has(item.id)) {
      clearTimeout(autoSendTimers.current.get(item.id)!);
      autoSendTimers.current.delete(item.id);
      await updateItem(item.id, { checked: false, autoSend: false });
      return;
    }

    if (item.status === 'sent') {
      // Unsend
      await updateItem(item.id, { status: 'sending' });
      try {
        const resp = await fetch(CONFIG.BUBBLE_API.REMOVE_PART, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bubble_part_id: item.bubblePartId }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        await updateItem(item.id, { status: 'pending', checked: false, bubblePartId: undefined });
      } catch (err) {
        await updateItem(item.id, { status: 'sent', errorMsg: String(err) });
      }
      return;
    }

    if (item.status === 'pending' || item.status === 'error') {
      if (!item.oem.trim()) return;
      await sendItem(item);
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
    setShowManualForm(false);
    await onUpdateCart([...cart, newItem]);
  };

  const handleClearUnsent = () => {
    const unsent = cart.filter(i => i.status === 'pending' || i.status === 'error');
    if (unsent.length === 0) return;
    setShowClearConfirm(true);
  };

  const handleConfirmClear = async () => {
    setShowClearConfirm(false);
    cart.forEach(i => {
      if (i.status === 'pending' || i.status === 'error') {
        const timer = autoSendTimers.current.get(i.id);
        if (timer !== undefined) {
          clearTimeout(timer);
          autoSendTimers.current.delete(i.id);
        }
      }
    });
    await onUpdateCart(cart.filter(i => i.status === 'sent' || i.status === 'sending'));
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* URL change banner */}
      {pendingUrl && (
        <div className="flex items-center justify-between px-3 py-2 bg-[#F0FDFB] border-b border-[#B3EEE6] text-xs">
          <span className="text-[#473150] font-medium">{t.pageChanged}</span>
          <div className="flex gap-2 ml-2">
            <button onClick={onScan} className="px-3 py-1 bg-[#00C6B2] text-[#473150] font-semibold rounded-full hover:opacity-90 transition-opacity">
              {t.scan}
            </button>
            <button onClick={onDismissBanner} className="px-2 py-1 border border-[#E6E6E6] text-[#525252] rounded-full hover:bg-gray-50 transition-colors">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {cart.map(item => {
          const disabled = !item.oem.trim() || item.status === 'sending';
          const isSent = item.status === 'sent';
          const isEditing = editingId === item.id;

          return (
            <div key={item.id} className="border-b border-[#E6E6E6] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={disabled}
                  onChange={() => handleCheck(item)}
                  className="mt-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed accent-[#00C6B2]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-[#525252] truncate flex-1">{item.name}</span>
                    {item.status === 'sending' && (
                      <span className="text-xs text-[#525252] opacity-50 shrink-0">{t.sending}</span>
                    )}
                    {item.status === 'sent' && (
                      <span className="text-xs text-[#00C6B2] font-medium shrink-0">{t.sent}</span>
                    )}
                  </div>

                  {/* OEM */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-[#525252] opacity-60">{t.partNumber}:</span>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitOemEdit(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitOemEdit(item.id); }}
                        className="text-xs border-b border-[#00C6B2] outline-none flex-1 min-w-0"
                      />
                    ) : (
                      <span className="text-xs text-[#525252] flex-1 truncate">
                        {item.oem || <span className="text-red-400 italic">missing</span>}
                      </span>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex gap-2 mt-0.5 text-xs text-[#525252] opacity-50">
                    {item.price != null && <span>€{item.price}</span>}
                    {item.deliveryDays != null && <span>{item.deliveryDays}d</span>}
                    {item.supplier && <span className="truncate">{item.supplier}</span>}
                  </div>

                  {item.status === 'error' && item.errorMsg && (
                    <p className="text-xs text-red-500 mt-0.5">{item.errorMsg}</p>
                  )}
                </div>

                {/* Action buttons column */}
                {!isSent && (
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-[#00C6B2] hover:opacity-70 transition-opacity"
                      title="Remove"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                    {!isEditing && (
                      <button
                        onClick={() => handleOemEdit(item)}
                        className="text-[#00C6B2] hover:opacity-70 transition-opacity"
                        title="Edit part number"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Manual add */}
        <div className="px-3 py-2 border-b border-[#E6E6E6]">
          {showManualForm ? (
            <form onSubmit={handleAddManual} className="flex flex-col gap-1.5">
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

      {/* Clear confirm dialog */}
      {showClearConfirm && (
        <div className="absolute inset-0 flex items-end justify-center bg-black/20 z-10">
          <div className="w-full bg-white border-t border-[#E6E6E6] px-4 py-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-[#473150] text-center">
              {t.removeUnsentConfirm(cart.filter(i => i.status === 'pending' || i.status === 'error').length)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-3 py-2 bg-white border border-[#E6E6E6] text-[#525252] text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmClear}
                className="flex-1 px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
              >
                {t.clearUnsent}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#E6E6E6] px-3 py-2.5 flex flex-col gap-2 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={onCrop}
            className="flex-1 px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
          >
            {t.crop}
          </button>
          <button
            onClick={onScan}
            className="flex-1 px-3 py-2 bg-white border border-[#E6E6E6] text-black text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
          >
            {t.scan}
          </button>
        </div>
        <button
          onClick={handleClearUnsent}
          className="w-full px-3 py-2 bg-white border border-[#E6E6E6] text-[#525252] text-xs font-normal rounded-full hover:bg-gray-50 transition-colors"
        >
          {t.clearUnsent}
        </button>
        <button
          onClick={onFinish}
          className="w-full px-3 py-2 bg-[#00C6B2] text-[#473150] text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
        >
          {t.finishSearch}
        </button>
      </div>
    </div>
  );
}
