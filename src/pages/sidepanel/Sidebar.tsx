import { useState, useEffect, useRef } from 'react';
import type { Lang, WorkMode, SidebarState, CartItem, Vehicle, Order } from '@app-types/parts';
import {
  getAuthStatus, setAuthStatus,
  getLang, setLang,
  getWorkMode, setWorkMode,
  getAutoflex, setAutoflex,
  getVehicle, setVehicle,
  getOrder, setOrder,
  getCart, setCart,
} from '@lib/storage';
import { useBubbleMessages, buildBubbleUrl } from '@lib/iframe';
import { useT, parseLang } from '@lib/i18n';
import { supplierNoticeFor, type SupplierNotice } from '@lib/crop';
import { captureScreenshot } from '@lib/screenshot';
import { compressImage } from '@lib/image-utils';
import { extractPartsFromScreenshot } from '@lib/ai';
import { aiPartsToCartItems, mergeCart } from '@lib/cart-utils';
import { orderForOpenWorkOrder, workModeAfterLogin, shouldReturnToWorkOrder, isRepeatedWorkOrder, shouldShowPanelHeader } from '@lib/autoflex';
import BubbleIframe from '@components/BubbleIframe';
import LoginState from '@components/states/LoginState';
import ScanningState from '@components/states/ScanningState';
import CartState from '@components/states/CartState';
import FallbackState from '@components/states/FallbackState';
import FinishState from '@components/states/FinishState';
import VehiclePanel from '@components/panels/VehiclePanel';
import OrderPanel from '@components/panels/OrderPanel';
import PillButton from '@components/ui/PillButton';

