import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, route, readJson, parse } from '@/lib/api';
import { badRequest } from '@/lib/errors';
import { getCurrentUser } from '@/lib/auth';
import { currentOwner } from '@/lib/owner-session';

export const dynamic = 'force-dynamic';

/**
 * Register (or refresh) a Web Push subscription for the signed-in user.
 *
 * One route serves both audiences: `/api` is passed through untouched on the CRM
 * subdomain, so `crm.hnproperties.co.in/api/push/subscribe` and
 * `www.hnproperties.co.in/api/push/subscribe` both land here. Identity is decided
 * by which session cookie is present — an owner account on the marketplace, a
 * staff user on the CRM — never by anything the client claims about itself.
 *
 * The browser sends an `audience` hint that says which page it is subscribing from;
 * that only *chooses between* the two identities, and the matching session must
 * still exist. It is a hint, not an authority.
 */

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const bodySchema = z.object({
  subscription: subscriptionSchema,
  audience: z.enum(['OWNER', 'STAFF', 'VISITOR']).optional(),
  categories: z.array(z.enum(['LISTINGS', 'HOT_DEALS'])).optional(),
  resubscribe: z.boolean().optional(),
});

type Identity =
  | { audience: 'STAFF'; id: string }
  | { audience: 'OWNER'; id: string }
  | { audience: 'VISITOR' };

/**
 * Resolve the caller's identity, honouring the hint when the matching session exists.
 *
 * A hint of 'VISITOR' is always honoured with no session lookup — that is the
 * point of the audience, anyone can subscribe to the public broadcast channels
 * without signing in.
 */
async function resolveIdentity(hint?: 'OWNER' | 'STAFF' | 'VISITOR'): Promise<Identity | null> {
  if (hint === 'VISITOR') return { audience: 'VISITOR' };
  if (hint === 'OWNER') {
    const owner = await currentOwner();
    return owner ? { audience: 'OWNER', id: owner.id } : null;
  }
  if (hint === 'STAFF') {
    const user = await getCurrentUser();
    return user ? { audience: 'STAFF', id: user.id } : null;
  }
  // No hint: an owner account on the marketplace wins, otherwise fall back to staff.
  const owner = await currentOwner();
  if (owner) return { audience: 'OWNER', id: owner.id };
  const user = await getCurrentUser();
  return user ? { audience: 'STAFF', id: user.id } : null;
}

export const POST = route(async (req: NextRequest) => {
  const body = parse(bodySchema, await readJson(req));
  const identity = await resolveIdentity(body.audience);
  if (!identity) throw badRequest('Please sign in to enable notifications');

  const { endpoint, keys } = body.subscription;
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null;

  const identityFields =
    identity.audience === 'OWNER'
      ? { audience: 'OWNER', ownerAccountId: identity.id, userId: null, categories: [] }
      : identity.audience === 'STAFF'
        ? { audience: 'STAFF', userId: identity.id, ownerAccountId: null, categories: [] }
        : { audience: 'VISITOR', userId: null, ownerAccountId: null, categories: body.categories ?? ['LISTINGS', 'HOT_DEALS'] };

  // Upsert on the unique endpoint: the same device re-subscribing updates keys and
  // lastSeenAt, and an endpoint that changes hands moves to the new identity rather
  // than lingering on the old one.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent, ...identityFields },
    update: { p256dh: keys.p256dh, auth: keys.auth, userAgent, lastSeenAt: new Date(), ...identityFields },
  });

  return ok({ subscribed: true });
});

/** Whether the current identity has at least one registered device. */
export const GET = route(async () => {
  const owner = await currentOwner();
  const user = owner ? null : await getCurrentUser();
  if (!owner && !user) return ok({ signedIn: false, subscribed: false, count: 0 });

  const where = owner ? { ownerAccountId: owner.id } : { userId: user!.id };
  const count = await prisma.pushSubscription.count({ where });
  return ok({ signedIn: true, subscribed: count > 0, count });
});
