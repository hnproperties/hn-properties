import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, parse, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';
import { documentSchema } from '@/lib/validators';
import { audit } from '@/lib/audit';

export const GET = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.document.view')) throw forbidden();
  const propertyId = req.nextUrl.searchParams.get('propertyId') ?? undefined;
  const rows = await prisma.propertyDocument.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    // storageKey is deliberately absent: the browser never receives a storage path.
    select: {
      id: true, kind: true, title: true, mimeType: true, sizeBytes: true, notes: true, createdAt: true,
      property: { select: { id: true, code: true, title: true } },
      uploadedBy: { select: { name: true } },
    },
  });
  return ok({ rows: plain(rows), total: rows.length, page: 1, perPage: rows.length });
});

export const POST = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.document.upload')) throw forbidden();
  const input = parse(documentSchema, await readJson(req));
  const row = await prisma.propertyDocument.create({ data: { ...input, uploadedById: user.id } });
  await audit({
    user,
    action: 'document.uploaded',
    entityType: 'document',
    entityId: row.id,
    summary: `${row.kind}: ${row.title}`,
    ip: clientIp(req),
  });
  return ok(plain({ id: row.id, kind: row.kind, title: row.title }), { status: 201 });
});
