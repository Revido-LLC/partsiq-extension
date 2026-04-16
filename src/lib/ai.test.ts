// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { extractPartsFromScreenshot, AiPart } from './ai';

// ── Helpers ────────────────────────────────────────────────────────────────

const AI_EXTRACT_URL = 'https://app.parts-iq.com/version-138bg/api/1.1/wf/ai_extract';

function makePart(overrides: Partial<AiPart> = {}): AiPart {
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

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(body),
    }),
  );
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeAll(() => {
  // jsdom may not implement AbortSignal.timeout — polyfill it so the module loads
  if (typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = (ms: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('TimeoutError', 'TimeoutError')), ms);
      return controller.signal;
    };
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('extractPartsFromScreenshot', () => {
  // ── Request shape ──────────────────────────────────────────────────────

  describe('HTTP request', () => {
    it('calls the AI_EXTRACT endpoint with POST and the base64 image', async () => {
      const parts = [makePart()];
      mockFetch(200, { parts });

      await extractPartsFromScreenshot('base64data==');

      const fetchMock = vi.mocked(fetch);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(AI_EXTRACT_URL);
      expect((init as RequestInit).method).toBe('POST');
      const sentBody = JSON.parse((init as RequestInit).body as string);
      expect(sentBody.image_base64).toBe('base64data==');
    });

    it('includes credentials and Content-Type header', async () => {
      mockFetch(200, { parts: [] });

      await extractPartsFromScreenshot('abc');

      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect((init as RequestInit).credentials).toBe('include');
      expect(((init as RequestInit).headers as Record<string, string>)['Content-Type']).toBe(
        'application/json',
      );
    });
  });

  // ── Happy path — direct array responses ───────────────────────────────

  describe('direct array response', () => {
    it('returns parts from response.parts when present', async () => {
      const parts = [makePart()];
      mockFetch(200, { response: { parts } });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Oil Filter');
    });

    it('returns parts from top-level parts field as fallback', async () => {
      const parts = [makePart({ name: 'Air Filter', oem: 'AF001' })];
      mockFetch(200, { parts });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Air Filter');
    });

    it('prefers response.parts over top-level parts', async () => {
      const primary = [makePart({ name: 'Primary' })];
      const fallback = [makePart({ name: 'Fallback' })];
      mockFetch(200, { response: { parts: primary }, parts: fallback });

      const result = await extractPartsFromScreenshot('img');

      expect(result[0].name).toBe('Primary');
    });

    it('returns an empty array when parts field is an empty array', async () => {
      mockFetch(200, { parts: [] });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toEqual([]);
    });
  });

  // ── OpenRouter string-wrapped response ────────────────────────────────

  describe('OpenRouter response unwrapping', () => {
    it('extracts content from choices[0].message.content when raw is an OpenRouter JSON string', async () => {
      const partsArray = [makePart({ name: 'Spark Plug', oem: 'SP100' })];
      const openRouterBody = {
        choices: [{ message: { content: JSON.stringify(partsArray) } }],
      };
      mockFetch(200, { parts: JSON.stringify(openRouterBody) });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Spark Plug');
    });

    it('handles OpenRouter content wrapped in markdown code fences (```json...```)', async () => {
      const partsArray = [makePart({ name: 'Brake Pad', oem: 'BP200' })];
      const fencedContent = `\`\`\`json\n${JSON.stringify(partsArray)}\n\`\`\``;
      const openRouterBody = {
        choices: [{ message: { content: fencedContent } }],
      };
      mockFetch(200, { parts: JSON.stringify(openRouterBody) });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Brake Pad');
    });

    it('handles code fences without a language specifier (``` ... ```)', async () => {
      const partsArray = [makePart({ name: 'Timing Belt', oem: 'TB300' })];
      const fencedContent = `\`\`\`\n${JSON.stringify(partsArray)}\n\`\`\``;
      const openRouterBody = {
        choices: [{ message: { content: fencedContent } }],
      };
      mockFetch(200, { parts: JSON.stringify(openRouterBody) });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Timing Belt');
    });
  });

  // ── Markdown code fence stripping (raw string, no OpenRouter wrapper) ─

  describe('markdown code fence stripping', () => {
    it('strips ```json fences from a plain string raw value', async () => {
      const partsArray = [makePart({ name: 'Water Pump', oem: 'WP400' })];
      const fencedContent = `\`\`\`json\n${JSON.stringify(partsArray)}\n\`\`\``;
      // Simulate Bubble returning the string directly (not wrapped in OpenRouter envelope)
      mockFetch(200, { parts: fencedContent });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Water Pump');
    });
  });

  // ── Error cases ────────────────────────────────────────────────────────

  describe('non-200 responses', () => {
    it('throws an error on a 401 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({}),
        }),
      );

      await expect(extractPartsFromScreenshot('img')).rejects.toThrow(
        'AI extract failed: 401 Unauthorized',
      );
    });

    it('throws an error on a 500 response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
        }),
      );

      await expect(extractPartsFromScreenshot('img')).rejects.toThrow(
        'AI extract failed: 500 Internal Server Error',
      );
    });
  });

  // ── Invalid / malformed JSON ───────────────────────────────────────────

  describe('invalid JSON handling', () => {
    it('returns [] when raw is a plain non-JSON string', async () => {
      mockFetch(200, { parts: 'this is not json at all' });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toEqual([]);
    });

    it('returns [] when raw is a partially valid JSON string that fails to parse', async () => {
      mockFetch(200, { parts: '[{"name":"broken"' });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toEqual([]);
    });

    it('returns [] when the entire response body has no parts field', async () => {
      mockFetch(200, { something_else: 'value' });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toEqual([]);
    });
  });

  // ── Filtering — items without a name field ────────────────────────────

  describe('filtering items without name', () => {
    it('removes items that have no name field', async () => {
      const rawArray = [
        makePart({ name: 'Valid Part' }),
        { oem: 'NO-NAME-001', price: 5, delivery_days: null, stock: null, supplier: '' },
      ];
      mockFetch(200, { parts: rawArray });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Part');
    });

    it('removes items where name is not a string (e.g. null or number)', async () => {
      const rawArray = [
        makePart({ name: 'Valid' }),
        { name: null, oem: 'X', price: null, delivery_days: null, stock: null, supplier: '' },
        { name: 42, oem: 'Y', price: null, delivery_days: null, stock: null, supplier: '' },
      ];
      mockFetch(200, { parts: rawArray });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid');
    });

    it('returns [] when every item in the array lacks a name', async () => {
      const rawArray = [
        { oem: 'A', price: 1 },
        { oem: 'B', price: 2 },
      ];
      mockFetch(200, { parts: rawArray });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toEqual([]);
    });

    it('keeps items that have additional unexpected fields alongside name', async () => {
      const rawArray = [
        { name: 'Extra Fields Part', oem: 'EF001', price: 9.99, extra: 'bonus', delivery_days: 1, stock: 5, supplier: 'S' },
      ];
      mockFetch(200, { parts: rawArray });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Extra Fields Part');
    });
  });

  // ── Non-array parsed value ─────────────────────────────────────────────

  describe('non-array parsed value', () => {
    it('returns [] when parsed JSON is an object rather than an array', async () => {
      mockFetch(200, { parts: '{"name":"not an array"}' });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toEqual([]);
    });

    it('returns [] when parsed JSON is a number', async () => {
      mockFetch(200, { parts: '42' });

      const result = await extractPartsFromScreenshot('img');

      expect(result).toEqual([]);
    });
  });

  // ── AbortSignal.timeout ────────────────────────────────────────────────

  describe('AbortSignal.timeout', () => {
    it('includes AbortSignal.timeout in fetch options', async () => {
      mockFetch(200, { parts: [makePart()] });

      const timeoutSignal = new AbortController().signal;
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal);

      await extractPartsFromScreenshot('img');

      // AbortSignal.timeout should have been called with 30 000 ms
      expect(timeoutSpy).toHaveBeenCalledWith(30_000);

      // The signal returned by AbortSignal.timeout must be forwarded to fetch
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect((init as RequestInit).signal).toBe(timeoutSignal);
    });
  });

  // ── No console.log calls ───────────────────────────────────────────────

  describe('no console.log calls', () => {
    it('does not call console.log during a successful extraction', async () => {
      mockFetch(200, { parts: [makePart()] });

      const logSpy = vi.spyOn(console, 'log');

      await extractPartsFromScreenshot('base64ok==');

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
