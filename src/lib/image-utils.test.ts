// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { dataUrlToBlob } from './image-utils';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal but valid data URL from a mime type and raw byte string.
 * Keeps tests self-contained without importing real image fixtures.
 */
function makeDataUrl(mime: string, payload: string): string {
  return `data:${mime};base64,${btoa(payload)}`;
}

// A small fixed payload used wherever only size/content matters.
const PAYLOAD = 'hello-world-bytes';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('dataUrlToBlob', () => {
  // ── MIME type extraction ──────────────────────────────────────────────

  describe('mime type extraction', () => {
    it('extracts image/png from a PNG data URL', () => {
      const dataUrl = makeDataUrl('image/png', PAYLOAD);
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.type).toBe('image/png');
    });

    it('extracts image/jpeg from a JPEG data URL', () => {
      const dataUrl = makeDataUrl('image/jpeg', PAYLOAD);
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.type).toBe('image/jpeg');
    });

    it('extracts image/webp from a WebP data URL', () => {
      const dataUrl = makeDataUrl('image/webp', PAYLOAD);
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.type).toBe('image/webp');
    });

    it('extracts image/gif from a GIF data URL', () => {
      const dataUrl = makeDataUrl('image/gif', PAYLOAD);
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.type).toBe('image/gif');
    });

    it('defaults to image/jpeg when the header has no colon-semicolon pattern', () => {
      // A header without ":<mime>;" means the regex returns undefined → fallback
      const malformed = `data${btoa(PAYLOAD)}`; // no comma either — split gives one element
      // We need a comma so split gives two parts, but no ":" in the header part
      const headerWithoutColon = `nocolon;base64,${btoa(PAYLOAD)}`;
      const blob = dataUrlToBlob(headerWithoutColon);
      expect(blob.type).toBe('image/jpeg');
    });
  });

  // ── Blob size ─────────────────────────────────────────────────────────

  describe('blob size', () => {
    it('blob size matches the number of decoded bytes', () => {
      const payload = 'abc'; // atob(btoa('abc')) → 3 bytes
      const dataUrl = makeDataUrl('image/png', payload);
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.size).toBe(payload.length);
    });

    it('produces a non-empty blob for a single-byte payload', () => {
      const dataUrl = makeDataUrl('image/png', 'x');
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.size).toBe(1);
    });

    it('produces an empty blob for an empty payload', () => {
      const dataUrl = makeDataUrl('image/png', '');
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.size).toBe(0);
    });

    it('blob size matches a multi-byte payload', () => {
      const payload = PAYLOAD; // 17 chars → 17 bytes after round-trip
      const dataUrl = makeDataUrl('image/jpeg', payload);
      const blob = dataUrlToBlob(dataUrl);
      expect(blob.size).toBe(payload.length);
    });
  });

  // ── Blob type set correctly ───────────────────────────────────────────

  describe('blob type correctness', () => {
    it('returns a Blob instance', () => {
      const blob = dataUrlToBlob(makeDataUrl('image/png', PAYLOAD));
      expect(blob).toBeInstanceOf(Blob);
    });

    it('blob.type is exactly the mime from the header (no extra whitespace)', () => {
      const blob = dataUrlToBlob(makeDataUrl('image/png', PAYLOAD));
      expect(blob.type).toBe('image/png');
    });

    it('roundtrips: reading the blob bytes back matches the original payload', async () => {
      const payload = 'round-trip-data';
      const dataUrl = makeDataUrl('image/png', payload);
      const blob = dataUrlToBlob(dataUrl);

      const buffer = await blob.arrayBuffer();
      const recovered = new Uint8Array(buffer);
      const original = new Uint8Array(atob(btoa(payload)).split('').map(c => c.charCodeAt(0)));

      expect(recovered).toEqual(original);
    });
  });
});
