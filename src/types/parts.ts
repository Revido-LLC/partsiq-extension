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

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  partCount: number;
}

export type PopupState =
  | 'login'
  | 'idle'
  | 'session_select'
  | 'scanning'
  | 'iframe'
  | 'fallback'
  | 'confirm';

export type StatusChipVariant =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'added'
  | 'error';

// PostMessage types
export interface BubbleMessage {
  type:
    | 'partsiq:ready'
    | 'partsiq:login_success'
    | 'partsiq:login_failed'
    | 'partsiq:parts_saved'
    | 'partsiq:session_created'
    | 'partsiq:session_selected'
    | 'partsiq:error';
  [key: string]: unknown;
}

export interface LoginSuccessMessage extends BubbleMessage {
  type: 'partsiq:login_success';
  userId: string;
}

export interface PartsSavedMessage extends BubbleMessage {
  type: 'partsiq:parts_saved';
  count: number;
  sessionId: string;
}

export interface SessionCreatedMessage extends BubbleMessage {
  type: 'partsiq:session_created';
  sessionId: string;
  name: string;
}

export interface SessionSelectedMessage extends BubbleMessage {
  type: 'partsiq:session_selected';
  sessionId: string;
}
