import { describe, it, expect } from 'vitest';
import { isAutoflexUrl, parseOrderNumber, parseOrderPlate, findOpenOrderNumber, findOpenOrderPlate, createPageOffsetter, orderForOpenWorkOrder } from '@lib/autoflex';

describe('isAutoflexUrl', () => {
  it('accepts the Autoflex hosts (test and production)', () => {
    expect(isAutoflexUrl('https://evo.autoflex10.work/autoflex/solution/autoflex_cloud/index.html#svy_nav_fr_p_main_autoflex')).toBe(true);
    expect(isAutoflexUrl('https://app.autoflex10.nl/werkorders')).toBe(true);
    expect(isAutoflexUrl('https://autoflex10.nl/')).toBe(true);
    expect(isAutoflexUrl('https://autoflex10.eu/')).toBe(true);
    expect(isAutoflexUrl('https://app.autoflex10.eu/autoflex/solution/autoflex_cloud/index.html')).toBe(true);
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

describe('parseOrderPlate', () => {
  it('reads the plate from the work order header', () => {
    expect(parseOrderPlate('20240135 | 07-XXH-3 | VOLKSWAGEN UP')).toBe('07-XXH-3');
    expect(parseOrderPlate('  20240018 |98-ZPZ-7')).toBe('98-ZPZ-7');
  });
  it('returns empty without a plate or for other texts', () => {
    expect(parseOrderPlate('20240018 |  | HYUNDAI')).toBe('');
    expect(parseOrderPlate('20240018')).toBe('');
    expect(parseOrderPlate('18-07-2024 | test')).toBe('');
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
    expect(findOpenOrderPlate(doc, visible)).toBe('98-ZPZ-7');
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

describe('createPageOffsetter', () => {
  it('shifts #mainForm down and restores top:0 (never top:auto)', () => {
    const doc = page('<div id="mainForm" style="position:absolute; inset:0px;"></div>');
    const main = doc.getElementById('mainForm')!;
    const offset = createPageOffsetter(doc);
    offset(48);
    expect(main.style.top).toBe('48px');
    offset(0);
    expect(main.style.top).toBe('0px');
  });
  it('can be applied repeatedly and still restores the original value', () => {
    const doc = page('<div id="mainForm" style="position:absolute; top:10px;"></div>');
    const main = doc.getElementById('mainForm')!;
    const offset = createPageOffsetter(doc);
    offset(48);
    offset(48);
    offset(0);
    expect(main.style.top).toBe('10px');
  });
  it('falls back to body padding when there is no #mainForm', () => {
    const doc = page('<p>x</p>');
    doc.body.style.paddingTop = '5px';
    const offset = createPageOffsetter(doc);
    offset(48);
    expect(doc.body.style.paddingTop).toBe('48px');
    offset(0);
    expect(doc.body.style.paddingTop).toBe('5px');
  });
});

describe('orderForOpenWorkOrder', () => {
  it('returns null when no work order is open in Autoflex', () => {
    expect(orderForOpenWorkOrder({ id: 'A', plate: '1-AB-23' }, null)).toBeNull();
  });
  it('returns null when the extension already uses the open work order (any case)', () => {
    expect(orderForOpenWorkOrder({ id: '6c7f2af6-aaaa', plate: '1-AB-23' }, '6C7F2AF6-AAAA')).toBeNull();
  });
  it('switches to the open work order when the extension has another one', () => {
    expect(orderForOpenWorkOrder({ id: 'OLD', plate: '1-AB-23' }, 'NEW')).toEqual({ id: 'NEW', plate: '' });
  });
  it('switches to the open work order when the extension has none', () => {
    expect(orderForOpenWorkOrder(null, 'NEW')).toEqual({ id: 'NEW', plate: '' });
  });
  it('carries the plate reported by the Autoflex banner', () => {
    expect(orderForOpenWorkOrder({ id: 'OLD', plate: '1-AB-23' }, 'NEW', '98-ZPZ-7')).toEqual({ id: 'NEW', plate: '98-ZPZ-7' });
  });
  it('fills in a missing plate on the same work order', () => {
    expect(orderForOpenWorkOrder({ id: 'a', plate: '' }, 'A', '98-ZPZ-7')).toEqual({ id: 'a', plate: '98-ZPZ-7' });
  });
  it('keeps a plate the order already has', () => {
    expect(orderForOpenWorkOrder({ id: 'A', plate: '1-AB-23' }, 'A', '98-ZPZ-7')).toBeNull();
  });
});
