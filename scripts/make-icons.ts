/**
 * Generates the app icon set for both installable apps from the glossy tile
 * artwork in source-icons/.
 *
 * The artwork is a rounded-square tile with a bevelled rim and a drop shadow,
 * sitting on a black canvas. Used as-is that produces exactly the border the
 * earlier icons had: Android applies its own circle or squircle mask, which cuts
 * into a shape that is already rounded, and the gap between the two shows as a
 * ring of background.
 *
 * So rather than shrink the tile inside a square, this crops *into* it. The rim and
 * the rounded corners are discarded, and what is left is the tile's interior —
 * opaque to every edge. Whatever shape a launcher cuts, it only ever cuts glossy
 * surface. Losing the rim costs nothing: the launcher was going to mask it away,
 * and every other icon on the phone takes its shape from the launcher too, which
 * is what makes this look native rather than pasted on.
 *
 * Run:  npx tsx scripts/make-icons.ts
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const SRC = path.join(process.cwd(), 'source-icons');
const OUT = path.join(process.cwd(), 'public');

/**
 * Extra margin taken once the crop has cleared the rounded corners.
 *
 * The clearance itself is measured per image rather than assumed. A fixed figure
 * kept leaving a dark notch in one corner of the navy tile, because the detected
 * bounds include a drop shadow that sits off-centre and drags the crop with it.
 */
const CORNER_MARGIN = 0.03;

/**
 * How much of the finished icon the artwork occupies before its edges are extended.
 *
 * The house already fills most of the tile, so the face is only pulled in slightly —
 * enough to keep the mark off the very edge without making it look shrunken next to
 * the other apps on the home screen.
 */
const FACE_FRACTION = 0.95;

/** Rough bounds of the tile within the black canvas, shadow included. */
async function tileBounds(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * C;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 > 28) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * The tile's opaque interior: square, full bleed, with no rounded corner left in it.
 *
 * The crop is stepped inwards and the four corners tested against the artwork until
 * all of them land on tile rather than on the black surround or its shadow. The two
 * tiles clear at slightly different points, so measuring beats assuming.
 */
async function faceOf(file: string) {
  const bounds = await tileBounds(file);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, channels: C } = info;

  const at = (x: number, y: number) => {
    const i = (y * W + x) * C;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };

  // Tile is either a bright face or a blue-dominant navy. The black surround and
  // its desaturated grey shadow pass neither test.
  const isTile = ([r, g, b]: readonly [number, number, number]) =>
    (r + g + b) / 3 > 60 || (b > 22 && b > r + 6);

  const side = Math.min(bounds.width, bounds.height);
  const cx = bounds.left + Math.round(bounds.width / 2);
  const cy = bounds.top + Math.round(bounds.height / 2);

  let inset = 0;
  for (let step = 0; step <= 0.32; step += 0.005) {
    const half = Math.round((side / 2) * (1 - step * 2));
    const corners = [
      at(cx - half, cy - half),
      at(cx + half, cy - half),
      at(cx - half, cy + half),
      at(cx + half, cy + half),
    ];
    if (corners.every(isTile)) {
      inset = step + CORNER_MARGIN;
      break;
    }
  }
  if (!inset) throw new Error(`Could not find a clean crop for ${path.basename(file)}`);

  const half = Math.round((side / 2) * (1 - inset * 2));
  console.log(
    `  ${path.basename(file)}: corners clear at ${((inset - CORNER_MARGIN) * 100).toFixed(1)}%, cropping at ${(inset * 100).toFixed(1)}%`,
  );

  return sharp(file)
    .extract({ left: cx - half, top: cy - half, width: half * 2, height: half * 2 })
    .png()
    .toBuffer();
}

/**
 * Scales the face slightly in, then grows its edges out to fill the square.
 *
 * The border is grown from a blurred copy rather than the sharp one. Replicating
 * edge pixels directly smears whatever sits against that edge: a highlight becomes
 * a bright streak, a stray bevel pixel becomes a dark notch. Blurring first averages
 * those away, so what runs off the edge is the colour the gloss was already heading
 * towards — the surface continuing, rather than padding stuck on.
 */
async function render(face: Buffer, size: number) {
  const inner = Math.round(size * FACE_FRACTION);
  const pad = Math.round((size - inner) / 2);
  const rest = size - inner - pad;

  const base = await sharp(face)
    .resize(inner, inner, { kernel: 'lanczos3' })
    .blur(Math.max(1, size * 0.04))
    .extend({ top: pad, bottom: rest, left: pad, right: rest, extendWith: 'copy' })
    .png()
    .toBuffer();

  const crisp = await sharp(face).resize(inner, inner, { kernel: 'lanczos3' }).png().toBuffer();

  return sharp(base).composite([{ input: crisp, top: pad, left: pad }]).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const apps = [
    { name: 'app', src: path.join(SRC, 'app-tile.png') },
    { name: 'core', src: path.join(SRC, 'core-tile.png') },
  ];

  for (const app of apps) {
    if (!fs.existsSync(app.src)) throw new Error(`Missing artwork: ${app.src}`);
    const face = await faceOf(app.src);

    /*
     * The same full-bleed face for both `any` and `maskable`.
     *
     * Maskable icons normally pull the mark further in to survive cropping, but the
     * house is centred and a launcher mask takes the corners, not the middle. A
     * second, more inset version would only make the icon look smaller than every
     * other app on the home screen for no real gain.
     */
    for (const size of [192, 512]) {
      const rendered = await render(face, size);
      await fs.promises.writeFile(path.join(OUT, `icon-${app.name}-${size}.png`), rendered);
      await fs.promises.writeFile(path.join(OUT, `icon-${app.name}-maskable-${size}.png`), rendered);
    }

    // iOS has no maskable concept: it rounds whatever it is given, so it wants
    // exactly this — full bleed, with nothing already rounded about it.
    await fs.promises.writeFile(path.join(OUT, `apple-icon-${app.name}.png`), await render(face, 180));
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
