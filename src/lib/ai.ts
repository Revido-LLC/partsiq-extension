import type { PartData } from '@types/parts';
import { CONFIG } from '@lib/constants';

const EXTRACTION_PROMPT = `You are a parts data extractor for automotive suppliers. The websites are primarily in Dutch (Nederlands) but may also be in English, German, French, or other languages. Analyze this screenshot and extract ALL parts visible on the page.

For each part found, return a JSON array with objects containing:
- partName: the part name/description. Dutch labels: "Naam", "Omschrijving", "Productnaam", "Onderdeel"
- oemNumber: the article/part reference number. Dutch labels: "Artikelnummer", "Artikel nr.", "Onderdeelnummer". Also: "Article number", "Part number", "Référence", "Referencia", "Teilenummer", "OEM", "OES". Use the alphanumeric code next to these labels (e.g. C2511L, 0258006028, BKR6EK)
- netPrice: the net/wholesale price as a number. Dutch labels: "Netto prijs", "Inkoopprijs", "Netto"
- grossPrice: the gross/retail price as a number. Dutch labels: "Bruto prijs", "Verkoopprijs", "Prijs per stuk", "Incl. BTW"
- deliveryTime: delivery time as text. Dutch labels: "Levertijd", "Direct leverbaar", "Op voorraad", "Verwachte levertijd"
- stockAvailable: true if in stock, false if not, null if unknown. Dutch indicators: "Direct leverbaar"/"Op voorraad" = true, "Niet op voorraad"/"Uitverkocht" = false
- supplier: the brand/supplier name visible on the page. Dutch label: "Merk", "Leverancier"
- confidence: your confidence in the extraction (0.0 to 1.0)

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- If a field is not visible on the page, use null
- Extract ALL parts visible, not just the first one
- Prices should be numbers without currency symbols (strip €, EUR, BTW)
- If no parts are detected, return an empty array []`;

export async function extractPartsFromScreenshot(
  screenshotBase64: string
): Promise<PartData[]> {
  const startTime = Date.now();

  const response = await fetch(CONFIG.OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
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
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    console.log(`[PartsIQ AI] parts=${parsed.length}`);
    return parsed.filter(
      (item: unknown): item is PartData =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).partName === 'string'
    );
  } catch {
    console.error('[PartsIQ AI] Failed to parse response as JSON:', content);
    return [];
  }
}
