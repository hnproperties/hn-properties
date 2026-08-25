import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, route, clientIp, ok } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, notFound } from '@/lib/errors';
import { signedUrl } from '@/lib/storage';
import { audit } from '@/lib/audit';

/**
 * The only way to reach a private document: authorise, log, then redirect to a
 * short-lived signed URL. Storage keys never appear in any page or API response.
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

  return NextResponse.redirect(await signedUrl(document.storageKey, 60));
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
