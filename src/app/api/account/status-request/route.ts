import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentOwner } from '@/lib/owner-session';
import { notify, activity } from '@/lib/audit';
import { emitChange } from '@/lib/events';

export const dynamic = 'force-dynamic';

/**
 * An owner telling us their property is sold or rented out.
 *
 * Records the request and notifies the desk. It changes nothing about the listing:
 * a staff member calls to confirm and then sets the status in the CRM, which is
 * what actually takes it off the website. That ordering is the whole point — a
 * listing HN has written, photographed and priced should not disappear because
 * someone tapped a button, and a mistaken tap costs a phone call rather than a
 * live listing.
 */
export async function POST(req: NextRequest) {
  const account = await currentOwner();
  if (!account) return Response.json({ error: 'Please sign in' }, { status: 401 });
  if (!account.ownerId) return Response.json({ error: 'No properties on this account' }, { status: 403 });

  let body: { propertyId?: string; requested?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  const requested = body.requested === 'RENTED' ? 'RENTED' : 'SOLD';

  /*
   * The property must belong to this account's owner record.
   *
   * Checked in the query rather than after it, so a guessed or copied property id
   * finds nothing instead of finding someone else's property and raising a request
   * against it.
   */
  const property = await prisma.property.findFirst({
    where: { id: String(body.propertyId ?? ''), ownerId: account.ownerId },
    select: { id: true, code: true, title: true },
  });
  if (!property) return Response.json({ error: 'Property not found' }, { status: 404 });

  // One open request per property; a second tap should not queue a duplicate.
  const existing = await prisma.ownerStatusRequest.findFirst({
    where: { propertyId: property.id, state: 'PENDING' },
    select: { id: true },
  });
  if (existing) return Response.json({ data: { alreadyRequested: true } });

  await prisma.ownerStatusRequest.create({
    data: {
      accountId: account.id,
      propertyId: property.id,
      requested,
      note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
    },
  });

  const wording = requested === 'RENTED' ? 'rented out' : 'sold';

  // Same audience the owner submissions already notify — the people who can act on it.
  const reviewers = await prisma.user.findMany({
    where: { isActive: true, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } } },
    select: { id: true },
  });

  await notify(
    reviewers.map((reviewer: { id: string }) => reviewer.id),
    {
      kind: 'OWNER_STATUS_REQUEST',
      title: `Owner says ${property.code} is ${wording}`,
      body: `${account.name ?? account.email} reported "${property.title}" as ${wording}. Confirm, then set the listing status.`,
      href: `/crm/properties/${property.id}`,
    },
  );

  await activity({
    entityType: 'property',
    entityId: property.id,
    propertyId: property.id,
    action: `Owner reported the property as ${wording} through their account`,
  });

  /*
   * Push it to any open CRM tab straight away.
   *
   * The pulse would pick this up within a few seconds regardless, but this is one
   * of the few things where the delay matters: a listing stays live on the website
   * until someone rings the owner, so an unnoticed report means advertising a
   * property that is no longer for sale.
   */
  emitChange({ kind: 'changed', title: `${property.code} reported ${wording}` });

  return Response.json({ data: { ok: true } });
}
