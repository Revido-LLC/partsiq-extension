import { useState, useRef, useEffect } from 'react';
import type { Lang, CartItem, Vehicle, Order, WorkMode } from '@app-types/parts';
import { useT } from '@lib/i18n';
import { CONFIG } from '@lib/constants';
import Card from '@components/ui/Card';
import PillButton from '@components/ui/PillButton';
import Tag from '@components/ui/Tag';

interface Props {
  lang: Lang;
  cart: CartItem[];
  vehicle: Vehicle | null;
  order: Order | null;
  workMode: WorkMode;
  onScan: () => void;
  onCrop: () => void;
  onUpdateCart: (items: CartItem[]) => Promise<void>;
  onFinish: () => void;
}

export default function CartState({
  lang, cart, vehicle, order, workMode,
  onScan, onCrop, onUpdateCart, onFinish,
}: Props) {
  const t = useT(lang);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const cartRef = useRef(cart);
  cartRef.current = cart;
  const autoSendTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlight = useRef<Map<string, Promise<boolean>>>(new Map());
  const finishingRef = useRef(false);
  const sendItemRef = useRef<(item: CartItem) => Promise<boolean>>(async () => false);

  const clearAutoSendTimer = (id: string) => {
    const timer = autoSendTimers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      autoSendTimers.current.delete(id);
    }
  };

  const updateItem = async (id: string, patch: Partial<CartItem>) => {
    const updated = cartRef.current.map(item => item.id === id ? { ...item, ...patch } : item);
    await onUpdateCart(updated);
  };

  const removeItem = async (id: string) => {
    await onUpdateCart(cart.filter(item => item.id !== id));
  };

  const performSend = async (item: CartItem): Promise<boolean> => {
    try {
      await updateItem(item.id, { status: 'sending', autoSend: false });
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
      return true;
    } catch (err) {
      await updateItem(item.id, { status: 'error', errorMsg: String(err) });
      return false;
    } finally {
      inFlight.current.delete(item.id);
    }
  };

  // Send a part, deduping concurrent sends of the same part: a double-click
  // Finish or the 5s auto-send timer racing a manual flush joins the existing
  // in-flight send and gets its real success/failure, never a false success.
  const sendItem = (item: CartItem): Promise<boolean> => {
    if (!item.oem.trim()) return Promise.resolve(true);
    const existing = inFlight.current.get(item.id);
    if (existing) return existing;
    const promise = performSend(item);
    inFlight.current.set(item.id, promise);
    return promise;
  };

  sendItemRef.current = sendItem;

  // Auto-send timer: fires 5s after crop auto-check if item remains checked
  useEffect(() => {
    cart.forEach(item => {
      if (item.autoSend && item.checked && item.status === 'pending' && !finishingRef.current) {
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
        clearAutoSendTimer(item.id);
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
      clearAutoSendTimer(item.id);
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
          body: JSON.stringify({ part_id: item.bubblePartId }),
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
        clearAutoSendTimer(i.id);
      }
    });
    await onUpdateCart(cart.filter(i => i.status === 'sent' || i.status === 'sending'));
  };

  // Finishing must not drop parts that are still waiting on their 5s auto-send
  // timer — flush them to the platform now instead of losing them on unmount.
  const hasUnsaved = () =>
    cartRef.current.some(
      i => i.checked && (i.status === 'pending' || i.status === 'error') && i.oem.trim(),
    );

  const handleFinish = () => {
    // Re-entrancy guard first, before any early return, so a click during an
    // in-progress flush can't slip through and finish early.
    if (finishingRef.current) return;
    // Nothing to save AND nothing already sending → finish immediately.
    if (!hasUnsaved() && inFlight.current.size === 0) {
      onFinish();
      return;
    }
    finishingRef.current = true;
    // Stop auto-send timers from firing mid-flush; the effect won't re-arm
    // them while finishingRef is set.
    autoSendTimers.current.forEach(t => clearTimeout(t));
    autoSendTimers.current.clear();
    void (async () => {
      try {
        let allSent = true;
        // Wait out sends already in flight (a manual check, or the 5s auto-send
        // timer that beat this click) and honor their real outcome — otherwise
        // finishing here would clear a 'sending' part that then fails.
        if (inFlight.current.size > 0) {
          const results = await Promise.all([...inFlight.current.values()]);
          if (results.some(ok => !ok)) allSent = false;
        }
        // Recompute AFTER draining so a part a timer just sent isn't re-sent.
        // Sequential so each send sees the cart the previous one updated.
        const pending = cartRef.current.filter(
          i => i.checked && (i.status === 'pending' || i.status === 'error') && i.oem.trim(),
        );
        for (const i of pending) {
          const ok = await sendItemRef.current(i);
          if (!ok) allSent = false;
        }
        // Only finish (which clears the cart) once every part is saved, so a
        // failed send stays visible on the cart instead of being lost.
        if (allSent) onFinish();
      } catch {
        // A send threw unexpectedly — stay on the cart so nothing is dropped.
      } finally {
        finishingRef.current = false;
      }
    })();
  };

  const iconBtn = 'flex h-[22px] w-[22px] items-center justify-center rounded-md bg-pq-page text-pq-muted hover:text-pq-ink transition-colors';
  const pillInput = 'border border-pq-line rounded-full px-3.5 py-1.5 text-[13px] w-full text-pq-muted bg-white outline-none focus:border-pq-teal transition-colors';

  return (
    <div className="relative flex flex-col h-full gap-2">
      {/* Scan actions */}
      <Card className="shrink-0">
        <span className="text-sm font-semibold text-black">{t.addFromSupplierTitle}</span>
        <span className="text-[13px] font-medium text-pq-muted">{t.addFromSupplierHint}</span>
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

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden flex flex-col gap-2">
        {cart.map(item => {
          const disabled = !item.oem.trim() || item.status === 'sending';
          const isSent = item.status === 'sent';
          const isEditing = editingId === item.id;

          return (
            <Card key={item.id} className="shrink-0">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={disabled}
                  onChange={() => handleCheck(item)}
                  className="mt-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed accent-pq-teal"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-black truncate flex-1">{item.name}</span>
                    {item.status === 'sending' && <span className="shrink-0"><Tag tone="neutral">{t.sending}</Tag></span>}
                    {item.status === 'sent' && <span className="shrink-0"><Tag tone="purple">{t.sent}</Tag></span>}
                  </div>

                  {/* OEM */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-pq-muted opacity-70">{t.partNumber}:</span>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => commitOemEdit(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitOemEdit(item.id); }}
                        className="text-xs border-b border-pq-teal outline-none flex-1 min-w-0"
                      />
                    ) : (
                      <span className="text-xs font-medium text-pq-muted flex-1 truncate">
                        {item.oem || <span className="text-pq-warn italic">missing</span>}
                      </span>
                    )}
                  </div>

                  {/* Meta: supplier · delivery · price */}
                  <div className="flex items-center gap-1.5 text-xs font-medium text-pq-muted min-w-0">
                    {item.supplier && <span className="truncate">{item.supplier}</span>}
                    {item.deliveryDays != null && <span className="shrink-0">· {item.deliveryDays}d</span>}
                    {item.price != null && <span className="shrink-0 font-semibold text-black">· €{item.price}</span>}
                  </div>

                  {item.status === 'error' && item.errorMsg && (
                    <span className="self-start"><Tag tone="amber">{item.errorMsg}</Tag></span>
                  )}
                </div>

                {/* Actions */}
                {!isSent && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isEditing && (
                      <button onClick={() => handleOemEdit(item)} className={iconBtn} title="Edit part number">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    <button onClick={() => removeItem(item.id)} className={iconBtn} title="Remove">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {/* Manual add */}
        {showManualForm ? (
          <Card className="shrink-0">
            <form onSubmit={handleAddManual} className="flex flex-col gap-1.5">
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

      {/* Clear confirm dialog */}
      {showClearConfirm && (
        <div className="absolute inset-0 flex items-end justify-center bg-black/20 z-10">
          <Card className="w-full gap-3 px-4 py-4">
            <p className="text-sm font-semibold text-pq-ink text-center">
              {t.removeUnsentConfirm(cart.filter(i => i.status === 'pending' || i.status === 'error').length)}
            </p>
            <div className="flex gap-2">
              <PillButton variant="secondary" onClick={() => setShowClearConfirm(false)} className="flex-1">
                {t.cancel}
              </PillButton>
              <PillButton variant="primary" onClick={handleConfirmClear} className="flex-1">
                {t.clearUnsent}
              </PillButton>
            </div>
          </Card>
        </div>
      )}

      {/* Footer */}
      <Card compact className="shrink-0 flex-row flex-wrap gap-2">
        <PillButton variant="secondary" onClick={handleClearUnsent} className="flex-1 py-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          {t.clearUnsent}
        </PillButton>
        <PillButton variant="primary" onClick={handleFinish} className="flex-1 py-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {t.finishSearch}
        </PillButton>
      </Card>
    </div>
  );
}
