import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { emitChange } from '@/lib/events';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, notFound, badRequest } from '@/lib/errors';
import { nextListingPublicId, uniqueListingSlug } from '@/lib/ids';
import { audit, activity, notify } from '@/lib/audit';
import { notifyOwners } from '@/lib/notify-owners';
import { getSetting } from '@/lib/settings';
import { recomputeMatchesForListing } from '@/lib/matching';

/**
 * Decision endpoint for a submitted property: publish, hold as coming soon, or reject.
 *
 * Owner submissions arrive with a placeholder id (PENDING-…) because a public ID is
 * permanent and should only be minted when the listing actually goes to market. That
 * happens here, once, and the id never changes afterwards.
 */
export const POST = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.publish')) throw forbidden('Your role cannot publish listings');

  const body = (await readJson(req)) as { action?: string; reason?: string };
  const action = body.action ?? 'publish';

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { property: { include: { location: { include: { parent: { include: { parent: true } } } } } } },
  });
  if (!listing) throw notFound('Listing not found');

  if (action === 'reject') {
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'REJECTED', visibility: 'PRIVATE' },
    });
    await audit({
      user, action: 'listing.rejected', entityType: 'listing', entityId: listing.id,
      entityCode: listing.publicId, summary: body.reason, ip: clientIp(req),
    });
    await activity({
      entityType: 'listing', entityId: listing.id, propertyId: listing.propertyId, userId: user.id,
      action: 'Submission rejected', detail: body.reason,
    });
    // Tell the owner, so they are not left wondering why their property never appeared.
    if (listing.property.ownerId) {
      await notifyOwners([listing.property.ownerId], {
        kind: 'PROPERTY_REJECTED',
        title: 'An update on your property',
        body: `We could not list "${listing.publicTitle}" as submitted. Our team will reach out to help.`,
        href: '/account',
        tag: 'property-status',
      });
    }
    return ok(plain(updated));
  }

  if (!listing.price && action === 'publish') {
    throw badRequest('Set a price before publishing, or use Coming soon instead');
  }

  if (action === 'publish') {
    const approvedPhotos = await prisma.propertyMedia.count({
      where: { propertyId: listing.propertyId, isPublic: true },
    });
    if (approvedPhotos === 0) {
      throw badRequest('Approve at least one photograph before publishing — owner photographs stay hidden until you do');
    }
  }

  // Mint the permanent public ID on first publication only.
  let publicId = listing.publicId;
  let slug = listing.slug;
  if (publicId.startsWith('PENDING-')) {
    let node: any = listing.property.location;
    let cityCode = 'JBP';
    while (node) {
      if (node.type === 'CITY') {
        cityCode = node.code || node.name?.slice(0, 3).toUpperCase() || 'JBP';
        break;
      }
      node = node.parent;
    }
    publicId = await nextListingPublicId(listing.listingType, cityCode);
    slug = await uniqueListingSlug(listing.publicTitle, publicId);
  }

  // Zero means no expiry: a published listing stays until it is sold, rented or removed.
  const expiryDays = Number(await getSetting('listing.default.expiryDays', 0));
  const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86_400_000) : null;
  const status = action === 'coming-soon' ? 'COMING_SOON' : 'PUBLISHED';

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      publicId,
      slug,
      status,
      visibility: 'PUBLIC',
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      expiresAt: status === 'PUBLISHED' ? expiresAt : null,
      lastCheckedAt: new Date(),
      assignedToId: listing.assignedToId ?? user.id,
    },
  });

  await audit({
    user, action: `listing.${status.toLowerCase()}`, entityType: 'listing', entityId: listing.id,
    entityCode: publicId, summary: `${listing.publicTitle} is now ${status}`, ip: clientIp(req),
  });
  await activity({
    entityType: 'listing', entityId: listing.id, propertyId: listing.propertyId, userId: user.id,
    action: status === 'PUBLISHED' ? 'Published to the website' : 'Marked coming soon', detail: publicId,
  });
  if (listing.assignedToId && listing.assignedToId !== user.id) {
    await notify([listing.assignedToId], { kind: 'LISTING_PUBLISHED', title: `${publicId} is live`, href: '/crm/listings' });
  }

  // The owner's reward moment: their property is on the website. Sent to them, not
  // the desk, so it goes through notifyOwners rather than notify.
  if (listing.property.ownerId) {
    const live = status === 'PUBLISHED';
    await notifyOwners([listing.property.ownerId], {
      kind: 'PROPERTY_PUBLISHED',
      title: live ? 'Your property is live' : 'Your property is coming soon',
      body: live
        ? `"${listing.publicTitle}" is now on the website. We'll let you know about enquiries.`
        : `"${listing.publicTitle}" is being prepared and will appear on the website shortly.`,
      href: '/account',
      tag: 'property-status',
    });
  }

  await recomputeMatchesForListing(listing.id);

  // Public pages are cached; without this the site can serve the old version for
  // a couple of minutes after a change, which looks like the edit did not save.
  revalidatePath('/');
  revalidatePath('/buy');
  revalidatePath('/rent');
  revalidatePath('/categories');
  revalidatePath(`/property/${publicId}`);
  revalidatePath('/crm/review');
  revalidatePath('/crm');

  emitChange({ kind: 'published', publicFacing: true, title: listing.publicTitle });

  return ok(plain(updated));
});
