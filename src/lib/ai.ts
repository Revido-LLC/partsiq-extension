import type { PartData } from '@types/parts';
import { CONFIG } from '@lib/constants';
import { getApiKey } from '@lib/storage';

const EXTRACTION_PROMPT = `You are a parts data extractor for automotive suppliers. Analyze this screenshot of a supplier website and extract ALL parts visible on the page.

For each part found, return a JSON array with objects containing:
- partName: the name/description of the part
- oemNumber: the OEM or OES reference number
- netPrice: the net/wholesale price (number, no currency symbol)
- grossPrice: the gross/retail price (number, no currency symbol)
- deliveryTime: estimated delivery time as text
- stockAvailable: true/false/null if not shown
- supplier: the supplier name if visible on the page
- confidence: your confidence in the extraction (0.0 to 1.0)

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- If a field is not visible on the page, use null
- Extract ALL parts visible, not just the first one
- Prices should be numbers without currency symbols
- If no parts are detected, return an empty array []`;

export async function extractPartsFromScreenshot(
  screenshotBase64: string
): Promise<PartData[]> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Please add your API key in settings.');
  }

  const startTime = Date.now();

  const response = await fetch(CONFIG.OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': CONFIG.BUBBLE_BASE_URL,
      'X-Title': 'PartsIQ Extension',
    },
    body: JSON.stringify({
      model: CONFIG.OPENROUTER_MODEL,
      max_tokens: CONFIG.OPENROUTER_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: screenshotBase64 } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content as string | undefined;

  if (!content) {
    return [];
  }

  console.log(`[PartsIQ AI] model=${CONFIG.OPENROUTER_MODEL} time=${Date.now() - startTime}ms`);

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    console.log(`[PartsIQ AI] parts=${parsed.length}`);
    return parsed.filter(
      (item: unknown): item is PartData =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).partName === 'string' &&
        typeof (item as Record<string, unknown>).oemNumber === 'string'
    );
  } catch {
    console.error('[PartsIQ AI] Failed to parse response as JSON:', content);
    return [];
  }
}
