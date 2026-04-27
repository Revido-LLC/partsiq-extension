// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AiPart } from '@lib/ai';
import type { CartItem } from '@types/parts';
import { aiPartsToCartItems, mergeCart } from './cart-utils';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAiPart(overrides: Partial<AiPart> = {}): AiPart {
  return {
    name: 'Oil Filter',
    oem: 'PH3614',
    price: 12.5,
    delivery_days: 2,
    stock: 10,
    supplier: 'SupplierX',
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'fixed-id-1',
    name: 'Oil Filter',
    oem: 'PH3614',
    price: 12.5,
    deliveryDays: 2,
    stock: 10,
    supplier: 'SupplierX',
    sourceUrl: 'https://example.com/page',
    scannedAt: '2026-04-16T00:00:00.000Z',
    status: 'pending',
    checked: false,
    autoSend: false,
    ...overrides,
  };
}

// ── mergeCart ─────────────────────────────────────────────────────────────

describe('mergeCart', () => {
  it('concatenates existing and incoming, existing first', () => {
    const existing = [makeCartItem({ id: 'a' }), makeCartItem({ id: 'b' })];
    const incoming = [makeCartItem({ id: 'c' })];

    const result = mergeCart(existing, incoming);

    expect(result.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns incoming when existing is empty', () => {
    const incoming = [makeCartItem({ id: '1' })];

    const result = mergeCart([], incoming);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns existing when incoming is empty', () => {
    const existing = [makeCartItem({ id: '1' })];

    const result = mergeCart(existing, []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when both are empty', () => {
    expect(mergeCart([], [])).toEqual([]);
  });

  it('does not mutate existing or incoming', () => {
    const existing = [makeCartItem({ id: 'a' })];
    const incoming = [makeCartItem({ id: 'b' })];

    mergeCart(existing, incoming);

    expect(existing).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });
});

// ── aiPartsToCartItems ────────────────────────────────────────────────────

describe('aiPartsToCartItems', () => {
  const SOURCE_URL = 'https://supplier.com/product';
  const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const FIXED_ISO = '2026-04-16T12:00:00.000Z';

  beforeEach(() => {
    // Deterministic crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => FIXED_UUID),
    });
    // Deterministic scannedAt timestamp
    vi.setSystemTime(new Date(FIXED_ISO));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('maps all AiPart fields to CartItem fields correctly', () => {
    const parts = [makeAiPart()];

    const result = aiPartsToCartItems(parts, SOURCE_URL);

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.name).toBe('Oil Filter');
    expect(item.oem).toBe('PH3614');
    expect(item.price).toBe(12.5);
    expect(item.deliveryDays).toBe(2);
    expect(item.stock).toBe(10);
    expect(item.supplier).toBe('SupplierX');
    expect(item.sourceUrl).toBe(SOURCE_URL);
    expect(item.scannedAt).toBe(FIXED_ISO);
  });

  it('sets status to pending and checked to false by default', () => {
    const result = aiPartsToCartItems([makeAiPart()], SOURCE_URL);

    expect(result[0].status).toBe('pending');
    expect(result[0].checked).toBe(false);
    expect(result[0].autoSend).toBe(false);
  });

  it('sets checked=true and autoSend=true when autoSend=true', () => {
    const result = aiPartsToCartItems([makeAiPart()], SOURCE_URL, true);

    expect(result[0].checked).toBe(true);
    expect(result[0].autoSend).toBe(true);
    expect(result[0].status).toBe('pending');
  });

  it('defaults null oem to empty string', () => {
    const result = aiPartsToCartItems([makeAiPart({ oem: null as unknown as string })], SOURCE_URL);

    expect(result[0].oem).toBe('');
  });

  it('defaults null supplier to empty string', () => {
    const result = aiPartsToCartItems(
      [makeAiPart({ supplier: null as unknown as string })],
      SOURCE_URL,
    );

    expect(result[0].supplier).toBe('');
  });

  it('preserves null price, deliveryDays and stock as-is', () => {
    const part = makeAiPart({ price: null, delivery_days: null, stock: null });
    const result = aiPartsToCartItems([part], SOURCE_URL);

    expect(result[0].price).toBeNull();
    expect(result[0].deliveryDays).toBeNull();
    expect(result[0].stock).toBeNull();
  });

  it('assigns a unique id to each item via crypto.randomUUID', () => {
    // Use real sequential UUIDs for uniqueness test
    vi.restoreAllMocks();
    vi.useRealTimers();
    let counter = 0;
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${++counter}`),
    });

    const parts = [makeAiPart({ name: 'Part A' }), makeAiPart({ name: 'Part B' })];
    const result = aiPartsToCartItems(parts, SOURCE_URL);

    expect(result[0].id).toBe('uuid-1');
    expect(result[1].id).toBe('uuid-2');
    expect(result[0].id).not.toBe(result[1].id);
  });

  it('returns an empty array when given no parts', () => {
    const result = aiPartsToCartItems([], SOURCE_URL);

    expect(result).toEqual([]);
  });

  it('maps multiple parts preserving order', () => {
    const parts = [
      makeAiPart({ name: 'Part A' }),
      makeAiPart({ name: 'Part B' }),
      makeAiPart({ name: 'Part C' }),
    ];

    const result = aiPartsToCartItems(parts, SOURCE_URL);

    expect(result).toHaveLength(3);
    expect(result.map(i => i.name)).toEqual(['Part A', 'Part B', 'Part C']);
  });

  it('attaches the correct sourceUrl to every item', () => {
    const parts = [makeAiPart({ name: 'A' }), makeAiPart({ name: 'B' })];
    const result = aiPartsToCartItems(parts, SOURCE_URL);

    result.forEach(item => expect(item.sourceUrl).toBe(SOURCE_URL));
  });
});
