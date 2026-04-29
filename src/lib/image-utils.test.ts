// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dataUrlToBlob, compressImage } from './image-utils';

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

// ── compressImage ───────────────────────────────────────────────────────────

describe('compressImage', () => {
  // jsdom has no OffscreenCanvas or createImageBitmap — mock both.

  let mockCtx: { drawImage: ReturnType<typeof vi.fn> };
  let mockCanvas: {
    width: number;
    height: number;
    getContext: ReturnType<typeof vi.fn>;
    convertToBlob: ReturnType<typeof vi.fn>;
  };
  let mockBitmapClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCtx = { drawImage: vi.fn() };
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      convertToBlob: vi.fn().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' })),
    };

    // Create a spyable constructor function
    const OffscreenCanvasConstructor = vi.fn(function (w: number, h: number) {
      mockCanvas.width = w;
      mockCanvas.height = h;
      return mockCanvas;
    });

    vi.stubGlobal('OffscreenCanvas', OffscreenCanvasConstructor);

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockImplementation(() => {
        mockBitmapClose = vi.fn();
        return Promise.resolve({ width: 2800, height: 2100, close: mockBitmapClose });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a data URL string starting with data:image/jpeg', async () => {
    const result = await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
    expect(mockBitmapClose).toHaveBeenCalledOnce();
  });

  it('scales down a landscape image so the longest side equals maxSide', async () => {
    // bitmap: 2800×2100 → scale = 1400/2800 = 0.5 → canvas 1400×1050
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(OffscreenCanvas).toHaveBeenCalledWith(1400, 1050);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1400, 1050);
    expect(mockBitmapClose).toHaveBeenCalledOnce();
  });

  it('scales down a portrait image so the longest side equals maxSide', async () => {
    // bitmap: 700×2800 → scale = 1400/2800 = 0.5 → canvas 350×1400
    (createImageBitmap as ReturnType<typeof vi.fn>).mockImplementation(() => {
      mockBitmapClose = vi.fn();
      return Promise.resolve({ width: 700, height: 2800, close: mockBitmapClose });
    });
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(OffscreenCanvas).toHaveBeenCalledWith(350, 1400);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 350, 1400);
    expect(mockBitmapClose).toHaveBeenCalledOnce();
  });

  it('does not upscale when image is already smaller than maxSide', async () => {
    // bitmap: 800×600 → scale = min(1, 1400/800) = 1 → canvas 800×600
    (createImageBitmap as ReturnType<typeof vi.fn>).mockImplementation(() => {
      mockBitmapClose = vi.fn();
      return Promise.resolve({ width: 800, height: 600, close: mockBitmapClose });
    });
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(OffscreenCanvas).toHaveBeenCalledWith(800, 600);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
    expect(mockBitmapClose).toHaveBeenCalledOnce();
  });

  it('passes the quality parameter to convertToBlob', async () => {
    await compressImage(makeDataUrl('image/jpeg', PAYLOAD), 1400, 0.72);
    expect(mockCanvas.convertToBlob).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.72 });
    expect(mockBitmapClose).toHaveBeenCalledOnce();
  });
});
