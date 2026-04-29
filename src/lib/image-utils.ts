/** Convert a data-URL to a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Resize and recompress an image.
 *
 * - If the largest dimension is greater than `maxSide`, the image is scaled
 *   down proportionally so that the largest side equals `maxSide`.
 * - If both sides are already ≤ `maxSide`, scale = 1 (no resize, only
 *   JPEG recompression is applied).
 * - Always outputs JPEG regardless of the input format.
 *
 * @param dataUrl  Full data URL including the `data:<mime>;base64,` header.
 * @param maxSide  Maximum pixel length of the longest side.
 * @param quality  JPEG quality in the 0–1 range (e.g. 0.72).
 * @returns        New data URL (`data:image/jpeg;base64,...`).
 */
export async function compressImage(
  dataUrl: string,
  maxSide: number,
  quality: number,
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('compressImage: failed to get 2D context from OffscreenCanvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(outBlob);
  });
}
