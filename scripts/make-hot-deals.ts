/**
 * Turns the green-screen Hot Deals GIF into a transparent animated WebP.
 *
 * Green screen rather than the earlier black background, and that matters: keying
 * black out of artwork whose flames fade to dark left a scatter of dark specks
 * around the logo, because there was no way to tell background from the darkest
 * parts of the image. Green shares nothing with orange flames, so the separation
 * is clean.
 *
 * Two things beyond a plain threshold:
 *
 * The key ramps rather than cuts. A hard cut-off leaves a hard edge that looks
 * pasted on at any size; ramping alpha through the fringe keeps the soft edge the
 * artwork was drawn with.
 *
 * And it de-spills. Green light bounces onto the subject in the original, leaving
 * a lime rim once the background is gone. Pulling green back toward the other
 * channels in the fringe removes it.
 *
 * Encoding is ffmpeg's job. Sharp can key frames but silently writes a single very
 * tall still when asked for an animation from raw frames — no ANIM chunk, no error.
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

const SRC = path.join(process.cwd(), 'source-icons', 'hot-deals-green.gif');
const OUT = path.join(process.cwd(), 'public', 'hot-deals-banner.webp');

/**
 * Output size.
 *
 * The Hot Deals page shows this about 520px wide, so 600 keeps it crisp there
 * without paying for detail nobody sees. The 480px source is upscaled slightly —
 * that adds no real detail, but it stops the browser scaling up from below the
 * display size, which is what made the previous version look soft.
 */
const OUT_W = 600;
const OUT_H = 338;

/** Every fifth frame at 4fps. Enough for flames to move; few enough to stay small. */
const FRAME_STEP = 5;
const FPS = 4;

/** Green dominance over red and blue. Above SOLID it is background; below FRINGE it is subject. */
const SOLID = 60;
const FRINGE = 25;

async function main() {
  const meta = await sharp(SRC, { animated: true }).metadata();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-deals-'));
  let count = 0;

  for (let page = 0; page < meta.pages!; page += FRAME_STEP) {
    /*
     * Trim two pixels off each edge before scaling.
     *
     * The source GIF carries a faint one-pixel band along its top edge — an
     * encoding artefact, not part of the artwork — which survives the key and
     * shows as a hairline above the logo on any background.
     */
    const frame = await sharp(SRC, { pages: 1, page })
      .extract({ left: 2, top: 2, width: meta.width! - 4, height: meta.pageHeight! - 4 })
      .resize(OUT_W, OUT_H, { kernel: 'lanczos3' })
      .ensureAlpha()
      .raw()
      .toBuffer();

    const out = Buffer.alloc(OUT_W * OUT_H * 4);

    for (let i = 0; i < OUT_W * OUT_H; i += 1) {
      const r = frame[i * 4];
      let g = frame[i * 4 + 1];
      const b = frame[i * 4 + 2];

      const overRed = g - r;
      const overBlue = g - b;
      let alpha = 255;

      if (overRed > SOLID && overBlue > SOLID) {
        alpha = 0;
      } else if (overRed > FRINGE && overBlue > FRINGE) {
        alpha = Math.max(0, Math.min(255, Math.round(255 * (1 - Math.min(overRed, overBlue) / SOLID))));
        // De-spill: cap green near the other channels so the edge is not lime.
        const cap = Math.max(r, b);
        if (g > cap) g = Math.round(cap + (g - cap) * 0.25);
      }

      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = alpha;
    }

    await sharp(out, { raw: { width: OUT_W, height: OUT_H, channels: 4 } })
      .png()
      .toFile(path.join(dir, `f${String(count).padStart(3, '0')}.png`));
    count += 1;
  }

  // yuva420p keeps the alpha channel; without it ffmpeg flattens to black and the
  // background comes straight back.
  execFileSync('ffmpeg', [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(dir, 'f%03d.png'),
    '-loop', '0',
    '-c:v', 'libwebp_anim',
    '-q:v', '75',
    '-compression_level', '6',
    '-pix_fmt', 'yuva420p',
    OUT,
  ], { stdio: 'ignore' });

  fs.rmSync(dir, { recursive: true, force: true });

  const bytes = fs.statSync(OUT).size;
  const container = fs.readFileSync(OUT).toString('latin1');
  if (!container.includes('ANIM')) throw new Error('Output is not animated — check the ffmpeg step');

  console.log(
    `hot-deals-banner.webp — ${OUT_W}x${OUT_H}, ${(container.match(/ANMF/g) ?? []).length} frames, ${(bytes / 1024).toFixed(0)} KB`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
