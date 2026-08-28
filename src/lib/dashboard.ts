import { prisma } from './prisma';
import type { CurrentUser } from './auth';
import { can } from './rbac';

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Everything the desk screen needs, scoped to what this user is allowed to see. */
export async function getDashboard(user: CurrentUser) {
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const weekAhead = addDays(today, 7);

  const mineOnly = <T extends Record<string, unknown>>(resource: string, clause: T) =>
    can(user, `${resource}.view.all`) ? {} : clause;

  const leadScope = mineOnly('lead', { assignedToId: user.id });
  const visitScope = mineOnly('visit', { agentId: user.id });
  const dealScope = mineOnly('deal', { agentId: user.id });
  const propertyScope = can(user, 'property.view.all')
    ? {}
    : { property: { OR: [{ assignedToId: user.id }, { createdById: user.id }] } };

  const [
    liveSale, liveRent, offMarket, comingSoon, pendingVerification, expiring,
    newLeads, openLeads, followUpsToday, followUpsOverdue,
    visitsToday, visitsWeek, activeDeals, wonDeals,
    latestLeads, nextVisits, dueFollowUps, leadsBySource, brokerage,
  ] = await Promise.all([
    prisma.listing.count({ where: { ...propertyScope, status: 'PUBLISHED', listingType: 'SALE' } }),
    prisma.listing.count({ where: { ...propertyScope, status: 'PUBLISHED', listingType: { in: ['RENT', 'LEASE'] } } }),
    prisma.listing.count({ where: { ...propertyScope, status: 'OFF_MARKET' } }),
    prisma.listing.count({ where: { ...propertyScope, status: 'COMING_SOON' } }),
    prisma.listing.count({ where: { ...propertyScope, status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] } } }),
    prisma.listing.count({ where: { ...propertyScope, status: 'PUBLISHED', expiresAt: { lte: addDays(today, 14) } } }),
    prisma.lead.count({ where: { ...leadScope, viewedAt: null } }),
    prisma.lead.count({ where: { ...leadScope, status: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } } }),
    prisma.followUp.count({ where: { ...mineOnly('lead', { assignedToId: user.id }), isDone: false, dueAt: { gte: today, lt: tomorrow } } }),
    prisma.followUp.count({ where: { ...mineOnly('lead', { assignedToId: user.id }), isDone: false, dueAt: { lt: today } } }),
    prisma.siteVisit.count({ where: { ...visitScope, scheduledAt: { gte: today, lt: tomorrow } } }),
    prisma.siteVisit.count({ where: { ...visitScope, scheduledAt: { gte: today, lt: weekAhead } } }),
    prisma.deal.count({ where: { ...dealScope, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } } }),
    prisma.deal.count({ where: { ...dealScope, stage: 'CLOSED_WON' } }),
    prisma.lead.findMany({
      where: leadScope,
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { listing: { select: { publicId: true, publicTitle: true } }, assignedTo: { select: { name: true } } },
    }),
    prisma.siteVisit.findMany({
      where: { ...visitScope, scheduledAt: { gte: today }, status: { in: ['REQUESTED', 'SCHEDULED', 'CONFIRMED'] } },
      orderBy: { scheduledAt: 'asc' },
      take: 6,
      include: { listing: { select: { publicId: true, publicTitle: true } }, client: { select: { name: true, phone: true } } },
    }),
    prisma.followUp.findMany({
      where: { ...mineOnly('lead', { assignedToId: user.id }), isDone: false, dueAt: { lt: tomorrow } },
      orderBy: { dueAt: 'asc' },
      take: 8,
      include: { lead: { select: { id: true, name: true, phone: true } }, client: { select: { name: true, phone: true } }, owner: { select: { name: true } } },
    }),
    prisma.lead.groupBy({ by: ['sourceType'], _count: { _all: true }, where: leadScope }),
    can(user, 'deal.commission.view')
      ? prisma.commission.aggregate({ _sum: { amount: true }, where: { isReceived: true } })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  return {
    properties: { liveSale, liveRent, offMarket, comingSoon, pendingVerification, expiring },
    leads: { newLeads, openLeads, followUpsToday, followUpsOverdue },
    operations: { visitsToday, visitsWeek, activeDeals, wonDeals },
    money: { brokerageReceived: Number(brokerage._sum.amount ?? 0) },
    latestLeads,
    nextVisits,
    dueFollowUps,
    leadsBySource: leadsBySource.map((r) => ({ source: r.sourceType, count: r._count._all })),
  };
}
