import { describe, it, expect } from 'vitest';
import { isAutoflexUrl, parseOrderNumber, findOpenOrderNumber } from '@lib/autoflex';

describe('isAutoflexUrl', () => {
  it('accepts the Autoflex hosts (test and production)', () => {
    expect(isAutoflexUrl('https://evo.autoflex10.work/autoflex/solution/autoflex_cloud/index.html#svy_nav_fr_p_main_autoflex')).toBe(true);
    expect(isAutoflexUrl('https://app.autoflex10.nl/werkorders')).toBe(true);
    expect(isAutoflexUrl('https://autoflex10.nl/')).toBe(true);
  });
  it('rejects other hosts and invalid input', () => {
    expect(isAutoflexUrl('https://app.parts-iq.com/x')).toBe(false);
    expect(isAutoflexUrl('https://autoflex10.nl.evil.com/')).toBe(false);
    expect(isAutoflexUrl('not a url')).toBe(false);
    expect(isAutoflexUrl(undefined)).toBe(false);
  });
});

describe('parseOrderNumber', () => {
  it('reads the order number from the work order header', () => {
    expect(parseOrderNumber('20240018 | 98-ZPZ-7 | HYUNDAI I 10')).toBe('20240018');
    expect(parseOrderNumber('  20240018 |98-ZPZ-7')).toBe('20240018');
  });
  it('returns null for other texts', () => {
    expect(parseOrderNumber('Werkorders')).toBeNull();
    expect(parseOrderNumber('18-07-2024 | test')).toBeNull();
    expect(parseOrderNumber('')).toBeNull();
  });
});

function page(html: string): Document {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.innerHTML = html;
  return doc;
}
const visible = () => true;

describe('findOpenOrderNumber', () => {
  it('finds the number in the open work order form', () => {
    const doc = page('<svy-form name="orders_dtl"><div data-afl="orders_dtl.title_label"><span><span>20240018 | 98-ZPZ-7 | HYUNDAI I 10</span></span></div></svy-form>');
    expect(findOpenOrderNumber(doc, visible)).toBe('20240018');
  });
  it('ignores headers outside the work order form', () => {
    const doc = page('<svy-form name="relations_dtl"><div data-afl="orders_dtl.title_label">20240018 | Bakker</div></svy-form>');
    expect(findOpenOrderNumber(doc, visible)).toBeNull();
  });
  it('ignores a work order form that is no longer visible', () => {
    const doc = page('<svy-form name="orders_dtl"><div data-afl="orders_dtl.title_label">20240018 | 98-ZPZ-7</div></svy-form>');
    expect(findOpenOrderNumber(doc, () => false)).toBeNull();
  });
  it('ignores other labels in the work order form', () => {
    const doc = page('<svy-form name="orders_dtl"><span>20240018 | 98-ZPZ-7</span></svy-form>');
    expect(findOpenOrderNumber(doc, visible)).toBeNull();
  });
  it('returns null on the work order list', () => {
    const doc = page('<svy-form name="orders_tbl"><span>20240018</span></svy-form>');
    expect(findOpenOrderNumber(doc, visible)).toBeNull();
  });
});
