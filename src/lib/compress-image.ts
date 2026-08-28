/**
 * Client-side image compression for property photographs.
 *
 * Phone cameras produce 4–8 MB files. Uploading those wastes the sender's data,
 * is slow on a patchy connection, and fills Blob storage for no visual gain — a
 * listing photo is never displayed larger than about 1600px.
 *
 * The target is a band, 150–200 KB, not a ceiling. That distinction matters: the
 * earlier version walked a coarse list of quality steps and stopped at the first
 * one under 200 KB, so a photo that measured 250 KB at one step and 110 KB at the
 * next was stored at 110 KB — a third of the allowance thrown away, and visibly
 * softer than it needed to be. A binary search finds the highest quality that
 * still fits, which lands close under 200 KB instead of anywhere below it.
 *
 * One thing this will not do is inflate a photograph to reach 150 KB. A plain or
 * low-detail image can be at maximum quality and still encode to 90 KB; padding
 * it to reach a number would add bytes without adding anything to look at. In
 * that case the file goes as it is, at full quality — under the band because it
 * has no more detail to store, not because it was compressed too hard.
 */

const TARGET_MIN = 150 * 1024;
const TARGET_MAX = 200 * 1024;
const SKIP_BELOW = 200 * 1024;
const MAX_EDGE = 1600;

/** Bounds for the quality search. The top is short of 1.0: JPEG at 1.0 spends a lot of bytes on nothing anyone can see. */
const QUALITY_MIN = 0.35;
const QUALITY_MAX = 0.95;
const SEARCH_STEPS = 7; // halving the range seven times is finer than the eye can follow

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

function draw(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.imageSmoothingQuality = 'high';
  context.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * Highest quality whose output still fits under the ceiling.
 *
 * Encodes at the top of the range first: if even that fits, there is nothing to
 * search for — the image simply is not heavy, and re-encoding it lower would only
 * lose detail. Otherwise it halves the interval repeatedly, keeping the best
 * result that fits and remembering the smallest overall in case none does.
 */
async function bestUnderCeiling(canvas: HTMLCanvasElement, ceiling: number) {
  const top = await toBlob(canvas, QUALITY_MAX);
  if (!top) return null;
  if (top.size <= ceiling) return { blob: top, quality: QUALITY_MAX, fits: true };

  let low = QUALITY_MIN;
  let high = QUALITY_MAX;
  let fitting: { blob: Blob; quality: number } | null = null;
  let smallest: { blob: Blob; quality: number } = { blob: top, quality: QUALITY_MAX };

  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const quality = (low + high) / 2;
    const blob = await toBlob(canvas, quality);
    if (!blob) break;

    if (blob.size < smallest.blob.size) smallest = { blob, quality };

    if (blob.size <= ceiling) {
      // Fits — keep it, then try to spend more of the allowance on quality.
      fitting = { blob, quality };
      low = quality;
    } else {
      high = quality;
    }
  }

  return fitting ? { ...fitting, fits: true } : { ...smallest, fits: false };
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
    let width = Math.round(img.width * scale);
    let height = Math.round(img.height * scale);

    const canvas = draw(img, width, height);
    if (!canvas) return file;

    let result = await bestUnderCeiling(canvas, TARGET_MAX);
    if (!result) return file;

    /*
     * Still over the ceiling at the lowest quality we are willing to use. Detail-
     * heavy photographs — foliage, crowds, textured stone — resist quality
     * reduction, and pushing further would turn them to mush. Fewer pixels at a
     * decent quality reads better than full size at a poor one, so step the
     * dimensions down and search again.
     */
    for (let attempt = 0; !result.fits && attempt < 3 && width > 700; attempt += 1) {
      width = Math.round(width * 0.75);
      height = Math.round(height * 0.75);
      const smaller = draw(img, width, height);
      if (!smaller) break;
      const retry = await bestUnderCeiling(smaller, TARGET_MAX);
      if (retry) result = retry;
    }

    // Never hand back something larger than what we were given.
    if (result.blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([result.blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** True when the result landed in the intended band. */
export function inTargetBand(size: number) {
  return size >= TARGET_MIN && size <= TARGET_MAX;
}

export const COMPRESSION_TARGET = { TARGET_MIN, TARGET_MAX, SKIP_BELOW, MAX_EDGE };
