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

/** The hard ceiling. Nothing above this reaches storage. */
const PHOTO_CEILING = 200 * 1024;
const THUMB_CEILING = 60 * 1024;

/** Tried in order; the first result that fits wins, so quality stays as high as possible. */
const QUALITY_STEPS = [88, 82, 76, 70, 64, 58, 52, 46, 40];

/** Only used if even the lowest quality is too heavy — fewer pixels beats mushy pixels. */
const WIDTH_FALLBACKS = [0.85, 0.7, 0.55, 0.45];

async function encode(input: Buffer, maxWidth: number, ceiling: number): Promise<ProcessedImage> {
  const prepared = sharp(input, { failOn: 'none' })
    .rotate() // honour the camera's orientation tag before metadata is stripped
    .resize({ width: maxWidth, withoutEnlargement: true });

  let smallest: { data: Buffer; quality: number } | null = null;

  // Pass one: hold the width, walk quality down until it fits.
  for (const quality of QUALITY_STEPS) {
    const data = await prepared.clone().webp({ quality, effort: 5 }).toBuffer();
    if (!smallest || data.byteLength < smallest.data.byteLength) smallest = { data, quality };
    if (data.byteLength <= ceiling) return describe(data, quality);
  }

  // Pass two: still too heavy — reduce the dimensions rather than degrade further.
  for (const factor of WIDTH_FALLBACKS) {
    const width = Math.max(480, Math.round(maxWidth * factor));
    for (const quality of [76, 68, 60]) {
      const data = await sharp(input, { failOn: 'none' })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 5 })
        .toBuffer();
      if (!smallest || data.byteLength < smallest.data.byteLength) smallest = { data, quality };
      if (data.byteLength <= ceiling) return describe(data, quality);
    }
  }

  // Nothing fit — return the smallest we managed rather than failing the upload.
  return describe(smallest!.data, smallest!.quality);
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

export const IMAGE_LIMITS = { MAX_WIDTH, THUMB_WIDTH, PHOTO_CEILING, THUMB_CEILING };
