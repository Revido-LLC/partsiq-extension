// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CartState from './CartState';
import type { CartItem, Vehicle, Order } from '@types/parts';
import { CONFIG } from '@lib/constants';

// ── Factory ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'test-1',
    name: 'Brake pad',
    oem: 'BP-123',
    price: 10,
    deliveryDays: 2,
    stock: 5,
    supplier: 'AutoParts',
    sourceUrl: 'https://example.com',
    scannedAt: '2026-01-01',
    status: 'pending',
    checked: false,
    ...overrides,
  };
}

// ── Default props ─────────────────────────────────────────────────────────────

const VEHICLE: Vehicle = { id: 'v-1', plate: 'AB-123-C' };
const ORDER: Order = { id: 'o-1', plate: 'XY-999-Z' };

function defaultProps(overrides: Partial<React.ComponentProps<typeof CartState>> = {}) {
  return {
    lang: 'en' as const,
    cart: [],
    vehicle: null,
    order: null,
    workMode: 'vehicle' as const,
    onScan: vi.fn().mockResolvedValue(undefined),
    onCrop: vi.fn().mockResolvedValue(undefined),
    onUpdateCart: vi.fn().mockResolvedValue(undefined),
    onFinish: vi.fn(),
    ...overrides,
  };
}

// ── Fetch mock helpers ────────────────────────────────────────────────────────

function mockFetchOk(body: unknown = { response: { id: 'bubble-id-1' } }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }));
}

function mockFetchError(status = 500) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  }));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── handleCheck: send pending item ────────────────────────────────────────────

describe('handleCheck — sends a pending item', () => {
  beforeEach(() => {
    mockFetchOk({ response: { id: 'bubble-id-1' } });
  });

  it('calls fetch to SAVE_PART with the correct URL', async () => {
    const item = makeItem();
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        CONFIG.BUBBLE_API.SAVE_PART,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('sends correct body fields including part_name and oem_number', async () => {
    const item = makeItem({ name: 'Brake pad', oem: 'BP-123', price: 15, deliveryDays: 3, stock: 2, supplier: 'PartsCo' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], workMode: 'vehicle', vehicle: VEHICLE, onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.part_name).toBe('Brake pad');
    expect(body.oem_number).toBe('BP-123');
    expect(body.net_price).toBe(15);
    expect(body.gross_price).toBe(15);
    expect(body.delivery_time).toBe('3');
    expect(body.stock_available).toBe(true);
    expect(body.supplier).toBe('PartsCo');
  });

  it('includes vehicle_id and vehicle_plate when workMode is "vehicle"', async () => {
    const item = makeItem();
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], workMode: 'vehicle', vehicle: VEHICLE, onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.vehicle_id).toBe(VEHICLE.id);
    expect(body.vehicle_plate).toBe(VEHICLE.plate);
  });

  it('includes order_id when workMode is "order"', async () => {
    const item = makeItem();
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], workMode: 'order', order: ORDER, onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.order_id).toBe(ORDER.id);
    expect(body.autoflex_integration).toBe('yes');
  });

  it('calls onUpdateCart with status "sent" and checked true on success', async () => {
    const item = makeItem();
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      const sentCall = onUpdateCart.mock.calls.find(
        ([items]: [CartItem[]]) => items.some(i => i.status === 'sent'),
      );
      expect(sentCall).toBeDefined();
    });

    const sentCall = onUpdateCart.mock.calls.find(
      ([items]: [CartItem[]]) => items.some(i => i.status === 'sent'),
    );
    const sentItem = (sentCall![0] as CartItem[]).find(i => i.id === 'test-1')!;
    expect(sentItem.status).toBe('sent');
    expect(sentItem.checked).toBe(true);
    expect(sentItem.bubblePartId).toBe('bubble-id-1');
  });

  it('sets bubblePartId from response.id field', async () => {
    mockFetchOk({ response: { id: 'resp-id-99' } });
    const item = makeItem();
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      const sentCall = onUpdateCart.mock.calls.find(
        ([items]: [CartItem[]]) => items.some(i => i.status === 'sent'),
      );
      expect(sentCall).toBeDefined();
    });

    const sentCall = onUpdateCart.mock.calls.find(
      ([items]: [CartItem[]]) => items.some(i => i.status === 'sent'),
    );
    const sentItem = (sentCall![0] as CartItem[]).find(i => i.id === 'test-1')!;
    expect(sentItem.bubblePartId).toBe('resp-id-99');
  });
});

