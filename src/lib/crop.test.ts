import { describe, it, expect } from 'vitest';
import { canCropOn, supplierNoticeFor } from '@lib/crop';

describe('canCropOn', () => {
  it('accepts supplier web pages', () => {
    expect(canCropOn('https://www.molco.nl/onderdelen/123')).toBe(true);
    expect(canCropOn('http://shop.example.com/')).toBe(true);
  });
  it('skips Autoflex, so the open work order stays usable while cropping', () => {
    expect(canCropOn('https://evo.autoflex10.work/autoflex/solution/autoflex_cloud/index.html')).toBe(false);
    expect(canCropOn('https://autoflex10.eu/')).toBe(false);
  });
  it('skips pages an extension cannot draw on', () => {
    expect(canCropOn('chrome://extensions/')).toBe(false);
    expect(canCropOn('https://chromewebstore.google.com/detail/x')).toBe(false);
    expect(canCropOn('')).toBe(false);
    expect(canCropOn(undefined)).toBe(false);
  });
});

describe('supplierNoticeFor', () => {
  const autoflex = 'https://evo.autoflex10.work/autoflex/solution/autoflex_cloud/index.html';
  it('says nothing on a supplier page', () => {
    expect(supplierNoticeFor('crop', 'https://www.molco.nl/onderdelen/123')).toBeNull();
    expect(supplierNoticeFor('scan', 'https://www.molco.nl/onderdelen/123')).toBeNull();
  });
  it('asks to switch to the supplier tab when Crop is clicked on Autoflex', () => {
    expect(supplierNoticeFor('crop', autoflex)).toBe('cropWaiting');
  });
  it('blocks Scan on Autoflex and browser pages', () => {
    expect(supplierNoticeFor('scan', autoflex)).toBe('scanNeedsSupplier');
    expect(supplierNoticeFor('scan', 'chrome://newtab/')).toBe('scanNeedsSupplier');
  });
});
