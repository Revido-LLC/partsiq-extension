import { useState, useEffect, useRef } from 'react';
import type { Lang, WorkMode, SidebarState, CartItem, Vehicle, Order } from '@types/parts';
import {
  getAuthStatus, setAuthStatus,
  getLang, setLang,
  getWorkMode, setWorkMode,
  getVehicle, setVehicle,
  getOrder, setOrder,
  getCart, setCart,
} from '@lib/storage';
import { useBubbleMessages, buildBubbleUrl } from '@lib/iframe';
import { captureScreenshot } from '@lib/screenshot';
import { extractPartsFromScreenshot } from '@lib/ai';
import type { AiPart } from '@lib/ai';
import LoginState from '@components/states/LoginState';
import ScanningState from '@components/states/ScanningState';
import CartState from '@components/states/CartState';
import FallbackState from '@components/states/FallbackState';
import FinishState from '@components/states/FinishState';
import VehiclePanel from '@components/panels/VehiclePanel';
import OrderPanel from '@components/panels/OrderPanel';

export default function Sidebar() {
  const [state, setState] = useState<SidebarState>('checking');
  const [lang, setLangState] = useState<Lang>('en');
  const [workMode, setWorkModeState] = useState<WorkMode>('vehicle');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vehicle, setVehicleState] = useState<Vehicle | null>(null);
  const [order, setOrderState] = useState<Order | null>(null);
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [vehicleExpanded, setVehicleExpanded] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanScreenshot, setScanScreenshot] = useState<string | null>(null);
  const [loginError, setLoginError] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

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

  // Ref to processScan so the chrome.runtime listener always calls the current version
  const processScanRef = useRef<(base64: string) => Promise<void>>(async () => {});

  // ── Init from storage ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [storedLang, storedWorkMode, storedVehicle, storedOrder, storedCart] =
        await Promise.all([
          getLang(),
          getWorkMode(),
          getVehicle(),
          getOrder(),
          getCart(),
        ]);

      setLangState(storedLang);
      setWorkModeState(storedWorkMode);
      setVehicleState(storedVehicle);
      setOrderState(storedOrder);
      setCartState(storedCart);
    })();
  }, []);

  // ── Auth check timeout ─────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'checking') return;
    const timer = setTimeout(async () => {
      await setAuthStatus(false);
      setState('login');
    }, 3000);
    return () => clearTimeout(timer);
  }, [state]);

  // ── chrome.runtime message listener ───────────────────────────────────────
  useEffect(() => {
    const handler = (msg: { type: string; url?: string; imageBase64?: string; error?: string }) => {
      if (msg.type === 'page_url_changed' && msg.url) {
        const s = stateRef.current;
        if (s === 'cart' || s === 'idle') {
          setPendingUrl(msg.url);
        }
      }

      if (msg.type === 'crop_ready') {
        if (msg.error) {
          setScanError(msg.error);
          setState('scanning');
        } else if (msg.imageBase64) {
          setState('scanning');
          setScanScreenshot(null);
          const raw = msg.imageBase64;
          const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
          processScanRef.current(base64);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // ── Bubble message listener (always registered, guarded by isLoggedInRef) ──
  useBubbleMessages((msg) => {
    if (msg.type === 'partsiq:login_success') {
      const language = (msg.language as Lang) ?? 'en';
      const autoflexConnected = (msg.autoflex_connected as string) === 'yes';
      const mode: WorkMode = autoflexConnected ? 'order' : 'vehicle';

      setLangState(language);
      setWorkModeState(mode);
      setIsLoggedIn(true);
      setLoginError(false);
      void setAuthStatus(true);
      void setLang(language);
      void setWorkMode(mode);

      setState('idle');
      setVehicleExpanded(true);
      return;
    }

    if (msg.type === 'partsiq:login_failed') {
      setLoginError(true);
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
      setVehicleExpanded(false);

      if (hadVehicle) {
        void setCart([]);
        setCartState([]);
      }
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

  const aiPartsToCartItems = (parts: AiPart[], sourceUrl: string): CartItem[] =>
    parts.map(p => ({
      id: crypto.randomUUID(),
      name: p.name,
      oem: p.oem ?? '',
      price: p.price,
      deliveryDays: p.delivery_days,
      stock: p.stock,
      supplier: p.supplier ?? '',
      sourceUrl,
      scannedAt: new Date().toISOString(),
      status: 'pending' as const,
      checked: false,
    }));

  const mergeCart = (existing: CartItem[], incoming: CartItem[], currentUrl: string): CartItem[] => {
    // Remove pending/error from same URL (they'll be replaced by new scan)
    const kept = existing.filter(
      item => !(item.sourceUrl === currentUrl && (item.status === 'pending' || item.status === 'error'))
    );
    return [...kept, ...incoming];
  };

  const processScan = async (base64: string): Promise<void> => {
    setScanError(null);
    try {
      const parts = await extractPartsFromScreenshot(base64);
      if (parts.length === 0) {
        setState('fallback');
        return;
      }
      const url = await getCurrentUrl();
      const newItems = aiPartsToCartItems(parts, url);
      const merged = mergeCart(cartRef.current, newItems, url);
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
    setState('scanning');
    setScanError(null);
    setScanScreenshot(null);
    try {
      const dataUrl = await captureScreenshot();
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
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
      await chrome.runtime.sendMessage({ type: 'take_crop_init', tabId: tab.id });
      // Result arrives via crop_ready in the chrome.runtime.onMessage listener
      // State stays as-is while user makes selection on the page
    } catch (err) {
      setScanError(String(err));
      setState('scanning');
    }
  };

  const handleCrop = () => {
    void startCrop();
  };

  const handleUpdateCart = async (items: CartItem[]) => {
    setCartState(items);
    await setCart(items);
  };

  const handleFinish = async () => {
    setCartState([]);
    setVehicleState(null);
    setOrderState(null);
    setPendingUrl(null);
    await Promise.all([setCart([]), setVehicle(null), setOrder(null)]);
    setState('finish');
  };

  const handleNewQuote = () => {
    setVehicleExpanded(true);
    setState('idle');
  };

  const handleLoginRetry = () => {
    setLoginError(false);
    setState('login');
  };

  const handleBannerScan = async () => {
    setPendingUrl(null);
    await handleScan();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (state === 'checking') {
    return (
      <div className="relative h-full">
        <iframe src={buildBubbleUrl('login')} className="hidden" title="Auth check" />
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (state === 'login') {
    return (
      <LoginState
        lang={lang}
        hasError={loginError}
        onRetry={handleLoginRetry}
      />
    );
  }

  if (state === 'finish') {
    return <FinishState lang={lang} onNewQuote={handleNewQuote} />;
  }

  // idle / scanning / cart / fallback — all show the panel header
  const panelHeader = workMode === 'order'
    ? (
      <OrderPanel
        order={order}
        expanded={vehicleExpanded}
        lang={lang}
        onExpand={() => { setVehicleExpanded(true); setState('idle'); }}
      />
    )
    : (
      <VehiclePanel
        vehicle={vehicle}
        expanded={vehicleExpanded}
        lang={lang}
        onExpand={() => { setVehicleExpanded(true); setState('idle'); }}
      />
    );

  // When idle and panel is expanded: full-screen iframe (no other content)
  if (state === 'idle' && vehicleExpanded) {
    return <div className="flex flex-col h-screen">{panelHeader}</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {!vehicleExpanded && panelHeader}

      {state === 'scanning' && (
        <div className="flex-1">
          <ScanningState lang={lang} error={scanError} screenshot={scanScreenshot} onRetry={handleScan} />
        </div>
      )}

      {state === 'cart' && (
        <CartState
          lang={lang}
          cart={cart}
          vehicle={vehicle}
          order={order}
          workMode={workMode}
          pendingUrl={pendingUrl}
          onScan={handleBannerScan}
          onCrop={handleCrop}
          onUpdateCart={handleUpdateCart}
          onFinish={handleFinish}
          onDismissBanner={() => setPendingUrl(null)}
        />
      )}

      {state === 'fallback' && (
        <FallbackState
          lang={lang}
          onScan={handleScan}
          onAddManual={(item) => {
            const updated = [...cartRef.current, item];
            setCartState(updated);
            void setCart(updated);
            setState('cart');
          }}
          onCrop={handleCrop}
        />
      )}
    </div>
  );
}
