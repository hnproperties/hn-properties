import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

type Hit = { type: string; id: string; code: string; title: string; subtitle?: string; href: string };

/**
 * Global search for the CRM. Looks across properties, listings, owners, clients,
 * leads and deals — but only in the tables this user is allowed to read, and only
 * within their row scope. A public ID like HNP-S-JBP-000004 finds its listing.
 */
export const GET = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  const term = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (term.length < 2) return ok([]);

  const like = { contains: term, mode: 'insensitive' as const };
  const seesAll = (resource: string) => can(user, `${resource}.view.all`);
  const hits: Hit[] = [];

  if (can(user, 'property.view') || seesAll('property')) {
    const [listings, properties] = await Promise.all([
      prisma.listing.findMany({
        where: {
          AND: [
            { OR: [{ publicId: like }, { publicTitle: like }] },
            seesAll('property') ? {} : { property: { OR: [{ assignedToId: user.id }, { createdById: user.id }] } },
          ],
        },
        select: { id: true, publicId: true, publicTitle: true, status: true, propertyId: true },
        take: 6,
      }),
      prisma.property.findMany({
        where: {
          AND: [
            { OR: [{ code: like }, { title: like }, { colony: like }] },
            seesAll('property') ? {} : { OR: [{ assignedToId: user.id }, { createdById: user.id }] },
          ],
        },
        select: { id: true, code: true, title: true, location: { select: { name: true } } },
        take: 6,
      }),
    ]);

    hits.push(
      ...listings.map((l) => ({
        type: 'Listing', id: l.id, code: l.publicId, title: l.publicTitle,
        subtitle: l.status, href: `/crm/properties/${l.propertyId}`,
      })),
      ...properties.map((p) => ({
        type: 'Property', id: p.id, code: p.code, title: p.title,
        subtitle: p.location?.name, href: `/crm/properties/${p.id}`,
      })),
    );
  }

  if (can(user, 'owner.view') || seesAll('owner')) {
    const owners = await prisma.owner.findMany({
      where: {
        AND: [{ OR: [{ name: like }, { phone: like }, { code: like }] }, seesAll('owner') ? {} : { assignedToId: user.id }],
      },
      select: { id: true, code: true, name: true, phone: true },
      take: 5,
    });
    hits.push(...owners.map((o) => ({
      type: 'Owner', id: o.id, code: o.code, title: o.name,
      subtitle: can(user, 'owner.contact.view') ? o.phone : undefined, href: '/crm/owners',
    })));
  }

  if (can(user, 'client.view') || seesAll('client')) {
    const clients = await prisma.client.findMany({
      where: {
        AND: [{ OR: [{ name: like }, { phone: like }, { code: like }] }, seesAll('client') ? {} : { assignedToId: user.id }],
      },
      select: { id: true, code: true, name: true, phone: true },
      take: 5,
    });
    hits.push(...clients.map((c) => ({ type: 'Client', id: c.id, code: c.code, title: c.name, subtitle: c.phone, href: '/crm/clients' })));
  }

  if (can(user, 'lead.view') || seesAll('lead')) {
    const leads = await prisma.lead.findMany({
      where: {
        AND: [{ OR: [{ name: like }, { phone: like }, { code: like }] }, seesAll('lead') ? {} : { assignedToId: user.id }],
      },
      select: { id: true, code: true, name: true, phone: true, status: true },
      take: 5,
    });
    hits.push(...leads.map((l) => ({ type: 'Lead', id: l.id, code: l.code, title: l.name, subtitle: l.phone, href: '/crm/leads' })));
  }

  if (can(user, 'deal.view') || seesAll('deal')) {
    const deals = await prisma.deal.findMany({
      where: { AND: [{ code: like }, seesAll('deal') ? {} : { agentId: user.id }] },
      select: { id: true, code: true, stage: true, listing: { select: { publicTitle: true } } },
      take: 4,
    });
    hits.push(...deals.map((d) => ({ type: 'Deal', id: d.id, code: d.code, title: d.listing?.publicTitle ?? d.code, subtitle: d.stage, href: '/crm/deals' })));
  }

  return ok(plain(hits));
});
