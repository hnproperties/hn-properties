import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, notFound, badRequest } from '@/lib/errors';
import { audit, activity } from '@/lib/audit';
import { emitChange } from '@/lib/events';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Quick status changes from the inventory screens: a deal has completed, or a
 * rental has come free again.
 *
 * Sold and rented take the listing off the website but keep the record, its
 * photographs and its history — the public ID never changes, so bringing a rental
 * back later is one click rather than a re-entry.
 */
const ACTIONS = {
  sold: { status: 'SOLD', visibility: 'PRIVATE', label: 'Marked sold' },
  rented: { status: 'RENTED', visibility: 'PRIVATE', label: 'Marked rented out' },
  hold: { status: 'ON_HOLD', visibility: 'PRIVATE', label: 'Put on hold' },
  'off-market': { status: 'OFF_MARKET', visibility: 'PRIVATE', label: 'Taken off-market' },
  available: { status: 'PUBLISHED', visibility: 'PUBLIC', label: 'Back on the market' },
} as const;

export const POST = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();

  const body = (await readJson(req)) as { action?: keyof typeof ACTIONS };
  const action = body.action && ACTIONS[body.action];
  if (!action) throw badRequest('Unknown status change');

  // Taking something off the market is an everyday edit; putting it back is publishing.
  const permission = body.action === 'available' ? 'property.publish' : 'property.edit';
  if (!can(user, permission)) throw forbidden('Your role cannot make that change');

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing) throw notFound('Listing not found');

  if (body.action === 'available' && listing.publicId.startsWith('PENDING-')) {
    throw badRequest('This has never been published — use the review queue instead');
  }

  // Zero means no expiry: a published listing stays until it is sold, rented or removed.
  const expiryDays = Number(await getSetting('listing.default.expiryDays', 0));
  const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86_400_000) : null;

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      status: action.status as any,
      visibility: action.visibility as any,
      publishedAt: body.action === 'available' ? new Date() : listing.publishedAt,
      expiresAt: body.action === 'available' ? expiresAt : null,
      lastCheckedAt: new Date(),
    },
  });

  await audit({
    user,
    action: `listing.${body.action}`,
    entityType: 'listing',
    entityId: listing.id,
    entityCode: listing.publicId,
    summary: action.label,
    ip: clientIp(req),
  });
  await activity({
    entityType: 'listing',
    entityId: listing.id,
    propertyId: listing.propertyId,
    userId: user.id,
    action: action.label,
  });

  revalidatePath('/');
  revalidatePath('/buy');
  revalidatePath('/rent');
  revalidatePath(`/property/${listing.publicId}`);
  emitChange({ kind: 'changed', publicFacing: true, title: listing.publicTitle });

  return ok(plain(updated));
});
