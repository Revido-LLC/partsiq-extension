import { CONFIG } from '@lib/constants';

const EXTRACTION_PROMPT = `Extract auto parts from this supplier website screenshot.
Return a JSON array where each object has:
- name: part name/description
- oem: part number / artikelnummer (may be in English or Dutch)
- price: net price as number without currency symbol (prijs), or null
- delivery_days: delivery time as integer days (levertijd), or null
- stock: stock quantity as integer (voorraad), or null
- supplier: supplier name if visible (leverancier), or empty string

Data may appear in English or Dutch. Return ONLY a valid JSON array, no markdown, no explanation. If no parts found, return [].`;

export interface AiPart {
  name: string;
  oem: string;
  price: number | null;
  delivery_days: number | null;
  stock: number | null;
  supplier: string;
}

export async function extractPartsFromScreenshot(
  screenshotBase64: string
): Promise<AiPart[]> {
  const response = await fetch(CONFIG.BUBBLE_API.AI_EXTRACT, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: screenshotBase64, prompt: EXTRACTION_PROMPT }),
  });

  if (!response.ok) {
    throw new Error(`AI extract failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[partsiq] full response:', JSON.stringify(data));
  let raw = data?.response?.parts ?? data?.parts;
  console.log('[partsiq] ai_extract raw:', raw);

  // Bubble returns raw OpenRouter body as string — extract content from choices[0].message.content
  if (typeof raw === 'string') {
    try {
      const openRouterBody = JSON.parse(raw);
      if (openRouterBody?.choices?.[0]?.message?.content) {
        raw = openRouterBody.choices[0].message.content;
      }
    } catch {
      // raw is already a plain string (e.g. direct content), keep as is
    }
  }

  console.log('[partsiq] ai content:', raw);

  // Strip markdown code fences if present (```json ... ```)
  if (typeof raw === 'string') {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  }

  let parts: unknown;
  try {
    parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : [];
  } catch {
    console.warn('[partsiq] failed to parse AI content:', raw);
    parts = [];
  }
  if (!Array.isArray(parts)) return [];

  return parts.filter(
    (item: unknown): item is AiPart =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).name === 'string'
  );
}
