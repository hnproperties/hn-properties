import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can, denyPartner } from '@/lib/rbac';
import { forbidden, badRequest } from '@/lib/errors';
import type { CurrentUser } from '@/lib/auth';

// Reads the session cookie, so it can never be pre-rendered.
export const dynamic = 'force-dynamic';

/**
 * Select-box options for the CRM forms.
 *
 * Each lookup declares the permission it needs — but a permission alone was not
 * enough. The list screens narrow their rows to the ones a user owns whenever they
 * lack the matching `*.view.all` grant, and these lookups did not: they checked
 * `owner.view` and then queried the whole table. A sales employee correctly saw
 * only their own owners on /crm/owners, and then every owner in the business the
 * moment they opened a picker on any form. The requirements lookup was worse,
 * since its label carries the client's name.
 *
 * So each lookup that reads a scoped table now also declares `scope`, returning
 * the same predicate its resource definition uses. Reference data — users, roles,
 * categories, localities — has no scope, because it is the same for everyone.
 */
type Scoped = {
  permission?: string;
  /** Row filter applied when the user lacks `<permission>.all`. Mirrors the resource definitions. */
  scope?: (user: CurrentUser) => Record<string, unknown>;
  load: (q: string, where: Record<string, unknown>) => Promise<{ value: string; label: string }[]>;
};

const LOOKUPS: Record<string, Scoped> = {
  users: {
    load: async (q) =>
      (await prisma.user.findMany({
        where: { isActive: true, role: { key: { not: 'PARTNER' } }, name: q ? { contains: q, mode: 'insensitive' } : undefined },
        select: { id: true, name: true, role: { select: { name: true } } },
        take: 50,
        orderBy: { name: 'asc' },
      })).map((u) => ({ value: u.id, label: `${u.name} · ${u.role.name}` })),
  },
  roles: {
    load: async () =>
      (await prisma.role.findMany({ orderBy: { rank: 'asc' } })).map((r) => ({ value: r.id, label: r.name })),
  },
  categories: {
    load: async (q) =>
      (await prisma.propertyCategory.findMany({
        where: { isActive: true, name: q ? { contains: q, mode: 'insensitive' } : undefined },
        orderBy: [{ segment: 'asc' }, { sortOrder: 'asc' }],
        take: 100,
      })).map((c) => ({
        value: c.id,
        label: `${c.name} · ${c.segment.toLowerCase()}`,
        // The entry form uses these to decide which detail fields to show, so a
        // land category never asks for bedrooms and a flat never asks frontage.
        segment: c.segment,
        hasBedrooms: c.hasBedrooms,
        hasFurnishing: c.hasFurnishing,
        hasFrontage: c.hasFrontage,
        isLand: c.isLand,
      })),
  },
  locations: {
    load: async (q) =>
      (await prisma.location.findMany({
        where: { isActive: true, type: { in: ['CITY', 'AREA', 'LOCALITY'] }, name: q ? { contains: q, mode: 'insensitive' } : undefined },
        include: { parent: { select: { name: true } } },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        take: 100,
      })).map((l) => ({ value: l.id, label: l.parent ? `${l.name}, ${l.parent.name}` : l.name })),
  },
  owners: {
    permission: 'owner.view',
    scope: (user) => ({ assignedToId: user.id }),
    load: async (q, where) =>
      (await prisma.owner.findMany({
        where: { AND: [where, { name: q ? { contains: q, mode: 'insensitive' } : undefined }] },
        select: { id: true, name: true, code: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((o) => ({ value: o.id, label: `${o.name} · ${o.code}` })),
  },
  clients: {
    permission: 'client.view',
    scope: (user) => ({ assignedToId: user.id }),
    load: async (q, where) =>
      (await prisma.client.findMany({
        where: { AND: [where, { name: q ? { contains: q, mode: 'insensitive' } : undefined }] },
        select: { id: true, name: true, code: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((c) => ({ value: c.id, label: `${c.name} · ${c.code}` })),
  },
  properties: {
    permission: 'property.view',
    scope: (user) => ({ OR: [{ assignedToId: user.id }, { createdById: user.id }] }),
    load: async (q, where) =>
      (await prisma.property.findMany({
        where: {
          AND: [
            where,
            { isArchived: false },
            { OR: q ? [{ title: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] : undefined },
          ],
        },
        select: { id: true, code: true, title: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((p) => ({ value: p.id, label: `${p.code} · ${p.title}` })),
  },
  listings: {
    permission: 'property.view',
    scope: (user) => ({
      OR: [{ assignedToId: user.id }, { property: { createdById: user.id } }, { property: { assignedToId: user.id } }],
    }),
    load: async (q, where) =>
      (await prisma.listing.findMany({
        where: {
          AND: [
            where,
            { OR: q ? [{ publicTitle: { contains: q, mode: 'insensitive' } }, { publicId: { contains: q, mode: 'insensitive' } }] : undefined },
          ],
        },
        select: { id: true, publicId: true, publicTitle: true, property: { select: { ownerId: true } } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((l) => ({
        value: l.id,
        label: `${l.publicId} · ${l.publicTitle}`,
        // Carried so picking a listing can fill in its owner, saving a second
        // search for something the property already knows.
        ownerId: l.property?.ownerId ?? undefined,
      })),
  },
  leads: {
    permission: 'lead.view',
    scope: (user) => ({ assignedToId: user.id }),
    load: async (q, where) =>
      (await prisma.lead.findMany({
        where: { AND: [where, { name: q ? { contains: q, mode: 'insensitive' } : undefined }] },
        select: { id: true, name: true, code: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((l) => ({ value: l.id, label: `${l.name} · ${l.code}` })),
  },
  deals: {
    permission: 'deal.view',
    scope: (user) => ({ agentId: user.id }),
    load: async (_q, where) =>
      (await prisma.deal.findMany({ where, select: { id: true, code: true }, take: 50, orderBy: { createdAt: 'desc' } })).map((d) => ({
        value: d.id,
        label: d.code,
      })),
  },
  consultants: {
    // Deliberately unscoped, matching the consultant resource: partner firms are
    // shared context rather than anyone's private rows.
    permission: 'consultant.view',
    load: async () =>
      (await prisma.consultant.findMany({ select: { id: true, firmName: true, code: true }, take: 50 })).map((c) => ({
        value: c.id,
        label: `${c.firmName} · ${c.code}`,
      })),
  },
  requirements: {
    permission: 'requirement.view',
    scope: (user) => ({ OR: [{ assignedToId: user.id }, { client: { assignedToId: user.id } }] }),
    load: async (_q, where) =>
      (await prisma.requirement.findMany({
        where,
        select: { id: true, code: true, client: { select: { name: true } } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((r) => ({ value: r.id, label: `${r.code} · ${r.client.name}` })),
  },
};

export const GET = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  denyPartner(user);

  const name = req.nextUrl.searchParams.get('name') ?? '';
  const lookup = LOOKUPS[name];
  if (!lookup) throw badRequest('Unknown lookup');

  const seesAll = lookup.permission ? can(user, `${lookup.permission}.all`) : true;
  if (lookup.permission && !can(user, lookup.permission) && !seesAll) throw forbidden();

  // `<permission>.all` lifts the row filter; without it the user sees only their
  // own records, exactly as the matching list screen shows them.
  const where = seesAll || !lookup.scope ? {} : lookup.scope(user);

  return ok(await lookup.load(req.nextUrl.searchParams.get('q') ?? '', where));
});