// ── handleCheck: fetch failure sets error status ──────────────────────────────

describe('handleCheck — fetch failure on send', () => {
  it('calls onUpdateCart with status "error" when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    const item = makeItem();
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      const errorCall = onUpdateCart.mock.calls.find(
        ([items]: [CartItem[]]) => items.some(i => i.status === 'error'),
      );
      expect(errorCall).toBeDefined();
    });
  });

  it('calls onUpdateCart with status "error" when response is not ok (HTTP 500)', async () => {
    mockFetchError(500);
    const item = makeItem();
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      const errorCall = onUpdateCart.mock.calls.find(
        ([items]: [CartItem[]]) => items.some(i => i.status === 'error'),
      );
      expect(errorCall).toBeDefined();
    });

    const errorCall = onUpdateCart.mock.calls.find(
      ([items]: [CartItem[]]) => items.some(i => i.status === 'error'),
    );
    const errorItem = (errorCall![0] as CartItem[]).find(i => i.id === 'test-1')!;
    expect(errorItem.status).toBe('error');
    expect(errorItem.errorMsg).toContain('500');
  });
});

// ── handleCheck: unsend a sent item ──────────────────────────────────────────

describe('handleCheck — unsend a sent item (REMOVE_PART)', () => {
  it('calls fetch to REMOVE_PART with bubblePartId in body', async () => {
    mockFetchOk({});
    const item = makeItem({ status: 'sent', checked: true, bubblePartId: 'abc' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        CONFIG.BUBBLE_API.REMOVE_PART,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.bubble_part_id).toBe('abc');
  });

  it('calls onUpdateCart with status "pending", checked false, bubblePartId undefined on success (200)', async () => {
    mockFetchOk({});
    const item = makeItem({ status: 'sent', checked: true, bubblePartId: 'abc' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      const pendingCall = onUpdateCart.mock.calls.find(
        ([items]: [CartItem[]]) => items.some(i => i.status === 'pending'),
      );
      expect(pendingCall).toBeDefined();
    });

    const pendingCall = onUpdateCart.mock.calls.find(
      ([items]: [CartItem[]]) => items.some(i => i.status === 'pending'),
    );
    const pendingItem = (pendingCall![0] as CartItem[]).find(i => i.id === 'test-1')!;
    expect(pendingItem.status).toBe('pending');
    expect(pendingItem.checked).toBe(false);
    expect(pendingItem.bubblePartId).toBeUndefined();
  });

  it('keeps status "sent" and sets errorMsg when REMOVE_PART returns 500', async () => {
    mockFetchError(500);
    const item = makeItem({ status: 'sent', checked: true, bubblePartId: 'abc' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      // After the error path, should see a call setting status back to 'sent' with errorMsg
      const sentWithError = onUpdateCart.mock.calls.find(
        ([items]: [CartItem[]]) => items.some(i => i.status === 'sent' && i.errorMsg),
      );
      expect(sentWithError).toBeDefined();
    });

    const sentWithError = onUpdateCart.mock.calls.find(
      ([items]: [CartItem[]]) => items.some(i => i.status === 'sent' && i.errorMsg),
    );
    const errorItem = (sentWithError![0] as CartItem[]).find(i => i.id === 'test-1')!;
    expect(errorItem.status).toBe('sent');
    expect(errorItem.errorMsg).toBeDefined();
    expect(errorItem.errorMsg).toContain('500');
  });

  it('does NOT revert to "pending" when REMOVE_PART returns 500', async () => {
    mockFetchError(500);
    const item = makeItem({ status: 'sent', checked: true, bubblePartId: 'abc' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      const sentWithError = onUpdateCart.mock.calls.find(
        ([items]: [CartItem[]]) => items.some(i => i.status === 'sent' && i.errorMsg),
      );
      expect(sentWithError).toBeDefined();
    });

    const anyPendingCall = onUpdateCart.mock.calls.find(
      ([items]: [CartItem[]]) => items.some(i => i.status === 'pending'),
    );
    expect(anyPendingCall).toBeUndefined();
  });
});

// ── handleCheck: skips empty oem ─────────────────────────────────────────────

describe('handleCheck — skips empty oem', () => {
  it('does NOT call fetch when oem is empty string', async () => {
    mockFetchOk();
    const item = makeItem({ oem: '' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    // Checkbox is disabled when oem is empty, so interact directly
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
    // Confirm fetch is not called even if we forcibly fire change
    fireEvent.change(checkbox, { target: { checked: true } });

    await new Promise(r => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does NOT call onUpdateCart with a sent status when oem is blank', async () => {
    mockFetchOk();
    const item = makeItem({ oem: '   ' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await new Promise(r => setTimeout(r, 50));
    const sentCall = onUpdateCart.mock.calls.find(
      ([items]: [CartItem[]]) => items.some(i => i.status === 'sent'),
    );
    expect(sentCall).toBeUndefined();
  });
});

// ── handleCheck: ignores sending items ───────────────────────────────────────

describe('handleCheck — ignores items with status "sending"', () => {
  it('does not call fetch when item status is "sending"', async () => {
    mockFetchOk();
    const item = makeItem({ status: 'sending' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    // Checkbox is disabled for sending items
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();

    fireEvent.click(checkbox);

    await new Promise(r => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not call onUpdateCart when item status is "sending"', async () => {
    mockFetchOk();
    const item = makeItem({ status: 'sending' });
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ cart: [item], onUpdateCart })} />);

    fireEvent.click(screen.getByRole('checkbox'));

    await new Promise(r => setTimeout(r, 50));
    expect(onUpdateCart).not.toHaveBeenCalled();
  });
});

// ── Finish button ─────────────────────────────────────────────────────────────

describe('Finish button', () => {
  it('calls onFinish when the finish button is clicked', () => {
    const onFinish = vi.fn();
    render(<CartState {...defaultProps({ onFinish })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Finish search' }));

    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('does not call onFinish before any interaction', () => {
    const onFinish = vi.fn();
    render(<CartState {...defaultProps({ onFinish })} />);

    expect(onFinish).not.toHaveBeenCalled();
  });

  it('calls onFinish on each click', () => {
    const onFinish = vi.fn();
    render(<CartState {...defaultProps({ onFinish })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Finish search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish search' }));

    expect(onFinish).toHaveBeenCalledTimes(2);
  });
});

// ── Crop button ───────────────────────────────────────────────────────────────

describe('Crop button', () => {
  it('calls onCrop when the crop button is clicked', () => {
    const onCrop = vi.fn();
    render(<CartState {...defaultProps({ onCrop })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Crop selection' }));

    expect(onCrop).toHaveBeenCalledOnce();
  });
});

// ── Footer scan button ────────────────────────────────────────────────────────

describe('Footer scan button', () => {
  it('calls onScan when the footer scan button is clicked', () => {
    const onScan = vi.fn();
    render(<CartState {...defaultProps({ onScan })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Scan page' }));

    expect(onScan).toHaveBeenCalledOnce();
  });
});

// ── Cart item rendering ───────────────────────────────────────────────────────

describe('CartState cart item rendering', () => {
  it('renders item name', () => {
    render(<CartState {...defaultProps({ cart: [makeItem({ name: 'Oil filter' })] })} />);
    expect(screen.getByText('Oil filter')).toBeInTheDocument();
  });

  it('renders "missing" when oem is empty', () => {
    render(<CartState {...defaultProps({ cart: [makeItem({ oem: '' })] })} />);
    expect(screen.getByText('missing')).toBeInTheDocument();
  });

  it('shows "Sending…" label while status is sending', () => {
    render(<CartState {...defaultProps({ cart: [makeItem({ status: 'sending' })] })} />);
    expect(screen.getByText('Sending…')).toBeInTheDocument();
  });

  it('shows "✓ Sent" label when status is sent', () => {
    render(<CartState {...defaultProps({ cart: [makeItem({ status: 'sent', checked: true })] })} />);
    expect(screen.getByText('✓ Sent')).toBeInTheDocument();
  });

  it('shows errorMsg when status is error', () => {
    render(<CartState {...defaultProps({ cart: [makeItem({ status: 'error', errorMsg: 'Fetch failed' })] })} />);
    expect(screen.getByText('Fetch failed')).toBeInTheDocument();
  });

  it('renders multiple items', () => {
    const items = [
      makeItem({ id: 'a', name: 'Part A' }),
      makeItem({ id: 'b', name: 'Part B' }),
    ];
    render(<CartState {...defaultProps({ cart: items })} />);
    expect(screen.getByText('Part A')).toBeInTheDocument();
    expect(screen.getByText('Part B')).toBeInTheDocument();
  });
});

// ── Clear unsent dialog ───────────────────────────────────────────────────────

describe('Clear unsent button and confirm dialog', () => {
  it('shows confirmation dialog when there are unsent items', () => {
    const items = [makeItem({ status: 'pending' })];
    render(<CartState {...defaultProps({ cart: items })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear unsent' }));

    expect(screen.getByText(/Remove 1 unsent part\?/)).toBeInTheDocument();
  });

  it('calls onUpdateCart keeping only sent items when confirmed', async () => {
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    const items = [
      makeItem({ id: 'a', status: 'pending' }),
      makeItem({ id: 'b', status: 'sent', checked: true }),
    ];
    const { container } = render(<CartState {...defaultProps({ cart: items, onUpdateCart })} />);

    // Open the dialog — footer "Clear unsent" is the only one at this point
    fireEvent.click(screen.getByRole('button', { name: 'Clear unsent' }));

    // Dialog is rendered as an absolute overlay. Click its "Clear unsent" button
    // by querying within the overlay element specifically.
    const dialogBtn = container.querySelector('.absolute button:last-child') as HTMLElement;
    expect(dialogBtn).not.toBeNull();
    fireEvent.click(dialogBtn);

    await waitFor(() => {
      expect(onUpdateCart).toHaveBeenCalled();
    });

    const lastCall = onUpdateCart.mock.calls.at(-1)![0] as CartItem[];
    expect(lastCall.every(i => i.status === 'sent' || i.status === 'sending')).toBe(true);
    expect(lastCall.find(i => i.id === 'a')).toBeUndefined();
    expect(lastCall.find(i => i.id === 'b')).toBeDefined();
  });
});

// ── Manual add form ───────────────────────────────────────────────────────────

describe('Manual add part form', () => {
  it('shows the form when "+ Add part manually" is clicked', () => {
    render(<CartState {...defaultProps()} />);

    fireEvent.click(screen.getByText('+ Add part manually'));

    expect(screen.getByPlaceholderText('Part name')).toBeInTheDocument();
  });

  it('hides form on cancel', () => {
    render(<CartState {...defaultProps()} />);

    fireEvent.click(screen.getByText('+ Add part manually'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByPlaceholderText('Part name')).not.toBeInTheDocument();
  });

  it('calls onUpdateCart with new item on submit', async () => {
    const onUpdateCart = vi.fn().mockResolvedValue(undefined);
    render(<CartState {...defaultProps({ onUpdateCart })} />);

    fireEvent.click(screen.getByText('+ Add part manually'));

    fireEvent.change(screen.getByPlaceholderText('Part name'), {
      target: { value: 'Air filter' },
    });
    fireEvent.change(screen.getByPlaceholderText('Part number'), {
      target: { value: 'AF-999' },
    });

    fireEvent.submit(screen.getByPlaceholderText('Part name').closest('form')!);

    await waitFor(() => {
      expect(onUpdateCart).toHaveBeenCalledOnce();
    });

    const [newCart] = onUpdateCart.mock.calls[0] as [CartItem[]];
    expect(newCart).toHaveLength(1);
    expect(newCart[0].name).toBe('Air filter');
    expect(newCart[0].oem).toBe('AF-999');
    expect(newCart[0].status).toBe('pending');
  });
});
