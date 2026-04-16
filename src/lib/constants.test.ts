// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { CONFIG } from '@lib/constants';

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Extract the version slug embedded in BUBBLE_BASE_URL */
const versionSlug = CONFIG.BUBBLE_BASE_URL.replace(CONFIG.BUBBLE_ORIGIN + '/', '');

describe('CONFIG.BUBBLE_BASE_URL', () => {
  it('starts with BUBBLE_ORIGIN', () => {
    expect(CONFIG.BUBBLE_BASE_URL.startsWith(CONFIG.BUBBLE_ORIGIN)).toBe(true);
  });

  it('contains a non-empty version slug after the origin', () => {
    expect(versionSlug.length).toBeGreaterThan(0);
  });
});

describe('CONFIG.BUBBLE_API — version consistency', () => {
  const apiEntries = Object.entries(CONFIG.BUBBLE_API) as [string, string][];

  it.each(apiEntries)('%s contains the same version slug as BUBBLE_BASE_URL', (_key, url) => {
    expect(url).toContain(versionSlug);
  });
});

describe('CONFIG.BUBBLE_API — origin prefix', () => {
  const apiEntries = Object.entries(CONFIG.BUBBLE_API) as [string, string][];

  it.each(apiEntries)('%s starts with BUBBLE_ORIGIN', (_key, url) => {
    expect(url.startsWith(CONFIG.BUBBLE_ORIGIN)).toBe(true);
  });
});

describe('CONFIG.SCREENSHOT_QUALITY', () => {
  it('is a number between 0 and 100 (inclusive)', () => {
    expect(CONFIG.SCREENSHOT_QUALITY).toBeGreaterThanOrEqual(0);
    expect(CONFIG.SCREENSHOT_QUALITY).toBeLessThanOrEqual(100);
  });
});

describe('CONFIG.STORAGE_KEYS', () => {
  const keyEntries = Object.entries(CONFIG.STORAGE_KEYS) as [string, string][];

  it.each(keyEntries)('%s is a non-empty string', (_key, value) => {
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  });

  it('has no duplicate values', () => {
    const values = Object.values(CONFIG.STORAGE_KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('CONFIG.BUBBLE_PAGES', () => {
  const pageEntries = Object.entries(CONFIG.BUBBLE_PAGES) as [string, string][];

  it.each(pageEntries)('%s path starts with /', (_key, path) => {
    expect(path.startsWith('/')).toBe(true);
  });

  it.each(pageEntries)('%s path is a non-empty string', (_key, path) => {
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(1);
  });
});
