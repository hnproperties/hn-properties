import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** Aggregates only — no row-level data leaves this endpoint. */
export const GET = route(async (_req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'report.view')) throw forbidden();

  const [byStatus, byType, bySegment, leadsBySource, leadsByStatus, visits, deals, commission] = await Promise.all([
    prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.listing.groupBy({ by: ['listingType'], _count: { _all: true }, _avg: { price: true } }),
    prisma.propertyCategory.findMany({ select: { segment: true, _count: { select: { properties: true } } } }),
    prisma.lead.groupBy({ by: ['sourceType'], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.siteVisit.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.deal.groupBy({ by: ['stage'], _count: { _all: true }, _sum: { agreedPrice: true } }),
    can(user, 'deal.commission.view')
      ? prisma.commission.groupBy({ by: ['isReceived'], _sum: { amount: true }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);

  const segmentTotals = bySegment.reduce<Record<string, number>>((acc, row) => {
    acc[row.segment] = (acc[row.segment] ?? 0) + row._count.properties;
    return acc;
  }, {});

  return ok(plain({ byStatus, byType, segmentTotals, leadsBySource, leadsByStatus, visits, deals, commission }));
});
