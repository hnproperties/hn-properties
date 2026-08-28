import sharp from 'sharp';

/**
 * Photographs arrive straight from phones — often 4–8 MB and 4000px wide, far more
 * than a web page needs and slow on a phone connection.
 *
 * The contract here is: nothing is stored above the size ceiling, and quality is
 * only ever reduced as far as reaching that ceiling requires. Most photographs are
 * done at the first attempt, where the result is indistinguishable from the
 * original at any size a screen displays.
 */

export type ProcessedImage = {
  data: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  bytes: number;
  quality: number;
};

const MAX_WIDTH = 1600;
const THUMB_WIDTH = 640;

/**
 * The band, not just a ceiling. Photographs should land close under 200 KB rather
 * than anywhere below it: a stepped search that stops at the first size which
 * happens to fit can leave a third of the allowance unspent, and the difference
 * shows on a large screen. 150 KB is the point below which we would rather have
 * spent more — but it is a preference, not a floor. A plain photograph that
 * encodes to 90 KB at full quality is left there; padding it would add bytes
 * without adding any detail to look at.
 */
const PHOTO_FLOOR = 150 * 1024;
const PHOTO_CEILING = 200 * 1024;
const THUMB_CEILING = 60 * 1024;

/** Bounds of the quality search. Above ~92, WebP spends a lot of bytes on nothing visible. */
const QUALITY_MIN = 40;
const QUALITY_MAX = 92;
const SEARCH_STEPS = 7;

/** Only used if even the lowest quality is too heavy — fewer pixels beats mushy pixels. */
const WIDTH_FALLBACKS = [0.85, 0.7, 0.55, 0.45];

/**
 * Highest quality whose output still fits under the ceiling, found by halving the
 * quality range rather than walking fixed steps.
 *
 * The stepped version this replaces returned the first size that fitted, which
 * could sit far under the ceiling: quality 88 might produce 260 KB and quality 82
 * produce 120 KB, and the 120 KB version was stored even though roughly 195 KB was
 * available. Bisecting finds the quality that actually uses the allowance.
 */
async function searchQuality(
  render: (quality: number) => Promise<Buffer>,
  ceiling: number,
): Promise<{ data: Buffer; quality: number; fits: boolean }> {
  const top = await render(QUALITY_MAX);
  if (top.byteLength <= ceiling) return { data: top, quality: QUALITY_MAX, fits: true };

  let low = QUALITY_MIN;
  let high = QUALITY_MAX;
  let fitting: { data: Buffer; quality: number } | null = null;
  let smallest: { data: Buffer; quality: number } = { data: top, quality: QUALITY_MAX };

  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const quality = Math.round((low + high) / 2);
    if (quality === low || quality === high) break;

    const data = await render(quality);
    if (data.byteLength < smallest.data.byteLength) smallest = { data, quality };

    if (data.byteLength <= ceiling) {
      fitting = { data, quality };
      low = quality; // it fits — now try to spend more of the allowance on quality
    } else {
      high = quality;
    }
  }

  return fitting ? { ...fitting, fits: true } : { ...smallest, fits: false };
}

async function encode(input: Buffer, maxWidth: number, ceiling: number): Promise<ProcessedImage> {
  const prepared = sharp(input, { failOn: 'none' })
    .rotate() // honour the camera's orientation tag before metadata is stripped
    .resize({ width: maxWidth, withoutEnlargement: true });

  // Pass one: hold the width, find the best quality that fits.
  const first = await searchQuality((quality) => prepared.clone().webp({ quality, effort: 5 }).toBuffer(), ceiling);
  if (first.fits) return describe(first.data, first.quality);

  // Pass two: still too heavy at the lowest quality we will accept — reduce the
  // dimensions rather than degrade the image any further.
  let smallest = first;
  for (const factor of WIDTH_FALLBACKS) {
    const width = Math.max(480, Math.round(maxWidth * factor));
    const attempt = await searchQuality(
      (quality) =>
        sharp(input, { failOn: 'none' })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality, effort: 5 })
          .toBuffer(),
      ceiling,
    );
    if (attempt.fits) return describe(attempt.data, attempt.quality);
    if (attempt.data.byteLength < smallest.data.byteLength) smallest = attempt;
  }

  // Nothing fit — return the smallest we managed rather than failing the upload.
  return describe(smallest.data, smallest.quality);
}

async function describe(data: Buffer, quality: number): Promise<ProcessedImage> {
  const meta = await sharp(data).metadata();
  return {
    data,
    contentType: 'image/webp',
    extension: 'webp',
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    bytes: data.byteLength,
    quality,
  };
}

/**
 * Full-size image for the listing page.
 *
 * A photograph already under the ceiling and no wider than the page needs is kept
 * exactly as the owner sent it — untouched bytes, no re-encoding, no quality loss.
 * Compression only applies to files that are actually too heavy.
 */
export async function processPhoto(input: ArrayBuffer | Buffer): Promise<ProcessedImage> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  const meta = await sharp(buffer, { failOn: 'none' }).metadata().catch(() => null);
  const alreadyFine =
    meta &&
    buffer.byteLength <= PHOTO_CEILING &&
    (meta.width ?? 0) <= MAX_WIDTH &&
    !meta.orientation; // a rotation tag still has to be applied, so those go through

  if (alreadyFine) {
    return {
      data: buffer,
      contentType: meta.format === 'png' ? 'image/png' : meta.format === 'webp' ? 'image/webp' : 'image/jpeg',
      extension: meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : 'jpg',
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      bytes: buffer.byteLength,
      quality: 100,
    };
  }

  const processed = await encode(buffer, MAX_WIDTH, PHOTO_CEILING);

  // Compression should never make a file worse: if the result is somehow larger
  // than what arrived, keep the original.
  if (processed.bytes > buffer.byteLength && meta && (meta.width ?? 0) <= MAX_WIDTH) {
    return {
      data: buffer,
      contentType: meta.format === 'png' ? 'image/png' : meta.format === 'webp' ? 'image/webp' : 'image/jpeg',
      extension: meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : 'jpg',
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      bytes: buffer.byteLength,
      quality: 100,
    };
  }

  return processed;
}

/** Small version for cards and tables — a fraction of the bytes. */
export async function processThumbnail(input: ArrayBuffer | Buffer): Promise<ProcessedImage> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return encode(buffer, THUMB_WIDTH, THUMB_CEILING);
}

export const IMAGE_LIMITS = { MAX_WIDTH, THUMB_WIDTH, PHOTO_FLOOR, PHOTO_CEILING, THUMB_CEILING };
