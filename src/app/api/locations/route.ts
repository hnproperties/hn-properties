import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, parse, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';
import { audit } from '@/lib/audit';

/**
 * Creates a locality on the fly.
 *
 * Localities were seeded once and never editable, so a property in a colony we
 * had not thought of could not be recorded properly. This lets staff add one
 * from wherever a locality is being chosen, rather than having to stop.
 *
 * Deliberately narrow: name and an optional parent city. Coordinates, pincode and
 * ordering are left for later editing — the point is to unblock data entry, not
 * to be a full geography editor.
 */
const schema = z.object({
  name: z.string().trim().min(2, 'Give the locality a name').max(80),
  parentId: z.string().max(60).optional(),
});

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const POST = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  // Anyone who can enter a property can add the locality it sits in; requiring a
  // settings permission would just push the work back to an admin.
  if (!can(user, 'property.create') && !can(user, 'property.edit')) throw forbidden();

  const input = parse(schema, await readJson(req));
  const slug = slugify(input.name);

  // Reuse an existing row rather than creating a near-duplicate: "Napier Town"
  // typed twice should be one locality, not two.
  const existing = await prisma.location.findFirst({
    where: { OR: [{ slug }, { name: { equals: input.name, mode: 'insensitive' } }] },
    select: { id: true, name: true, isActive: true },
  });

  if (existing) {
    if (!existing.isActive) {
      await prisma.location.update({ where: { id: existing.id }, data: { isActive: true } });
    }
    return ok(plain(existing));
  }

  // Default the parent to the configured city so new localities hang off it and
  // appear with the rest rather than floating at the top level.
  const parentId =
    input.parentId ??
    (await prisma.location.findFirst({ where: { type: 'CITY' }, orderBy: { sortOrder: 'asc' }, select: { id: true } }))?.id;

  const created = await prisma.location.create({
    data: {
      name: input.name,
      slug,
      type: 'LOCALITY',
      parentId,
      isActive: true,
      // Sorted after the seeded list so a fresh entry does not jump to the top.
      sortOrder: 500,
    },
    select: { id: true, name: true },
  });

  await audit({ user, action: 'location.created', entityType: 'location', entityId: created.id, summary: created.name, ip: clientIp(req) });
  return ok(plain(created));
});
