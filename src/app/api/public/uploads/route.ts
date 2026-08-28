import type { NextRequest } from 'next/server';
import { ok, route, clientIp } from '@/lib/api';
import { badRequest, tooMany } from '@/lib/errors';
import { uploadPublic } from '@/lib/storage';
import { processPhoto, processThumbnail } from '@/lib/images';
import { hashIp } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024; // large phone photos are fine — they get compressed
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * Photo upload for owner submissions — the one unauthenticated write path for files.
 * Kept narrow on purpose: images only, 25 MB each, and a per-address hourly cap so it
 * cannot be used as free file hosting. Uploaded photos are attached to a DRAFT
 * property and are not public until someone at HN publishes the listing.
 *
 * The cap now comes from lib/rate-limit, which is the same counter the public
 * listing search uses — one implementation to reason about, and one place to
 * change when it moves to a shared store.
 */
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 20;

export const POST = route(async (req: NextRequest) => {
  const key = hashIp(clientIp(req)) ?? 'unknown';
  if (!rateLimit(`public-uploads:${key}`, LIMIT, WINDOW_MS).allowed) {
    throw tooMany('Too many uploads from this connection — please try again later');
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw badRequest('No file received');
  if (file.size > MAX_BYTES) throw badRequest('That photograph is larger than 25 MB');
  if (!IMAGE_TYPES.includes(file.type)) throw badRequest('Upload a JPEG, PNG or WebP image');

  const raw = await file.arrayBuffer();
  const [full, thumb] = await Promise.all([processPhoto(raw), processThumbnail(raw)]);
  const stem = file.name.replace(/\.[^.]+$/, '');

  const [stored, storedThumb] = await Promise.all([
    uploadPublic({ name: `${stem}.${full.extension}`, type: full.contentType, data: full.data }),
    uploadPublic({ name: `${stem}-thumb.${thumb.extension}`, type: thumb.contentType, data: thumb.data }),
  ]);

  return ok({ url: stored.url, thumbUrl: storedThumb.url, bytes: full.bytes }, { status: 201 });
});