export default function Sidebar() {
  const [state, setState] = useState<SidebarState>('checking');
  const [lang, setLangState] = useState<Lang>('en');
  const [workMode, setWorkModeState] = useState<WorkMode>('vehicle');
  const [autoflex, setAutoflexState] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vehicle, setVehicleState] = useState<Vehicle | null>(null);
  const [order, setOrderState] = useState<Order | null>(null);
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [vehicleExpanded, setVehicleExpanded] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  // Crop/Scan clicked outside a supplier page (e.g. on Autoflex): what the panel tells the user
  const [supplierNotice, setSupplierNotice] = useState<SupplierNotice | null>(null);
  const [scanScreenshot, setScanScreenshot] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [finishOrder, setFinishOrder] = useState<Order | null>(null);
  // Summary of the finished session, kept after cart/vehicle/order are cleared
  const [finishSummary, setFinishSummary] = useState<{ sentCount: number; plate: string }>({ sentCount: 0, plate: '' });
  const [loginOverlay, setLoginOverlay] = useState(true);
  // Autoflex work order open in the active tab (drives the autoflex-panel iframe)
  const [activeWo, setActiveWo] = useState<string | null>(null);
  const [woSearch, setWoSearch] = useState(false);
  /** Bumped by each banner "Find": remounts the panel iframe so its auto-search runs again */
  const [searchRun, setSearchRun] = useState(0);
  const [woPanelHidden, setWoPanelHidden] = useState(false);
  const t = useT(lang);
  const loginTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to avoid stale closures in event listeners
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;
  const stateRef = useRef(state);
  stateRef.current = state;
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const vehicleRef = useRef(vehicle);
  vehicleRef.current = vehicle;
  const orderRef = useRef(order);
  orderRef.current = order;
  const activeWoRef = useRef(activeWo);
  activeWoRef.current = activeWo;

  // Ref to processScan so the chrome.runtime listener always calls the current version
  const processScanRef = useRef<(base64: string, isCrop?: boolean) => Promise<void>>(async () => {});

  // ── Init from storage ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [storedLang, storedWorkMode, storedVehicle, storedOrder, storedCart, storedAutoflex] =
          await Promise.all([
            getLang(),
            getWorkMode(),
            getVehicle(),
            getOrder(),
            getCart(),
            getAutoflex(),
          ]);

        setLangState(storedLang);
        setWorkModeState(storedWorkMode);
        setVehicleState(storedVehicle);
        setOrderState(storedOrder);
        setCartState(storedCart);
        setAutoflexState(storedAutoflex);
        orderRef.current = storedOrder;
        cartRef.current = storedCart;
      } catch {
        setState('login');
      }
      // After the stored order is loaded, so following the open work order compares against it
      try {
        const res = await chrome.runtime.sendMessage({ type: 'get_active_work_order' }) as
          { workOrderId?: string | null; plate?: string; search?: boolean } | undefined;
        activeWoRef.current = res?.workOrderId ?? null;
        setActiveWo(res?.workOrderId ?? null);
        // Opened by the banner's "Find": its search broadcast arrived before this panel listened
        if (res?.search === true) setWoSearch(true);
        followOpenWorkOrderRef.current(res?.workOrderId ?? null, res?.plate ?? '');
      } catch {/* background not ready */}
    })();
  }, []);

  // ── Auth check timeout (fallback se onLoad nunca disparar) ────────────────
  useEffect(() => {
    if (state !== 'checking') return;
    const timer = setTimeout(async () => {
      await setAuthStatus(false);
      if (loginTimerRef.current) {
        clearTimeout(loginTimerRef.current);
        loginTimerRef.current = null;
      }
      setLoginOverlay(false);
      setState('login');
    }, 5000);
    return () => clearTimeout(timer);
  }, [state]);

  // ── Cleanup loginTimer on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (loginTimerRef.current) clearTimeout(loginTimerRef.current);
    };
  }, []);

  // ── Follow the work order open in Autoflex ─────────────────────────────────
  // Scan/crop parts go to the work order open in Autoflex. The extension keeps it while the
  // user browses supplier tabs (those report no work order), so it is only replaced when
  // Autoflex opens another one.
  const followOpenWorkOrder = (workOrderId: string | null, plate = '') => {
    if (!workOrderId) return;
    const next = orderForOpenWorkOrder(orderRef.current, workOrderId, plate);
    const sameOrder = !next || orderRef.current?.id.toLowerCase() === next.id.toLowerCase();
    if (next) {
      orderRef.current = next;
      setOrderState(next);
      void setOrder(next);
    }
    // Same work order and already in order mode: nothing else to do (keep the cart)
    if (sameOrder && workMode === 'order') return;
    if (!sameOrder) {
      cartRef.current = [];
      setCartState([]);
      void setCart([]);
    }
    setWorkModeState('order');
    void setWorkMode('order');
    if (stateRef.current !== 'checking' && stateRef.current !== 'login') {
      setVehicleExpanded(false);
      setState('cart');
    }
  };
  const followOpenWorkOrderRef = useRef(followOpenWorkOrder);
  followOpenWorkOrderRef.current = followOpenWorkOrder;

  // Back on the selection screen with a work order open in Autoflex: show its panel again
  useEffect(() => {
    if (shouldReturnToWorkOrder({ state, vehicleExpanded, activeWo })) setWoPanelHidden(false);
  }, [state, vehicleExpanded, activeWo]);

  // ── chrome.runtime message listener ───────────────────────────────────────
  useEffect(() => {
    const handler = (msg: {
      type: string; url?: string; imageBase64?: string; error?: string;
      workOrderId?: string | null; plate?: string; search?: boolean;
    }) => {
      if (msg.type === 'work_order_active') {
        // Tab switches re-send the followed work order: keep cart, finish screen and panel search
        if (isRepeatedWorkOrder(activeWoRef.current, { workOrderId: msg.workOrderId ?? null, search: msg.search })) return;
        activeWoRef.current = msg.workOrderId ?? null;
        setActiveWo(msg.workOrderId ?? null);
        followOpenWorkOrderRef.current(msg.workOrderId ?? null, msg.plate ?? '');
        setWoSearch(msg.search === true);
        // Only the banner's "Find" (explicit user action) brings the panel back mid-flow
        if (msg.workOrderId && msg.search === true) {
          setWoPanelHidden(false);
          // Reload the panel even if it already had search=1, so every "Find" searches
          setSearchRun(n => n + 1);
          void chrome.runtime.sendMessage({ type: 'search_received' }).catch(() => {});
        }
        return;
      }
      if (msg.type === 'crop_shown') {
        setSupplierNotice(null);
        return;
      }
      if (msg.type === 'crop_ready') {
        setSupplierNotice(null);
        if (msg.error) {
          setScanError(msg.error);
          setState('scanning');
        } else if (msg.imageBase64) {
          setState('scanning');
          setScanScreenshot(null);
          void (async () => {
            const raw = msg.imageBase64!;
            const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
            const compressedDataUrl = await compressImage(
              `data:image/jpeg;base64,${base64}`,
              1400,
              0.75,
            );
            const compressedBase64 = compressedDataUrl.includes(',')
              ? compressedDataUrl.split(',')[1]
              : compressedDataUrl;
            processScanRef.current(compressedBase64, true);
          })();
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // ── Bubble message listener (always registered, guarded by isLoggedInRef) ──
  useBubbleMessages((msg) => {
    if (msg.type === 'partsiq:extension_ready') {
      setIframeReady(true);
      return;
    }

    if (msg.type === 'partsiq:login_success') {
      if (loginTimerRef.current) {
        clearTimeout(loginTimerRef.current);
        loginTimerRef.current = null;
      }
      const language = parseLang(msg.language);
      const autoflexConnected = (msg.autoflex_connected as string) === 'yes';
      // A work order open in Autoflex keeps order mode (followOpenWorkOrder already set its order)
      const mode: WorkMode = workModeAfterLogin(autoflexConnected, activeWoRef.current);

      setLangState(language);
      setWorkModeState(mode);
      setIsLoggedIn(true);
      void setAuthStatus(true);
      void setLang(language);
      void setWorkMode(mode);
      void setAutoflex(autoflexConnected);
      setAutoflexState(autoflexConnected);

      const hasSession = !!vehicleRef.current || !!orderRef.current;
      if (hasSession) {
        setState('cart');
        setVehicleExpanded(false);
      } else {
        setIframeReady(false);
        setState('idle');
        setVehicleExpanded(true);
      }
      return;
    }

    if (msg.type === 'partsiq:login_failed') {
      return;
    }

    // The work order panel reports the user's language on load and whenever it changes,
    // so the extension's own screens (crop, finish) follow it without reopening the panel
    if (msg.type === 'partsiq:language') {
      const language = parseLang(msg.language);
      setLangState(language);
      void setLang(language);
      return;
    }

    // Ignore selection messages before login is complete
    if (!isLoggedInRef.current) return;

    if (msg.type === 'partsiq:vehicle_selected') {
      const plate = (msg.plate as string) ?? '';
      const id = (msg.id as string) ?? '';
      if (!plate && !id) return;

      const v: Vehicle = { plate, id };
      const hadVehicle = !!vehicleRef.current;

      if (hadVehicle) {
        void setCart([]);
        setCartState([]);
      }

      setVehicleState(v);
      void setVehicle(v);
      setState('cart');
      setVehicleExpanded(false);
    }

    if (msg.type === 'partsiq:order_selected') {
      const plate = (msg.plate as string) ?? '';
      const id = (msg.id as string) ?? '';
      if (!id) return;

      const o: Order = { plate, id };
      const hadOrder = !!orderRef.current;

      if (hadOrder) {
        void setCart([]);
        setCartState([]);
      }

      setOrderState(o);
      void setOrder(o);
      setState('cart');
      setVehicleExpanded(false);
    }

    if (msg.type === 'partsiq:switch_to_vehicle') {
      setWorkModeState('vehicle');
      void setWorkMode('vehicle');
      setVehicleExpanded(true);
      setState('idle');
      return;
    }

    if (msg.type === 'partsiq:switch_to_order') {
      setWorkModeState('order');
      void setWorkMode('order');
      setVehicleExpanded(true);
      setState('idle');
      return;
    }
  });

  // ── Scan helpers ───────────────────────────────────────────────────────────
  const getCurrentUrl = async (): Promise<string> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tab?.url ?? '';
    } catch {
      return '';
    }
  };

  const processScan = async (base64: string, isCrop = false): Promise<void> => {
    setScanError(null);
    try {
      const parts = await extractPartsFromScreenshot(base64);
      // Always clear pending/error before updating cart — keeps list clean across scans
      const kept = cartRef.current.filter(i => i.status === 'sent' || i.status === 'sending');
      if (parts.length === 0) {
        setCartState(kept);
        await setCart(kept);
        setState('fallback');
        return;
      }
      const url = await getCurrentUrl();
      const autoSend = isCrop && parts.length <= 2;
      const newItems = aiPartsToCartItems(parts, url, autoSend);
      const merged = mergeCart(kept, newItems);
      setCartState(merged);
      await setCart(merged);
      setState('cart');
    } catch (err) {
      setScanError(String(err));
      setState('scanning');
    }
  };

  // Keep ref in sync so the chrome.runtime handler always calls the latest version
  processScanRef.current = processScan;

  const handleScan = async () => {
    // On Autoflex the scan would read the work order itself as parts
    const notice = supplierNoticeFor('scan', await getCurrentUrl());
    setSupplierNotice(notice);
    if (notice) return;
    setState('scanning');
    setScanError(null);
    setScanScreenshot(null);
    try {
      const dataUrl = await captureScreenshot();
      const compressedDataUrl = await compressImage(dataUrl, 1400, 0.72);
      const base64 = compressedDataUrl.includes(',') ? compressedDataUrl.split(',')[1] : compressedDataUrl;
      setScanScreenshot(base64);
      await processScan(base64);
    } catch (err) {
      setScanError(String(err));
    }
  };

  const startCrop = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) return;
      setScanError(null);
      await chrome.runtime.sendMessage({ type: 'take_crop_init', tabId: tab.id, lang });
      // Result arrives via crop_ready in the chrome.runtime.onMessage listener
      // State stays as-is while user makes selection on the page
    } catch (err) {
      setScanError(String(err));
      setState('scanning');
    }
  };

  const handleCrop = () => {
    void (async () => {
      // Crop skips Autoflex and waits for a supplier tab: say so, or the click looks dead
      setSupplierNotice(supplierNoticeFor('crop', await getCurrentUrl()));
      await startCrop();
    })();
  };

  const dismissSupplierNotice = () => {
    if (supplierNotice === 'cropWaiting') void chrome.runtime.sendMessage({ type: 'crop_cancel' }).catch(() => {});
    setSupplierNotice(null);
  };
  const supplierNoticeText = supplierNotice ? t[supplierNotice] : null;

  const handleClear = () => {
    setScanError(null);
    setScanScreenshot(null);
    setCartState([]);
    void setCart([]);
    setIframeReady(false);
    setVehicleExpanded(true);
    setState('idle');
  };

  const handleUpdateCart = async (items: CartItem[]) => {
    // Keep the ref current right away: handleFinish may read it before React re-renders
    cartRef.current = items;
    setCartState(items);
    await setCart(items);
  };

  const handleFinish = async () => {
    setFinishOrder(orderRef.current);
    setFinishSummary({
      sentCount: cartRef.current.filter(i => i.status === 'sent').length,
      plate: orderRef.current?.plate || vehicleRef.current?.plate || '',
    });
    setCartState([]);
    setVehicleState(null);
    setOrderState(null);
    await Promise.all([setCart([]), setVehicle(null), setOrder(null)]);
    setState('finish');
  };

  const handleNewQuote = () => {
    setFinishOrder(null);
    if (autoflex) {
      setWorkModeState('order');
      void setWorkMode('order');
    }
    setIframeReady(false);
    setVehicleExpanded(true);
    setState('idle');
  };

  const handleLoginIframeLoad = () => {
    loginTimerRef.current = setTimeout(() => {
      loginTimerRef.current = null;
      setLoginOverlay(false);
      setState('login');
    }, 2500);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (state === 'checking' || state === 'login') {
    return (
      <div className="relative h-full bg-pq-page">
        <LoginState onLoad={handleLoginIframeLoad} />
        {loginOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="w-8 h-8 border-4 border-pq-teal/30 border-t-pq-teal rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // Autoflex work order open in the active tab: show the Parts iQ panel for it
  if (activeWo && !woPanelHidden) {
    return (
      <div className="flex flex-col h-screen bg-pq-page">
        <BubbleIframe
          key={`${activeWo}-${searchRun}`}
          src={buildBubbleUrl('autoflexPanel', { wo: activeWo, search: woSearch ? '1' : undefined })}
          title="Parts iQ – Autoflex"
          className="flex-1 w-full"
        />
        <div className="shrink-0 border-t border-pq-line bg-white p-2">
          <PillButton variant="secondary" onClick={() => setWoPanelHidden(true)} className="w-full py-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            {t.scanSupplierPage}
          </PillButton>
        </div>
      </div>
    );
  }

  if (state === 'finish') {
    return (
      <FinishState
        lang={lang}
        workMode={workMode}
        order={finishOrder}
        plate={finishSummary.plate}
        sentCount={finishSummary.sentCount}
        onNewQuote={handleNewQuote}
      />
    );
  }

  // idle / scanning / cart / fallback — all show the panel header
  const panelHeader = workMode === 'order'
    ? (
      <OrderPanel
        order={order}
        lang={lang}
        onExpand={() => { setIframeReady(false); setVehicleExpanded(true); setState('idle'); }}
        onBackToWorkOrder={activeWo ? () => setWoPanelHidden(false) : undefined}
      />
    )
    : (
      <VehiclePanel
        vehicle={vehicle}
        lang={lang}
        onExpand={() => {
          if (autoflex) {
            setWorkModeState('order');
            void setWorkMode('order');
          }
          setIframeReady(false);
          setVehicleExpanded(true);
          setState('idle');
        }}
        onBackToWorkOrder={activeWo ? () => setWoPanelHidden(false) : undefined}
      />
    );

  // When idle and panel is expanded: full-screen iframe rendered directly
  // (NOT through panel components, to preserve Bubble's internal navigation state
  //  when switching between order and vehicle mode)
  if (state === 'idle' && vehicleExpanded) {
    return (
      <div className={`relative flex flex-col h-screen bg-pq-page${!autoflex ? ' pt-5' : ''}`}>
        <BubbleIframe
          src={buildBubbleUrl('extension')}
          title="Select"
          className="flex-1 w-full"
        />
        {!iframeReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="w-8 h-8 border-4 border-pq-teal/30 border-t-pq-teal rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen gap-2 bg-pq-page p-2.5">
      {/* Header card (plate, back to the work order, change order/vehicle) on every scan/cart screen */}
      {shouldShowPanelHeader({ vehicleExpanded, activeWo }) && panelHeader}

      {state === 'scanning' && (
        <div className="flex-1">
          <ScanningState lang={lang} error={scanError} screenshot={scanScreenshot} onRetry={handleScan} />
        </div>
      )}

      {state === 'cart' && (
        <div className="flex-1 overflow-hidden">
          <CartState
            lang={lang}
            cart={cart}
            vehicle={vehicle}
            order={order}
            workMode={workMode}
            onScan={handleScan}
            onCrop={handleCrop}
            notice={supplierNoticeText}
            onDismissNotice={dismissSupplierNotice}
            onUpdateCart={handleUpdateCart}
            onFinish={handleFinish}
          />
        </div>
      )}

      {state === 'fallback' && (
        <div className="flex-1 overflow-hidden">
          <FallbackState
            lang={lang}
            cart={cart}
            onScan={handleScan}
            onAddManual={(item) => {
              const updated = [...cartRef.current, item];
              setCartState(updated);
              void setCart(updated);
              setState('cart');
            }}
            onCrop={handleCrop}
            onClear={handleClear}
            notice={supplierNoticeText}
            onDismissNotice={dismissSupplierNotice}
          />
        </div>
      )}
    </div>
  );
}
