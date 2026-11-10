import { describe, it, expect } from 'vitest';
import { canCropOn } from '@lib/crop';

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
