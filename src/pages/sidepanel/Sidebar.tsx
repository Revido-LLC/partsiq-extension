import { useCallback, useEffect, useRef, useState } from 'react';
import SidebarLayout from '@components/SidebarLayout';
import CartFooter from '@components/cart/CartFooter';
import CartPartCard from '@components/cart/CartPartCard';
import AddPartForm from '@components/cart/AddPartForm';
import LoginState from '@components/states/LoginState';
import ScanningState from '@components/states/ScanningState';
import VehiclePanel from '@components/VehiclePanel';
import {
  getCart, setCart, clearCart,
  getVehicle, setVehicle, clearVehicle,
  getOrder, setOrder, clearOrder,
  getWorkMode, setWorkMode,
  getLanguage, setLanguage,
} from '@lib/storage';
import { extractSupplierName } from '@lib/supplier';
import { sendPartToBubble, removePartFromBubble, type WorkContext } from '@lib/bubble-api';
import { T, type Lang } from '@lib/translations';
import type { CartItem, CartItemStatus, Order, PartData, SidebarState, Vehicle, WorkMode } from '@types/parts';

const Sidebar = () => {
  const [state, setState] = useState<SidebarState>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [vehicle, setVehicleState] = useState<Vehicle | null>(null);
  const [vehicleExpanded, setVehicleExpanded] = useState(true);
  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [urlChangeBanner, setUrlChangeBanner] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | undefined>(undefined);
  const [lang, setLangState] = useState<Lang>('nl');
  const stateRef = useRef(state);
  stateRef.current = state;

  const [workMode, setWorkModeState] = useState<WorkMode>('vehicle');
  const [order, setOrderState] = useState<Order | null>(null);

  // ── Boot: load cart + vehicle + language from storage ────────────────────
  useEffect(() => {
    getCart().then(setCartState);
    getVehicle().then(v => {
      setVehicleState(v);
      if (v) setVehicleExpanded(false);
    });
    getOrder().then(o => {
      setOrderState(o);
      if (o) setVehicleExpanded(false);
    });
    getWorkMode().then(setWorkModeState);
    getLanguage().then(setLangState);
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
      setActiveTabUrl(tabs[0]?.url ?? '');
    });
  }, []);


  // ── Listen for URL changes + sidebar_opened signal ──────────────────────
  useEffect(() => {
    const listener = (msg: { type: string; url?: string; screenshot?: string }) => {
      if (msg.type === 'page_url_changed' && stateRef.current === 'cart') {
        setUrlChangeBanner(msg.url ?? '');
        setActiveTabUrl(msg.url ?? '');
      }
      if (msg.type === 'sidebar_opened' && msg.url) {
        setActiveTabUrl(msg.url);
      }
      if (msg.type === 'crop_done' && msg.screenshot && stateRef.current === 'cropping') {
        setCroppedImage(msg.screenshot as string);
        setState('scanning');
      }
      if (msg.type === 'crop_cancelled' || msg.type === 'crop_error') {
        setCroppedImage(undefined);
        setState('cart');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // ── Auto-scan when authenticated (vehicle required) ──────────────────────
  useEffect(() => {
    if (isLoggedIn && stateRef.current !== 'scanning') {
      // If no vehicle yet, stay in cart state — VehiclePanel will be expanded
      setState('cart');
    }
  }, [isLoggedIn]);

  // ── Cart persistence ─────────────────────────────────────────────────────
  const updateCartItem = useCallback((id: string, patch: Partial<CartItem>) => {
    setCartState(prev => {
      const next = prev.map(item => item.id === id ? { ...item, ...patch } : item);
      setCart(next);
      return next;
    });
  }, []);

  // ── Scan trigger ─────────────────────────────────────────────────────────
  const triggerScan = useCallback(() => {
    if (stateRef.current === 'scanning') return;
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!hasSelection) {
      setVehicleExpanded(true);
      return;
    }
    setUrlChangeBanner(null);
    setState('scanning');
  }, [vehicle, order, workMode]);

  const triggerCrop = useCallback(async () => {
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!hasSelection) {
      setVehicleExpanded(true);
      return;
    }
    setUrlChangeBanner(null);
    setState('cropping');
    try {
      await chrome.runtime.sendMessage({ type: 'start_crop' });
    } catch {
      setState('cart');
    }
  }, [vehicle, order, workMode]);

  // ── Parts found: merge into cart ─────────────────────────────────────────
  const handlePartsFound = useCallback((parts: PartData[], tabUrl: string) => {
    setCroppedImage(undefined);
    const supplier = extractSupplierName(tabUrl);

    setCartState(prev => {
      const kept = prev.filter(item =>
        item.status === 'sent' || item.sourceUrl !== tabUrl
      );

      const existingKeys = new Set(kept.map(i =>
        (i.part.oemNumber ?? '').toLowerCase() + '|' + i.sourceUrl
      ));

      const newItems: CartItem[] = parts
        .filter(p => !existingKeys.has((p.oemNumber ?? '').toLowerCase() + '|' + tabUrl))
        .map(p => ({
          id: crypto.randomUUID(),
          part: p,
          supplierName: p.supplier || supplier,
          sourceUrl: tabUrl,
          checked: false,
          status: 'pending' as CartItemStatus,
          scannedAt: new Date().toISOString(),
        }));

      const merged = [...kept, ...newItems];
      setCart(merged);
      return merged;
    });

    setState('cart');
  }, []);

  // ── Part toggle (check/uncheck) ──────────────────────────────────────────
  const handleToggle = useCallback(async (id: string) => {
    const item = cart.find(i => i.id === id);
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!item || item.status === 'sending' || !hasSelection) return;

    const ctx: WorkContext = { mode: workMode, vehicle, order };

    if (!item.checked) {
      updateCartItem(id, { checked: true, status: 'sending', errorMessage: undefined });
      try {
        const { partId } = await sendPartToBubble(
          item.part,
          item.supplierName,
          ctx,
          item.sourceUrl
        );
        updateCartItem(id, { status: 'sent', bubblePartId: partId });
      } catch (err) {
        updateCartItem(id, { status: 'error', errorMessage: String(err) });
      }
    } else {
      if (item.bubblePartId) {
        updateCartItem(id, { status: 'sending' });
        try {
          await removePartFromBubble(item.bubblePartId);
          updateCartItem(id, { checked: false, status: 'pending', bubblePartId: undefined });
        } catch (err) {
          updateCartItem(id, { status: 'error', errorMessage: String(err) });
        }
      } else {
        updateCartItem(id, { checked: false, status: 'pending' });
      }
    }
  }, [cart, vehicle, order, workMode, updateCartItem]);

  // ── Update OEM number ────────────────────────────────────────────────────
  const handleUpdateOem = useCallback((id: string, oemNumber: string) => {
    setCartState(prev => {
      const next = prev.map(item =>
        item.id === id ? { ...item, part: { ...item.part, oemNumber } } : item
      );
      setCart(next);
      return next;
    });
  }, []);

  // ── Retry errored item ───────────────────────────────────────────────────
  const handleRetry = useCallback(async (id: string) => {
    const item = cart.find(i => i.id === id);
    const hasSelection = workMode === 'order' ? !!order : !!vehicle;
    if (!item || !hasSelection) return;
    const ctx: WorkContext = { mode: workMode, vehicle, order };
    updateCartItem(id, { status: 'sending', errorMessage: undefined });
    try {
      const { partId } = await sendPartToBubble(
        item.part,
        item.supplierName,
        ctx,
        item.sourceUrl
      );
      updateCartItem(id, { status: 'sent', checked: true, bubblePartId: partId });
    } catch (err) {
      updateCartItem(id, { status: 'error', errorMessage: String(err) });
    }
  }, [cart, vehicle, order, workMode, updateCartItem]);

  // ── Finalizar Busca ──────────────────────────────────────────────────────
  const handleFinish = useCallback(async () => {
    await clearCart();
    await clearVehicle();
    await clearOrder();
    setCartState([]);
    setVehicleState(null);
    setOrderState(null);
    setVehicleExpanded(true);
    setUrlChangeBanner(null);
    setState('done');
  }, []);

  const vehiclePanelNode = (
    <VehiclePanel
      vehicle={vehicle}
      order={order}
      workMode={workMode}
      expanded={vehicleExpanded}
      lang={lang}
      onVehicleSelected={(v) => {
        if (vehicle) { clearCart(); setCartState([]); }
        setVehicleState(v);
        setVehicle(v);
        setVehicleExpanded(false);
        if (cart.length === 0) {
          setTimeout(() => setState('scanning'), 100);
        } else {
          setState('cart');
        }
      }}
      onOrderSelected={(o) => {
        if (order) { clearCart(); setCartState([]); }
        setOrderState(o);
        setOrder(o);
        setVehicleExpanded(false);
        if (cart.length === 0) {
          setTimeout(() => setState('scanning'), 100);
        } else {
          setState('cart');
        }
      }}
      onExpand={() => setVehicleExpanded(true)}
    />
  );

  // ── Render: login ─────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <SidebarLayout>
        <LoginState lang={lang} onSuccess={(detectedLang, autoflexConnected) => {
          if (detectedLang) { setLangState(detectedLang); setLanguage(detectedLang); }
          const mode: WorkMode = autoflexConnected ? 'order' : 'vehicle';
          setWorkModeState(mode);
          setWorkMode(mode);
          setIsLoggedIn(true);
        }} />
      </SidebarLayout>
    );
  }

  // ── Render: done (after "Finalizar Busca") ────────────────────────────────
  if (state === 'done') {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800">{T[lang].searchDone}</p>
          <p className="text-xs text-gray-500">{T[lang].checkStatus}</p>
          <button
            onClick={() => setState('cart')}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            {T[lang].newSearch}
          </button>
        </div>
      </SidebarLayout>
    );
  }

  // ── Render: cropping (waiting for user to draw selection on page) ─────────
  if (state === 'cropping') {
    const footer = (
      <CartFooter
        totalCount={cart.length}
        selectedCount={cart.filter(i => i.checked).length}
        sentCount={cart.filter(i => i.status === 'sent').length}
        isScanning={false}
        isCropping={true}
        lang={lang}
        onRescan={triggerScan}
        onCrop={triggerCrop}
        onClear={() => { clearCart(); setCartState([]); }}
        onFinish={handleFinish}
      />
    );
    return (
      <SidebarLayout
        vehiclePanel={vehiclePanelNode}
        vehiclePanelExpanded={vehicleExpanded}
        footer={footer}
      >
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#00C6B2] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 3h4.5v2H5v2.5H3V3zm13.5 0H21v4.5h-2V5h-2.5V3zM3 16.5h2V19h2.5v2H3v-4.5zm13.5 2.5H19v-2.5h2V21h-4.5v-2z"/>
            </svg>
          </div>
          <p className="text-sm text-gray-600">{T[lang].selectArea}</p>
          <button
            onClick={() => {
              setState('cart');
              chrome.runtime.sendMessage({ type: 'cancel_crop' }).catch(() => {});
            }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            {T[lang].cancel}
          </button>
        </div>
      </SidebarLayout>
    );
  }

  const selectedCount = cart.filter(i => i.checked).length;
  const sentCount     = cart.filter(i => i.status === 'sent').length;
  const isScanning    = state === 'scanning';
  const isCropping    = false; // state === 'cropping' is handled by the early return above

  const footer = (
    <CartFooter
      totalCount={cart.length}
      selectedCount={selectedCount}
      sentCount={sentCount}
      isScanning={isScanning}
      isCropping={isCropping}
      lang={lang}
      onRescan={triggerScan}
      onCrop={triggerCrop}
      onClear={() => {
        clearCart();
        setCartState([]);
      }}
      onFinish={handleFinish}
    />
  );

  return (
    <SidebarLayout
      vehiclePanel={vehiclePanelNode}
      vehiclePanelExpanded={vehicleExpanded}
      footer={footer}
    >
      {/* URL change banner */}
      {urlChangeBanner && state === 'cart' && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
          <span className="text-xs text-amber-800">{T[lang].pageChanged}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setUrlChangeBanner(null)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {T[lang].dismiss}
            </button>
            <button
              onClick={triggerScan}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              {T[lang].rescan}
            </button>
          </div>
        </div>
      )}

      {/* Scanning state */}
      {state === 'scanning' && (
        <ScanningState
          tabUrl={activeTabUrl}
          lang={lang}
          overrideScreenshot={croppedImage}
          onFound={(parts, tabUrl) => handlePartsFound(parts, tabUrl)}
          onNotFound={() => { setCroppedImage(undefined); setState('cart'); }}
        />
      )}

      {/* Cart items + manual add */}
      {(state === 'cart' || state === 'scanning') && (
        <div className={state === 'scanning' ? 'opacity-50 pointer-events-none' : ''}>
          {cart.map(item => (
            <CartPartCard
              key={item.id}
              item={item}
              lang={lang}
              onToggle={handleToggle}
              onRetry={handleRetry}
              onUpdateOem={handleUpdateOem}
            />
          ))}
          {state === 'cart' && (workMode === 'order' ? !!order : !!vehicle) && (
            <AddPartForm
              lang={lang}
              onAdd={(partName, oemNumber) => {
            const newItem: CartItem = {
              id: crypto.randomUUID(),
              part: {
                partName,
                oemNumber,
                netPrice: null,
                grossPrice: null,
                deliveryTime: null,
                stockAvailable: null,
                supplier: null,
                confidence: 1,
              },
              supplierName: '',
              sourceUrl: activeTabUrl,
              checked: false,
              status: 'pending',
              scannedAt: new Date().toISOString(),
            };
            setCartState(prev => {
              const next = [...prev, newItem];
              setCart(next);
              return next;
            });
          }}
            />
          )}
        </div>
      )}

      {/* Empty cart + no selection = prompt to select vehicle or order */}
      {state === 'cart' && cart.length === 0 && (workMode === 'order' ? !order : !vehicle) && (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <p className="text-sm text-gray-500">
            {workMode === 'order' ? T[lang].selectOrder : T[lang].selectVehicle}
          </p>
        </div>
      )}

      {/* Empty cart + has selection = prompt to scan */}
      {state === 'cart' && cart.length === 0 && (workMode === 'order' ? !!order : !!vehicle) && (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">{T[lang].noPartsYet}</p>
          <p className="text-xs text-gray-400">{T[lang].scanInstruction}</p>
        </div>
      )}
    </SidebarLayout>
  );
};

export default Sidebar;
