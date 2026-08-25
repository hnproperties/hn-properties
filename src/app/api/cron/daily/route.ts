import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/audit';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Nightly housekeeping, wired to Vercel Cron. Expires stale listings, flags the ones
 * due for an availability check, and pushes each person their overdue follow-ups.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const now = new Date();
  const recheckDays = Number(await getSetting('listing.recheckDays', 21));

  /*
   * Listings do not expire on their own unless someone has deliberately set an
   * expiry period. With the default of 0 this step does nothing at all, so a
   * published property stays on the website until it is sold, rented or removed.
   */
  const expiryDays = Number(await getSetting('listing.default.expiryDays', 0));
  const expired =
    expiryDays > 0
      ? await prisma.listing.updateMany({
          where: { status: 'PUBLISHED', expiresAt: { lt: now, not: null } },
          data: { status: 'EXPIRED' },
        })
      : { count: 0 };

  const dueForCheck = await prisma.listing.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [{ nextCheckAt: { lte: now } }, { lastCheckedAt: { lte: new Date(now.getTime() - recheckDays * 86_400_000) } }],
    },
    select: { id: true, publicId: true, assignedToId: true },
    take: 200,
  });

  for (const listing of dueForCheck) {
    if (!listing.assignedToId) continue;
    await notify([listing.assignedToId], {
      kind: 'LISTING_RECHECK',
      title: `Confirm availability: ${listing.publicId}`,
      href: '/crm/properties',
    });
  }

  const overdue = await prisma.followUp.groupBy({
    by: ['assignedToId'],
    where: { isDone: false, dueAt: { lt: now } },
    _count: { _all: true },
  });

  for (const row of overdue) {
    if (!row.assignedToId) continue;
    await notify([row.assignedToId], {
      kind: 'FOLLOWUP_OVERDUE',
      title: `${row._count._all} follow-ups overdue`,
      href: '/crm/follow-ups',
    });
  }

  return NextResponse.json({
    data: { expired: expired.count, availabilityChecks: dueForCheck.length, overdueNotified: overdue.length },
  });
}
