import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * A cheap heartbeat for the CRM: counts only, no rows. The browser polls this every
 * few seconds and re-renders the page it is on when a number moves — which is far
 * lighter than re-fetching the whole desk on a timer.
 */
export const GET = route(async () => {
  const user = await currentUserOrThrow();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const seesAll = (resource: string) => can(user, `${resource}.view.all`);
  const leadScope = seesAll('lead') ? {} : { assignedToId: user.id };

  const visitScope = seesAll('visit') ? {} : { agentId: user.id };
  const soon = new Date(now.getTime() + 60 * 60 * 1000); // the next hour

  const [
    pendingReview,
    newLeads,
    dueFollowUps,
    overdueFollowUps,
    visitsToday,
    latestSubmission,
    nextVisit,
  ] = await Promise.all([
    prisma.listing.count({ where: { status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] } } }),
    prisma.lead.count({ where: { ...leadScope, viewedAt: null } }),
    prisma.followUp.count({
      where: { ...leadScope, isDone: false, dueAt: { gte: startOfDay, lt: new Date(startOfDay.getTime() + 86_400_000) } },
    }),
    prisma.followUp.count({ where: { ...leadScope, isDone: false, dueAt: { lt: startOfDay } } }),
    prisma.siteVisit.count({
      where: { ...visitScope, scheduledAt: { gte: startOfDay, lt: new Date(startOfDay.getTime() + 86_400_000) } },
    }),
    prisma.listing.findFirst({
      where: { status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] } },
      orderBy: { createdAt: 'desc' },
      select: { publicTitle: true, createdAt: true },
    }),
    // The next visit within the hour, so the browser can remind whoever is on it.
    prisma.siteVisit.findFirst({
      where: {
        ...visitScope,
        status: { in: ['REQUESTED', 'SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: now, lte: soon },
      },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, scheduledAt: true, listing: { select: { publicTitle: true } }, client: { select: { name: true } } },
    }),
  ]);

  return ok({
    pendingReview,
    newLeads,
    dueFollowUps,
    overdueFollowUps,
    visitsToday,
    latest: latestSubmission ? { title: latestSubmission.publicTitle, at: latestSubmission.createdAt } : null,
    nextVisit: nextVisit
      ? {
          id: nextVisit.id,
          at: nextVisit.scheduledAt,
          title: nextVisit.listing?.publicTitle ?? 'Site visit',
          who: nextVisit.client?.name ?? null,
        }
      : null,
  });
});
