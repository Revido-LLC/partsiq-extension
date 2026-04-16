// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CONFIG } from '@lib/constants';
import type { CartItem, Vehicle, Order } from '@types/parts';

const K = CONFIG.STORAGE_KEYS;

// ---------------------------------------------------------------------------
// Chrome storage mock
// ---------------------------------------------------------------------------
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

vi.stubGlobal('chrome', chromeMock);

// Helpers to keep mocks concise
const mockGet = (result: Record<string, unknown>) =>
  chromeMock.storage.local.get.mockResolvedValue(result);
const mockSet = () =>
  chromeMock.storage.local.set.mockResolvedValue(undefined);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TODAY = new Date().toISOString().slice(0, 10);
const STALE_DATE = '2000-01-01';

const sampleCartItem: CartItem = {
  id: 'item-1',
  name: 'Brake Pad',
  oem: 'OEM-123',
  price: 29.99,
  deliveryDays: 2,
  stock: 5,
  supplier: 'SupplierA',
  sourceUrl: 'https://example.com/part/1',
  scannedAt: new Date().toISOString(),
  status: 'pending',
  checked: false,
};

const sampleVehicle: Vehicle = { plate: 'AB-123-CD', id: 'vehicle-42' };
const sampleOrder: Order = { plate: 'XY-999-ZZ', id: 'order-7' };

// ---------------------------------------------------------------------------
// Import module under test AFTER stubbing globals so chrome is available
// ---------------------------------------------------------------------------
const {
  getAuthStatus,
  setAuthStatus,
  getLang,
  setLang,
  getWorkMode,
  setWorkMode,
  getVehicle,
  setVehicle,
  getOrder,
  setOrder,
  getAutoflex,
  setAutoflex,
  getCart,
  setCart,
} = await import('@lib/storage');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAuthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('returns stored value when true', async () => {
    mockGet({ [K.AUTH_STATUS]: true });
    expect(await getAuthStatus()).toBe(true);
  });

  it('returns false when key is absent', async () => {
    mockGet({});
    expect(await getAuthStatus()).toBe(false);
  });
});

describe('setAuthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('calls chrome.storage.local.set with the correct key and value', async () => {
    await setAuthStatus(true);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.AUTH_STATUS]: true,
    });
  });
});

describe('getLang', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('returns stored lang', async () => {
    mockGet({ [K.LANG]: 'nl' });
    expect(await getLang()).toBe('nl');
  });

  it('defaults to "en" when key is absent', async () => {
    mockGet({});
    expect(await getLang()).toBe('en');
  });
});

describe('setLang', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('calls set with correct key', async () => {
    await setLang('nl');
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.LANG]: 'nl',
    });
  });
});

describe('getWorkMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('returns stored work mode', async () => {
    mockGet({ [K.WORK_MODE]: 'order' });
    expect(await getWorkMode()).toBe('order');
  });

  it('defaults to "vehicle" when key is absent', async () => {
    mockGet({});
    expect(await getWorkMode()).toBe('vehicle');
  });
});

describe('setWorkMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('calls set with correct key', async () => {
    await setWorkMode('order');
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.WORK_MODE]: 'order',
    });
  });
});

describe('getVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('returns stored vehicle', async () => {
    mockGet({ [K.VEHICLE]: sampleVehicle });
    expect(await getVehicle()).toEqual(sampleVehicle);
  });

  it('returns null when key is absent', async () => {
    mockGet({});
    expect(await getVehicle()).toBeNull();
  });
});

describe('setVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('calls set with correct key and value', async () => {
    await setVehicle(sampleVehicle);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.VEHICLE]: sampleVehicle,
    });
  });

  it('stores null to clear vehicle', async () => {
    await setVehicle(null);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.VEHICLE]: null,
    });
  });
});

describe('getOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('returns stored order', async () => {
    mockGet({ [K.ORDER]: sampleOrder });
    expect(await getOrder()).toEqual(sampleOrder);
  });

  it('returns null when key is absent', async () => {
    mockGet({});
    expect(await getOrder()).toBeNull();
  });
});

describe('setOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('calls set with correct key and value', async () => {
    await setOrder(sampleOrder);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.ORDER]: sampleOrder,
    });
  });

  it('stores null to clear order', async () => {
    await setOrder(null);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.ORDER]: null,
    });
  });
});

describe('getAutoflex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('returns stored value when true', async () => {
    mockGet({ [K.AUTOFLEX]: true });
    expect(await getAutoflex()).toBe(true);
  });

  it('defaults to false when key is absent', async () => {
    mockGet({});
    expect(await getAutoflex()).toBe(false);
  });
});

describe('setAutoflex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('calls set with correct key', async () => {
    await setAutoflex(true);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.AUTOFLEX]: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Cart — core business logic
// ---------------------------------------------------------------------------

describe('getCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('returns stored items when cart date matches today', async () => {
    mockGet({ [K.CART]: [sampleCartItem], [K.CART_DATE]: TODAY });
    const result = await getCart();
    expect(result).toEqual([sampleCartItem]);
    // set must NOT have been called (no reset needed)
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  it('returns [] and clears the cart when cart date is stale', async () => {
    mockGet({ [K.CART]: [sampleCartItem], [K.CART_DATE]: STALE_DATE });
    const result = await getCart();
    expect(result).toEqual([]);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.CART]: [],
      [K.CART_DATE]: TODAY,
    });
  });

  it('returns [] and resets when cart date is absent', async () => {
    mockGet({ [K.CART]: [sampleCartItem] });
    const result = await getCart();
    expect(result).toEqual([]);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.CART]: [],
      [K.CART_DATE]: TODAY,
    });
  });

  it('returns [] when both cart and date are absent', async () => {
    mockGet({});
    const result = await getCart();
    expect(result).toEqual([]);
  });

  it('returns empty array (not undefined) when cart key is missing but date matches today', async () => {
    mockGet({ [K.CART_DATE]: TODAY });
    const result = await getCart();
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('setCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet();
  });

  it('stores items with today\'s date', async () => {
    await setCart([sampleCartItem]);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.CART]: [sampleCartItem],
      [K.CART_DATE]: TODAY,
    });
  });

  it('stores an empty array with today\'s date', async () => {
    await setCart([]);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.CART]: [],
      [K.CART_DATE]: TODAY,
    });
  });

  it('stores multiple items', async () => {
    const secondItem: CartItem = { ...sampleCartItem, id: 'item-2', name: 'Oil Filter' };
    await setCart([sampleCartItem, secondItem]);
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      [K.CART]: [sampleCartItem, secondItem],
      [K.CART_DATE]: TODAY,
    });
  });
});
