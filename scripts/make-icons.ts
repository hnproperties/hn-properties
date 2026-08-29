/**
 * Generates the app icon set for both installable apps from the artwork in
 * source-icons/.
 *
 * The job is not just to resize a picture. Android hands the icon to whatever
 * launcher the phone is running, and that launcher cuts it to its own outline —
 * circle, squircle, teardrop, pebble, flower, and others besides. Two things have
 * to be true for the result to look right in all of them:
 *
 *   1. The background must reach every edge. Artwork that carries its own rounded
 *      corners gets cut a second time, and the gap between the two shapes shows as
 *      the ring of background this went through several rounds of fixing.
 *
 *   2. The mark must sit well inside. The published safe area is a circle across
 *      80% of the icon, but the more adventurous outlines bite further in at the
 *      edge midpoints, so the house is kept inside about two thirds. That is also
 *      roughly where every other app on a home screen sits — which is what makes an
 *      icon look native rather than pasted on.
 *
 * The artwork cannot satisfy both as it stands: the house nearly fills its tile. So
 * it is taken apart — the tile face becomes a full-bleed background, the house is
 * lifted off it and placed back smaller — rather than scaled as one piece.
 *
 * Run:  npx tsx scripts/make-icons.ts
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const SRC = path.join(process.cwd(), 'source-icons');
const OUT = path.join(process.cwd(), 'public');

/** How much of the icon's width the house spans. Comfortably inside every launcher outline. */
const MARK_FRACTION = 0.66;

type Art = {
  name: string;
  file: string;
  /** True when the mark is lighter than its background, as with the white house on navy. */
  markIsLight: boolean;
  /** Luminance either side of which a pixel is certainly mark or certainly background. */
  band: [number, number];
};

const ART: Art[] = [
  // Blue house and grey window on a near-white tile: the mark is the darker part.
  { name: 'app', file: 'app-tile.png', markIsLight: false, band: [140, 215] },
  // White house on navy: the mark is the lighter part.
  { name: 'core', file: 'core-tile.png', markIsLight: true, band: [110, 185] },
];

/**
 * Separates the house from the tile it is drawn on.
 *
 * A soft ramp rather than a hard cut-off, so the bevelled edges and their
 * highlights stay smooth. A hard threshold leaves the mark looking cut out with
 * scissors, which is very visible once it sits on a different background.
 */
