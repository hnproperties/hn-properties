/**
 * Turns the Hot Deals GIF into a transparent animated WebP.
 *
 * Two problems with the GIF as supplied: it sits on solid black, which would show
 * as a rectangle behind the badge, and it is 5.8 MB across 128 frames — a lot to
 * send to a phone on mobile data for a decorative header image.
 *
 * Keying the black out has to happen frame by frame, and the encoding has to
 * happen afterwards, because sharp cannot do both. Writing a tall strip of frames
 * and asking sharp for an animated WebP silently produces a single very tall
 * still: no ANIM chunk, no animation, and nothing in the API reports a problem.
 * So sharp keys the frames and ffmpeg assembles them.
 *
 * The key itself is a soft ramp rather than a hard cut-off. Flames fade towards
 * black at their edges, so a hard threshold either leaves a dark halo around every
 * flame or eats the tips. Ramping alpha across the darkest range keeps the glow.
 *
 * Requires ffmpeg on PATH.
 *
 * Run:  npx tsx scripts/make-hot-deals.ts
 */
import sharp from 'sharp';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SRC = path.join(process.cwd(), 'source-icons', 'hot-deals.gif');
const OUT = path.join(process.cwd(), 'public', 'hot-deals-banner.webp');

/**
 * The finished logo, laid over every frame.
 *
 * The GIF animates flames across the lettering as well as behind it, which makes
 * the words shimmer and hurts legibility at header size. This artwork already has
 * the text in front of its own flames, so compositing it on top pins the words
 * still and leaves only the flames around the edges moving — which is the effect
 * the animation was wanted for in the first place.
 */
const LOGO = path.join(process.cwd(), 'public', 'hot-deals-banner.png');

/** Below this a pixel is background; above it, fully opaque. Between, it ramps. */
const CUT_LOW = 10;
const CUT_HIGH = 58;

/** Every fourth frame. 128 frames is far more than the eye needs at this size. */
const FRAME_STEP = 4;

/** The badge renders about 44px tall, so the 480x270 source is already generous. */
const OUT_W = 320;
const OUT_H = 180;

async function main() {
  const meta = await sharp(SRC, { animated: true }).metadata();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-deals-'));

  const logo = await sharp(LOGO)
    .resize(OUT_W, OUT_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  let count = 0;
  for (let page = 0; page < meta.pages!; page += FRAME_STEP) {
    const frame = await sharp(SRC, { pages: 1, page })
      .resize(OUT_W, OUT_H)
      .ensureAlpha()
      .raw()
      .toBuffer();

    const out = Buffer.alloc(OUT_W * OUT_H * 4);
    for (let i = 0; i < OUT_W * OUT_H; i += 1) {
      const r = frame[i * 4];
      const g = frame[i * 4 + 1];
      const b = frame[i * 4 + 2];

      // Brightest channel, not the average: a saturated red flame has a low mean
      // but a high red, and averaging would leave it half transparent.
      const level = Math.max(r, g, b);
      const alpha =
        level <= CUT_LOW
          ? 0
          : level >= CUT_HIGH
            ? 255
            : Math.round(((level - CUT_LOW) / (CUT_HIGH - CUT_LOW)) * 255);

      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = alpha;
    }

    await sharp(out, { raw: { width: OUT_W, height: OUT_H, channels: 4 } })
      .composite([{ input: logo }])
      .png()
      .toFile(path.join(dir, `f${String(count).padStart(3, '0')}.png`));
    count += 1;
  }

  // yuva420p keeps the alpha channel; without it ffmpeg flattens to black and the
  // background comes straight back.
  execFileSync('ffmpeg', [
    '-y',
    '-framerate', '5',
    '-i', path.join(dir, 'f%03d.png'),
    '-loop', '0',
    '-c:v', 'libwebp_anim',
    '-q:v', '48',
    '-compression_level', '6',
    '-pix_fmt', 'yuva420p',
    OUT,
  ], { stdio: 'ignore' });

  fs.rmSync(dir, { recursive: true, force: true });

  const bytes = fs.statSync(OUT).size;
  const container = fs.readFileSync(OUT).toString('latin1');
  const frames = (container.match(/ANMF/g) ?? []).length;

  console.log(`hot-deals-banner.webp — ${OUT_W}x${OUT_H}, ${frames} frames, ${(bytes / 1024).toFixed(0)} KB`);
  if (!container.includes('ANIM')) throw new Error('Output is not animated — check the ffmpeg step');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
