/**
 * Extracts a human-readable supplier name from a URL.
 * e.g. "https://www.moco.nl/parts" → "Moco"
 *      "https://shop.autodoc.co.uk" → "Autodoc"
 */
export function extractSupplierName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(www\.|shop\.|m\.|store\.)/, '');
    // Take second-to-last label (before the TLD)
    const parts = host.split('.');
    const name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Unknown';
  }
}
