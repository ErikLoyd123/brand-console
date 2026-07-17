// console/src/lib/terminal-images.ts
// Prepares an image pasted or dropped into the terminal drawer for upload.
//
// The downscale is required, not an optimization. Base64 inflates ~33% and the API
// caps bodies at 12mb, so an 8MB Retina screenshot base64s to ~11MB and brushes the
// ceiling — the feature would work on small screenshots and fail on large ones.
// Claude's vision resizes to a ~1568px long edge regardless, so a 5K screenshot spends
// 8MB to deliver exactly what a ~400KB one does. Downscaling here puts the limit out
// of reach and hands claude pixel-identical input to what it would have seen anyway.

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const MAX_EDGE = 1568;

export function isAcceptedImage(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

export interface PreparedImage {
  dataBase64: string;
  mimeType: string;
}

// Re-encodes in the source format where the API supports it: round-tripping a JPEG
// photo through PNG can end up *larger* than the original, which is the opposite of
// the point. Anything else (or an unknown type) becomes PNG.
function outputTypeFor(sourceType: string): string {
  return sourceType === 'image/jpeg' || sourceType === 'image/webp' ? sourceType : 'image/png';
}

export async function prepareTerminalImage(file: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    // Only ever shrink — upscaling a small screenshot would add bytes and no detail.
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const mimeType = outputTypeFor(file.type);
    const dataUrl = canvas.toDataURL(mimeType, 0.92);
    const comma = dataUrl.indexOf(',');
    if (comma === -1) throw new Error('canvas produced an unreadable data URL');
    return { dataBase64: dataUrl.slice(comma + 1), mimeType };
  } finally {
    bitmap.close();
  }
}
