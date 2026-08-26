import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, route, clientIp, ok } from '@/lib/api';
import { can } from '@/lib/rbac';
import { ApiError, forbidden, notFound } from '@/lib/errors';
import { readPrivate } from '@/lib/storage';
import { audit } from '@/lib/audit';

/**
 * The only way to reach a private document: authorise, log, then stream the bytes
 * back through this route. Storage keys and storage URLs never appear in any page,
 * API response or redirect, so possession of a link is never enough to read a file.
 */
export const GET = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.document.view')) throw forbidden();

  const document = await prisma.propertyDocument.findUnique({
    where: { id: params.id },
    include: { property: { select: { id: true, code: true, assignedToId: true, createdById: true } } },
  });
  if (!document) throw notFound('Document not found');

  const ownsProperty = document.property.assignedToId === user.id || document.property.createdById === user.id;
  if (!can(user, 'property.view.all') && !ownsProperty) throw forbidden();

  await audit({
    user,
    action: 'document.accessed',
    entityType: 'document',
    entityId: document.id,
    entityCode: document.property.code,
    summary: `${document.kind}: ${document.title}`,
    ip: clientIp(req),
  });

  // Stream the bytes rather than redirecting. A redirect would hand the browser
  // the underlying storage URL, which is readable without any permission check
  // by anyone who later obtains it. Reading server-side keeps that URL private,
  // so this route stays the only way in.
  let file;
  try {
    file = await readPrivate(document.storageKey);
  } catch (error) {
    console.error('[documents] read failed', document.id, error);
    throw new ApiError(502, 'That document could not be retrieved');
  }

  const filename = document.title.replace(/[^a-zA-Z0-9 ._-]/g, '').slice(0, 80) || 'document';

  // NextResponse expects a web BodyInit. A Node Buffer's backing store is typed
  // as ArrayBufferLike (potentially shared), which does not satisfy it, so take
  // a concrete ArrayBuffer slice of exactly this file's bytes.
  const body = file.body.buffer.slice(
    file.body.byteOffset,
    file.body.byteOffset + file.body.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      'Content-Type': document.mimeType ?? file.contentType ?? 'application/octet-stream',
      'Content-Length': String(file.body.length),
      'Content-Disposition': `inline; filename="${filename}"`,
      // Never let a shared cache or CDN hold a copy of a private document.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

export const DELETE = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.delete')) throw forbidden();
  const document = await prisma.propertyDocument.findUnique({ where: { id: params.id } });
  if (!document) throw notFound('Document not found');
  await prisma.propertyDocument.delete({ where: { id: params.id } });
  await audit({ user, action: 'document.deleted', entityType: 'document', entityId: params.id, summary: document.title, ip: clientIp(req) });
  return ok({ id: params.id });
});
