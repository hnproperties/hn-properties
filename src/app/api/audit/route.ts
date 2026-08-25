import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'audit.view')) throw forbidden();

  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Number(p.get('page') ?? 1));
  const perPage = Math.min(100, Number(p.get('perPage') ?? 50));
  const where = {
    ...(p.get('action') ? { action: { contains: p.get('action')!, mode: 'insensitive' as const } } : {}),
    ...(p.get('userId') ? { userId: p.get('userId')! } : {}),
    ...(p.get('entityType') ? { entityType: p.get('entityType')! } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { name: true, code: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return ok({ rows: plain(rows), total, page, perPage });
});
