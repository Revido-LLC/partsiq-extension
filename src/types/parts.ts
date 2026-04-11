export type Lang = 'en' | 'nl';
export type WorkMode = 'vehicle' | 'order';
export type SidebarState = 'login' | 'idle' | 'scanning' | 'cart' | 'fallback' | 'finish';
export type CartItemStatus = 'pending' | 'sending' | 'sent' | 'error';

export interface CartItem {
  id: string;
  name: string;
  oem: string;
  price: number | null;
  deliveryDays: number | null;
  stock: number | null;
  supplier: string;
  sourceUrl: string;
  scannedAt: string;
  status: CartItemStatus;
  errorMsg?: string;
  bubblePartId?: string;
  checked: boolean;
}

export interface Vehicle {
  plate: string;
  id: string;
}

export interface Order {
  plate: string;
  id: string;
}

export interface BubbleMessage {
  type: string;
  [key: string]: unknown;
}
