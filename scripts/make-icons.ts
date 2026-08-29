/**
 * Generates the app icon set for both installable apps.
 *
 * Two problems with the previous icons:
 *
 * 1. icon.png has its own rounded-square shape baked in, with transparent
 *    corners. Android then applies its *own* mask on top, so the launcher's
 *    circle or squircle cut into an already-rounded shape and left the visible
 *    inner border. The fix is a background that fills the whole square edge to
 *    edge — whatever shape the launcher cuts, it only ever cuts background.
 *
 * 2. Maskable icons are cropped hard: up to 20% can be shaved off every side, so
 *    the mark has to sit inside the middle ~62% or it loses its edges on some
 *    launchers. The background bleeds to 100%, the mark stays well inside.
 *
 * Run:  npx tsx scripts/make-icons.ts
 */
import sharp from 'sharp';
import path from 'path';

const OUT = path.join(process.cwd(), 'public');

const NAVY = '#33527a'; // sampled from the existing icon, lifted slightly for the gradient top
const NAVY_DEEP = '#1e3149';
const LIGHT = '#ffffff';
const LIGHT_EDGE = '#dce8f1';

/**
 * The glossy sheen: a bright band across the top that falls away through a
 * shallow curve, the way a curved glass surface catches light. Kept restrained —
 * enough to lift the icon off the wallpaper, not so much that it looks wet.
 */
function gloss(size: number, strong: boolean) {
  // Restrained on purpose. At 0.34 the sheen washed the navy toward grey and left
  // a visible hard arc where the band ended — the icon stopped reading as the brand
  // colour. Low opacity with the gradient falling to nothing keeps the highlight
  // as a suggestion of curved glass rather than a stripe painted across the top.
  const top = strong ? 0.16 : 0.13;
  const bottom = strong ? 0.0 : 0.0;
  const curve = size * 0.5;
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="#ffffff" stop-opacity="${top}"/>
           <stop offset="100%" stop-color="#ffffff" stop-opacity="${bottom}"/>
         </linearGradient>
       </defs>
       <path d="M0,0 H${size} V${size * 0.42} Q${curve},${size * 0.58} 0,${size * 0.42} Z" fill="url(#sheen)"/>
     </svg>`,
  );
}

/** A soft top-to-bottom background so the icon reads as a surface, not a flat swatch. */
function background(size: number, from: string, to: string) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="bg" x1="0" y1="0" x2="0.25" y2="1">
           <stop offset="0%" stop-color="${from}"/>
           <stop offset="100%" stop-color="${to}"/>
         </linearGradient>
       </defs>
       <rect width="${size}" height="${size}" fill="url(#bg)"/>
     </svg>`,
  );
}

type Build = {
  file: string;
  size: number;
  mark: Buffer;
  from: string;
  to: string;
  /** Fraction of the square the mark occupies. Lower for maskable, which gets cropped. */
  scale: number;
  strongGloss: boolean;
};

async function build({ file, size, mark, from, to, scale, strongGloss }: Build) {
  const inner = Math.round(size * scale);
  const resized = await sharp(mark)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(background(size, from, to))
    .composite([
      { input: resized, gravity: 'center' },
      { input: gloss(size, strongGloss), blend: 'over' },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
}

/**
 * Lifts the house mark off its flat background so it can be re-composited at the
 * right size on a full-bleed square. Source artwork is a small opaque PNG with the
 * mark in one tone against another, so a brightness threshold separates them
 * cleanly and keeps the window panes as holes rather than filling them in.
 *
 * `light: true` keeps the pale pixels (white house on navy); `light: false` keeps
 * the dark ones (blue house on white).
 */
async function extractMark(file: string, light: boolean, tint?: string) {
  const src = sharp(file).resize(1024, 1024, { kernel: 'lanczos3' });
  const { data, info } = await src.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const brightness = (r + g + b) / 3;
    const keep = light ? brightness > 150 : brightness < 200;
    if (tint) {
      const hex = tint.replace('#', '');
      out[j] = parseInt(hex.slice(0, 2), 16);
      out[j + 1] = parseInt(hex.slice(2, 4), 16);
      out[j + 2] = parseInt(hex.slice(4, 6), 16);
    } else {
      out[j] = r;
      out[j + 1] = g;
      out[j + 2] = b;
    }
    out[j + 3] = keep ? 255 : 0;
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).trim().png().toBuffer();
}

async function main() {
  const uploads = path.join(process.cwd(), 'source-icons');

  // Public marketplace: the blue house, kept in its original colours.
  const blueMark = await extractMark(path.join(uploads, 'apple-icon_white.png'), false);

  // HN Core: the white house, forced to pure white so it stays crisp on navy.
  const whiteMark = await extractMark(path.join(uploads, 'apple-icon_blue.png'), true, '#ffffff');

  const builds: Build[] = [];

  // --- Public marketplace: light, so it reads as the consumer-facing app ---
  for (const size of [192, 512]) {
    builds.push({ file: `icon-app-${size}.png`, size, mark: blueMark, from: LIGHT, to: LIGHT_EDGE, scale: 0.72, strongGloss: false });
    builds.push({ file: `icon-app-maskable-${size}.png`, size, mark: blueMark, from: LIGHT, to: LIGHT_EDGE, scale: 0.58, strongGloss: false });
  }
  builds.push({ file: 'apple-icon-app.png', size: 180, mark: blueMark, from: LIGHT, to: LIGHT_EDGE, scale: 0.72, strongGloss: false });

  // --- HN Core: navy, matching the CRM's own theme ---
  for (const size of [192, 512]) {
    builds.push({ file: `icon-core-${size}.png`, size, mark: whiteMark, from: NAVY, to: NAVY_DEEP, scale: 0.7, strongGloss: true });
    builds.push({ file: `icon-core-maskable-${size}.png`, size, mark: whiteMark, from: NAVY, to: NAVY_DEEP, scale: 0.56, strongGloss: true });
  }
  builds.push({ file: 'apple-icon-core.png', size: 180, mark: whiteMark, from: NAVY, to: NAVY_DEEP, scale: 0.7, strongGloss: true });

  for (const b of builds) {
    await build(b);
    console.log(`  ${b.file}`);
  }
  console.log(`\n${builds.length} icons written to public/.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
