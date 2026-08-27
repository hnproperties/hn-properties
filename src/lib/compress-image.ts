/**
 * Client-side image compression for owner uploads.
 *
 * Phone cameras produce 4–8 MB files. Uploading those wastes the visitor's data,
 * is slow on a patchy connection, and fills Blob storage for no visual gain — a
 * listing photo is never displayed larger than about 1600px.
 *
 * Strategy: shrink the longest edge first (resolution costs far more bytes than
 * JPEG quality does), then search downwards through quality steps for the highest
 * one that lands in the target band. Compressing in the browser also means the
 * server never has to handle the original.
 */

const TARGET_MIN = 150 * 1024;
const TARGET_MAX = 200 * 1024;
const SKIP_BELOW = 200 * 1024;
const MAX_EDGE = 1600;

/** Quality steps, highest first — we stop at the first that fits the band. */
const QUALITY_STEPS = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.44, 0.38];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Returns a compressed JPEG, or the original file when it is already small
 * enough, is not an image, or anything goes wrong. Compression is a nicety —
 * it must never be the reason an upload fails.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= SKIP_BELOW) return file;

  try {
    const img = await loadImage(file);

    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.imageSmoothingQuality = 'high';
    context.drawImage(img, 0, 0, width, height);

    let best: Blob | null = null;

    for (const quality of QUALITY_STEPS) {
      const blob = await toBlob(canvas, quality);
      if (!blob) continue;
      best = blob;

      // First quality at or under the ceiling wins — the list runs highest-first,
      // so this is the best-looking version that fits.
      if (blob.size <= TARGET_MAX) break;
    }

    if (!best) return file;

    // If even the lowest quality overshoots, halve the dimensions once and retry.
    // Two megapixels of noise can resist quality reduction alone.
    if (best.size > TARGET_MAX && width > 800) {
      canvas.width = Math.round(width / 2);
      canvas.height = Math.round(height / 2);
      const ctx2 = canvas.getContext('2d');
      if (ctx2) {
        ctx2.imageSmoothingQuality = 'high';
        ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const quality of QUALITY_STEPS) {
          const blob = await toBlob(canvas, quality);
          if (blob) {
            best = blob;
            if (blob.size <= TARGET_MAX) break;
          }
        }
      }
    }

    // Never hand back something larger than what we were given.
    if (best.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([best], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** True when the result landed in the intended band — used only for logging. */
export function inTargetBand(size: number) {
  return size >= TARGET_MIN && size <= TARGET_MAX;
}
