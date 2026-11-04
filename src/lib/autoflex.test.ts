import { describe, it, expect } from 'vitest';
import { isAutoflexUrl, parseWorkOrderId } from '@lib/autoflex';

const WO = '85A1258A-BFA9-43E1-B4A4-7FC9F22BBA06';

describe('isAutoflexUrl', () => {
  it('accepts the Autoflex host', () => {
    expect(isAutoflexUrl('https://app.autoflex10.nl/werkorders')).toBe(true);
  });
  it('rejects other hosts and invalid input', () => {
    expect(isAutoflexUrl('https://app.parts-iq.com/x')).toBe(false);
    expect(isAutoflexUrl('not a url')).toBe(false);
    expect(isAutoflexUrl(undefined)).toBe(false);
  });
});

describe('parseWorkOrderId', () => {
  it('finds the GUID in the path', () => {
    expect(parseWorkOrderId(`https://app.autoflex10.nl/werkorders/${WO}`)).toBe(WO);
  });
  it('finds the GUID in the query string and upper-cases it', () => {
    expect(parseWorkOrderId(`https://app.autoflex10.nl/order?id=${WO.toLowerCase()}`)).toBe(WO);
  });
  it('finds the GUID in the hash', () => {
    expect(parseWorkOrderId(`https://app.autoflex10.nl/#/orders/${WO}/lines`)).toBe(WO);
  });
  it('returns null on list pages without an id', () => {
    expect(parseWorkOrderId('https://app.autoflex10.nl/werkorders')).toBeNull();
  });
  it('returns null on non-Autoflex hosts even with a GUID', () => {
    expect(parseWorkOrderId(`https://example.com/${WO}`)).toBeNull();
  });
});
