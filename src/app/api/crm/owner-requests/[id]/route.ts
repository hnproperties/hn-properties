import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, notFound, badRequest } from '@/lib/errors';
import { audit, activity } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

/**
 * Resolves an owner's sold or rented-out request.
 *
 * Accepting is the single action that takes the listing off the website: the
 * status moves to SOLD or RENTED, and the public queries only ever return
 * PUBLISHED. Doing both in one transaction means there is no state where the
 * request is closed but the listing is still live.
 */
export const PATCH = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.edit')) throw forbidden();

  const body = await readJson(req);
  const state = body.state === 'DECLINED' ? 'DECLINED' : 'ACCEPTED';

  const request = await prisma.ownerStatusRequest.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      state: true,
      requested: true,
      property: {
        select: {
          id: true,
          code: true,
          listings: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
        },
      },
    },
  });

  if (!request) throw notFound('Request not found');
  if (request.state !== 'PENDING') throw badRequest('That request has already been handled');

  const listingId = request.property.listings[0]?.id;

  await prisma.$transaction(async (tx) => {
    await tx.ownerStatusRequest.update({
      where: { id: request.id },
      data: { state, resolvedById: user.id, resolvedAt: new Date() },
    });

    if (state === 'ACCEPTED' && listingId) {
      await tx.listing.update({
        where: { id: listingId },
        data: { status: request.requested },
      });
    }
  });

  await activity({
    entityType: 'property',
    entityId: request.property.id,
    propertyId: request.property.id,
    action:
      state === 'ACCEPTED'
        ? `Owner report confirmed — listing set to ${request.requested}`
        : 'Owner report dismissed',
  });

  await audit({
    user,
    action: state === 'ACCEPTED' ? 'owner.request.accepted' : 'owner.request.declined',
    entityType: 'property',
    entityId: request.property.id,
    entityCode: request.property.code,
    ip: clientIp(req),
  });

  // The listing has left the public lists, so the cached pages that showed it
  // need rebuilding or it lingers on the site for the rest of the revalidate window.
  if (state === 'ACCEPTED') {
    revalidatePath('/');
    revalidatePath('/buy');
    revalidatePath('/rent');
  }

  return ok({ state });
});
