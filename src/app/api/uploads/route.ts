import type { NextRequest } from 'next/server';
import { currentUserOrThrow, ok, route, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, badRequest } from '@/lib/errors';
import { uploadPublic, uploadPrivate } from '@/lib/storage';
import { processPhoto, processThumbnail } from '@/lib/images';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024; // generous: everything is compressed below
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

/**
 * File upload. Photos land in public storage; documents land in private storage and
 * are only ever served back through /api/documents/[id], which authorises and logs.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();

  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest('Expected a file upload');

  const file = form.get('file');
  const kind = String(form.get('kind') ?? 'photo');
  if (!(file instanceof File)) throw badRequest('No file received');

  const isDocument = kind === 'document';
  if (isDocument && !can(user, 'property.document.upload')) throw forbidden();
  if (!isDocument && !can(user, 'property.create') && !can(user, 'property.edit')) throw forbidden();

  if (file.size > MAX_BYTES) throw badRequest('That file is larger than 25 MB');

  const allowed = isDocument ? DOCUMENT_TYPES : IMAGE_TYPES;
  if (!allowed.includes(file.type)) {
    throw badRequest(isDocument ? 'Upload a PDF or an image' : 'Upload a JPEG, PNG or WebP image');
  }

  const raw = await file.arrayBuffer();

  // Documents keep their original bytes — a PDF or scan must not be re-encoded.
  if (isDocument) {
    const result = await uploadPrivate({ name: file.name, type: file.type, data: raw });
    await audit({ user, action: 'document.file.uploaded', entityType: 'file', summary: file.name, ip: clientIp(req) });
    return ok(result, { status: 201 });
  }

  // Photographs are resized and compressed before they are stored.
  const [full, thumb] = await Promise.all([processPhoto(raw), processThumbnail(raw)]);
  const stem = file.name.replace(/\.[^.]+$/, '');

  const [stored, storedThumb] = await Promise.all([
    uploadPublic({ name: `${stem}.${full.extension}`, type: full.contentType, data: full.data }),
    uploadPublic({ name: `${stem}-thumb.${thumb.extension}`, type: thumb.contentType, data: thumb.data }),
  ]);

  const result = {
    ...stored,
    thumbUrl: storedThumb.url,
    width: full.width,
    height: full.height,
    bytes: full.bytes,
    originalBytes: file.size,
  };

  await audit({
    user,
    action: 'photo.uploaded',
    entityType: 'file',
    summary: `${file.name} · ${Math.round(file.size / 1024)}KB → ${Math.round(full.bytes / 1024)}KB`,
    ip: clientIp(req),
  });

  return ok(result, { status: 201 });
});
