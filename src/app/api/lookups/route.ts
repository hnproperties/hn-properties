import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, badRequest } from '@/lib/errors';

// Reads the session cookie, so it can never be pre-rendered.
export const dynamic = 'force-dynamic';

/**
 * Select-box options for the CRM forms. Each lookup declares the permission it needs,
 * so this cannot become a side door into a full contact list.
 */
const LOOKUPS: Record<string, { permission?: string; load: (q: string) => Promise<{ value: string; label: string }[]> }> = {
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
    load: async (q) =>
      (await prisma.owner.findMany({
        where: { name: q ? { contains: q, mode: 'insensitive' } : undefined },
        select: { id: true, name: true, code: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((o) => ({ value: o.id, label: `${o.name} · ${o.code}` })),
  },
  clients: {
    permission: 'client.view',
    load: async (q) =>
      (await prisma.client.findMany({
        where: { name: q ? { contains: q, mode: 'insensitive' } : undefined },
        select: { id: true, name: true, code: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((c) => ({ value: c.id, label: `${c.name} · ${c.code}` })),
  },
  properties: {
    permission: 'property.view',
    load: async (q) =>
      (await prisma.property.findMany({
        where: { isArchived: false, OR: q ? [{ title: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] : undefined },
        select: { id: true, code: true, title: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((p) => ({ value: p.id, label: `${p.code} · ${p.title}` })),
  },
  listings: {
    permission: 'property.view',
    load: async (q) =>
      (await prisma.listing.findMany({
        where: { OR: q ? [{ publicTitle: { contains: q, mode: 'insensitive' } }, { publicId: { contains: q, mode: 'insensitive' } }] : undefined },
        select: { id: true, publicId: true, publicTitle: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((l) => ({ value: l.id, label: `${l.publicId} · ${l.publicTitle}` })),
  },
  leads: {
    permission: 'lead.view',
    load: async (q) =>
      (await prisma.lead.findMany({
        where: { name: q ? { contains: q, mode: 'insensitive' } : undefined },
        select: { id: true, name: true, code: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((l) => ({ value: l.id, label: `${l.name} · ${l.code}` })),
  },
  deals: {
    permission: 'deal.view',
    load: async () =>
      (await prisma.deal.findMany({ select: { id: true, code: true }, take: 50, orderBy: { createdAt: 'desc' } })).map((d) => ({
        value: d.id,
        label: d.code,
      })),
  },
  consultants: {
    permission: 'consultant.view',
    load: async () =>
      (await prisma.consultant.findMany({ select: { id: true, firmName: true, code: true }, take: 50 })).map((c) => ({
        value: c.id,
        label: `${c.firmName} · ${c.code}`,
      })),
  },
  requirements: {
    permission: 'requirement.view',
    load: async () =>
      (await prisma.requirement.findMany({
        select: { id: true, code: true, client: { select: { name: true } } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })).map((r) => ({ value: r.id, label: `${r.code} · ${r.client.name}` })),
  },
};

export const GET = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  const name = req.nextUrl.searchParams.get('name') ?? '';
  const lookup = LOOKUPS[name];
  if (!lookup) throw badRequest('Unknown lookup');
  if (lookup.permission && !can(user, lookup.permission) && !can(user, `${lookup.permission}.all`)) throw forbidden();
  return ok(await lookup.load(req.nextUrl.searchParams.get('q') ?? ''));
});