async function liftMark(file: string, art: Art) {
  const trimmed = await sharp(file).trim().png().toBuffer();
  const meta = await sharp(trimmed).metadata();

  /*
   * Crop the rim away before separating anything.
   *
   * The tile has a bevelled edge that is a shade darker than its face, which the
   * threshold below reads as mark and lifts along with the house — leaving a faint
   * rounded-square outline floating on the finished icon, the very ghost border
   * this whole approach exists to remove. The house sits well within this crop.
   */
  const inset = 0.07;
  const inner = await sharp(trimmed)
    .extract({
      left: Math.round(meta.width! * inset),
      top: Math.round(meta.height! * inset),
      width: Math.round(meta.width! * (1 - inset * 2)),
      height: Math.round(meta.height! * (1 - inset * 2)),
    })
    .png()
    .toBuffer();

  const { data, info } = await sharp(inner).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const [lo, hi] = art.band;

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const ramp = Math.min(1, Math.max(0, (luminance - lo) / (hi - lo)));
    const coverage = art.markIsLight ? ramp : 1 - ramp;

    out[j] = data[i];
    out[j + 1] = data[i + 1];
    out[j + 2] = data[i + 2];
    // Multiplied by the artwork's own alpha so the transparent surround stays out.
    out[j + 3] = Math.round(coverage * (data[i + 3] ?? 255));
  }

  /*
   * Clear the corners.
   *
   * Cropping further would start clipping the roof, but the leftover specks are
   * always in the corners — they are the tile's rim highlight catching the light,
   * and the house never reaches there. A generously rounded mask removes them and
   * leaves the mark itself untouched.
   */
  const radius = Math.round(Math.min(width, height) * 0.3);
  const cornerMask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/>
     </svg>`,
  );

  const keyed = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();

  return sharp(keyed)
    .composite([{ input: cornerMask, blend: 'dest-in' }])
    .trim()
    .png()
    .toBuffer();
}

/**
 * Averages a rectangle of the artwork, as a hex colour.
 *
 * Each crop is written out to a buffer before measuring, because sharp's stats()
 * reads the source image and ignores operations queued ahead of it — measuring the
 * pipeline directly returns the whole-image average for every region, which looks
 * plausible and is wrong.
 */
async function sample(tile: Buffer, x: number, y: number, w: number, h: number) {
  const cropped = await sharp(tile)
    .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) })
    .png()
    .toBuffer();
  const { channels } = await sharp(cropped).stats();
  const [r, g, b] = channels.slice(0, 3).map((c) => Math.round(c.mean));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A full-bleed background in the tile's own colours.
 *
 * Built from four samples taken where the house does not reach — above the roof,
 * below the base, and outside each wall — rather than by blurring the artwork.
 * Blurring seemed simpler but averages the house into the result: the white tile
 * came out blue, because most of what was being blurred was the blue mark.
 *
 * The samples become a diagonal gradient plus a soft sheen, which keeps the lit
 * look of the original: brighter at the top, deeper towards the bottom right.
 */
async function backgroundOf(tile: Buffer, size: number) {
  const meta = await sharp(tile).metadata();
  const W = meta.width!;
  const H = meta.height!;

  const top = await sample(tile, W * 0.25, H * 0.04, W * 0.5, H * 0.05);
  const bottom = await sample(tile, W * 0.25, H * 0.91, W * 0.5, H * 0.04);
  const left = await sample(tile, W * 0.04, H * 0.45, W * 0.05, H * 0.1);
  const right = await sample(tile, W * 0.91, H * 0.45, W * 0.05, H * 0.1);

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="field" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stop-color="${top}"/>
          <stop offset="45%" stop-color="${left}"/>
          <stop offset="100%" stop-color="${bottom}"/>
        </linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
          <stop offset="55%" stop-color="#ffffff" stop-opacity="0.03"/>
          <stop offset="100%" stop-color="${right}" stop-opacity="0.12"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#field)"/>
      <path d="M0,0 H${size} V${size * 0.44} Q${size * 0.5},${size * 0.6} 0,${size * 0.44} Z" fill="url(#sheen)"/>
    </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function render(tile: Buffer, mark: Buffer, size: number) {
  const background = await backgroundOf(tile, size);

  const meta = await sharp(mark).metadata();
  const target = Math.round(size * MARK_FRACTION);
  const scale = target / Math.max(meta.width!, meta.height!);
  const w = Math.max(1, Math.round(meta.width! * scale));
  const h = Math.max(1, Math.round(meta.height! * scale));

  const scaled = await sharp(mark).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();

  return sharp(background)
    .composite([{ input: scaled, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  for (const art of ART) {
    const file = path.join(SRC, art.file);
    if (!fs.existsSync(file)) throw new Error(`Missing artwork: ${file}`);

    const tile = await sharp(file).trim().png().toBuffer();
    const mark = await liftMark(file, art);
    const meta = await sharp(mark).metadata();
    console.log(`  ${art.file}: mark lifted at ${meta.width}x${meta.height}`);

    for (const size of [192, 512]) {
      const rendered = await render(tile, mark, size);
      // Identical for both purposes: the mark is already inside the safe area, so a
      // separate, more inset maskable version would only look smaller for no gain.
      await fs.promises.writeFile(path.join(OUT, `icon-${art.name}-${size}.png`), rendered);
      await fs.promises.writeFile(path.join(OUT, `icon-${art.name}-maskable-${size}.png`), rendered);
    }

    // iOS applies its own rounding and has no maskable concept, so it wants exactly
    // this: a full-bleed square with nothing already rounded about it.
    await fs.promises.writeFile(path.join(OUT, `apple-icon-${art.name}.png`), await render(tile, mark, 180));
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
