import { describe, it, expect } from 'vitest';
import { isAutoflexUrl, parseOrderNumber, parseOrderPlate, findOpenOrderNumber, findOpenOrderPlate, createPageOffsetter, orderForOpenWorkOrder, workModeAfterLogin, pickOpenWorkOrder, shouldReturnToWorkOrder, isRepeatedWorkOrder, takePendingSearch, PENDING_SEARCH_TTL_MS, shouldForgetTabWorkOrder, shouldShowPanelHeader, autoflexContentScriptFiles, bannerHeightFor } from '@lib/autoflex';

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

describe('workModeAfterLogin', () => {
  // Bubble reports autoflex_connected per user; the open work order is per tab (from the banner)
  it('is order mode when a work order is open in Autoflex, even if Bubble says Autoflex is not connected', () => {
    expect(workModeAfterLogin(false, 'C5AB2A62-FF20-48A2-90B2-8C6771B3A766')).toBe('order');
  });
  it('is order mode when Autoflex is connected', () => {
    expect(workModeAfterLogin(true, null)).toBe('order');
    expect(workModeAfterLogin(true, 'C5AB2A62-FF20-48A2-90B2-8C6771B3A766')).toBe('order');
  });
  it('is vehicle mode without an open work order and without Autoflex', () => {
    expect(workModeAfterLogin(false, null)).toBe('vehicle');
    expect(workModeAfterLogin(false, '')).toBe('vehicle');
  });
});

describe('pickOpenWorkOrder', () => {
  const map = { '1': 'WO-A', '2': 'WO-B' };
  it('uses the active tab when it has a work order', () => expect(pickOpenWorkOrder(map, 2, 1)).toBe('WO-B'));
  it('prefers the last used Autoflex tab', () => expect(pickOpenWorkOrder(map, 9, 2)).toBe('WO-B'));
  it('falls back to another tab only when there is no last Autoflex tab', () => expect(pickOpenWorkOrder({ '1': 'WO-A' }, 9, undefined)).toBe('WO-A'));
  it('keeps the last Autoflex tab empty instead of jumping to another tab', () =>
    expect(pickOpenWorkOrder({ '1': 'WO-A' }, 9, 2)).toBeNull());
  it('returns null when no tab has a work order', () => expect(pickOpenWorkOrder({}, 9, 2)).toBeNull());
});

describe('shouldReturnToWorkOrder', () => {
  it('returns from the selection screen', () =>
    expect(shouldReturnToWorkOrder({ state: 'idle', vehicleExpanded: true, activeWo: 'WO-A' })).toBe(true));
  it('stays put mid-flow', () => {
    for (const state of ['cart', 'scanning', 'fallback', 'finish'])
      expect(shouldReturnToWorkOrder({ state, vehicleExpanded: false, activeWo: 'WO-A' })).toBe(false);
    expect(shouldReturnToWorkOrder({ state: 'idle', vehicleExpanded: false, activeWo: 'WO-A' })).toBe(false);
  });
  it('needs an open work order', () =>
    expect(shouldReturnToWorkOrder({ state: 'idle', vehicleExpanded: true, activeWo: null })).toBe(false));
});

describe('isRepeatedWorkOrder', () => {
  it('ignores a re-broadcast of the work order already shown', () =>
    expect(isRepeatedWorkOrder('WO-A', { workOrderId: 'wo-a', search: false })).toBe(true));
  it('keeps an explicit search request', () =>
    expect(isRepeatedWorkOrder('WO-A', { workOrderId: 'WO-A', search: true })).toBe(false));
  it('handles a different or closed work order', () => {
    expect(isRepeatedWorkOrder('WO-A', { workOrderId: 'WO-B' })).toBe(false);
    expect(isRepeatedWorkOrder('WO-A', { workOrderId: null })).toBe(false);
    expect(isRepeatedWorkOrder(null, { workOrderId: null })).toBe(true);
  });
});

describe('takePendingSearch', () => {
  const now = 1_000_000;
  it('hands the banner search to the panel that opens for the same work order', () =>
    expect(takePendingSearch({ workOrderId: 'WO-A', at: now - 2000 }, 'wo-a', now)).toBe(true));
  it('ignores a search for another work order', () =>
    expect(takePendingSearch({ workOrderId: 'WO-A', at: now }, 'WO-B', now)).toBe(false));
  it('ignores a stale search (panel opened much later by hand)', () =>
    expect(takePendingSearch({ workOrderId: 'WO-A', at: now - PENDING_SEARCH_TTL_MS - 1 }, 'WO-A', now)).toBe(false));
  it('handles no pending search or no work order', () => {
    expect(takePendingSearch(undefined, 'WO-A', now)).toBe(false);
    expect(takePendingSearch({ workOrderId: 'WO-A', at: now }, null, now)).toBe(false);
  });
});

describe('shouldForgetTabWorkOrder', () => {
  it('forgets the work order when its tab reloads or navigates', () =>
    expect(shouldForgetTabWorkOrder({ status: 'loading' }, true)).toBe(true));
  it('keeps it otherwise', () => {
    expect(shouldForgetTabWorkOrder({ status: 'complete' }, true)).toBe(false);
    expect(shouldForgetTabWorkOrder({ status: 'loading' }, false)).toBe(false);
  });
});

describe('shouldShowPanelHeader', () => {
  it('shows the header once an order or vehicle is chosen', () =>
    expect(shouldShowPanelHeader({ vehicleExpanded: false, activeWo: null })).toBe(true));
  it('hides it for a crop started from the selection screen', () =>
    expect(shouldShowPanelHeader({ vehicleExpanded: true, activeWo: null })).toBe(false));
  it('keeps it when an Autoflex work order is open (back link)', () =>
    expect(shouldShowPanelHeader({ vehicleExpanded: true, activeWo: 'WO-A' })).toBe(true));
});

describe('autoflexContentScriptFiles', () => {
  const scripts = [
    { matches: ['<all_urls>'], js: ['assets/index.js'] },
    { matches: ['https://*.autoflex10.eu/*', 'https://*.autoflex10.work/*'], js: ['assets/autoflex.js'] },
  ];
  it('picks the Autoflex entry from the built manifest', () =>
    expect(autoflexContentScriptFiles(scripts)).toEqual(['assets/autoflex.js']));
  it('returns nothing when there is no Autoflex entry', () =>
    expect(autoflexContentScriptFiles([scripts[0]])).toEqual([]));
  it('handles a missing list', () => expect(autoflexContentScriptFiles(undefined)).toEqual([]));
});

describe('bannerHeightFor', () => {
  it('shows the banner at the height it asks for', () => expect(bannerHeightFor(false, 48)).toBe(48));
  it('keeps a dismissed banner invisible: it still loads to report the work order', () =>
    expect(bannerHeightFor(true, 48)).toBe(0));
  it('clamps odd heights', () => {
    expect(bannerHeightFor(false, 900)).toBe(200);
    expect(bannerHeightFor(false, -5)).toBe(0);
  });
});
