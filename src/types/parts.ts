export interface PartData {
  partName: string;
  oemNumber: string;
  netPrice: number | null;
  grossPrice: number | null;
  deliveryTime: string | null;
  stockAvailable: boolean | null;
  supplier: string | null;
  confidence: number; // 0-1
}

export type SidebarState =
  | 'login'
  | 'scanning'
  | 'cropping'
  | 'cart'
  | 'done'; // shown after "Finalizar Busca"

export type CartItemStatus = 'pending' | 'sending' | 'sent' | 'error';

export interface CartItem {
  id: string;
  part: PartData;
  supplierName: string;
  sourceUrl: string;
  checked: boolean;
  status: CartItemStatus;
  bubblePartId?: string;
  errorMessage?: string;
  scannedAt: string;
}

export type StatusChipVariant =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'added'
  | 'error';

export interface Vehicle {
  plate: string;
  id?: string; // Bubble record ID, optional
}

// PostMessage types
export interface BubbleMessage {
  type:
    | 'partsiq:ready'
    | 'partsiq:login_success'
    | 'partsiq:login_failed'
    | 'partsiq:login_required'
    | 'partsiq:vehicle_selected'
    | 'partsiq:error';
  [key: string]: unknown;
}
