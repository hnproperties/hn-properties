import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, route, readJson, parse } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { currentOwner } from '@/lib/owner-session';

export const dynamic = 'force-dynamic';

/**
 * Remove a Web Push subscription for the signed-in user.
 *
 * Scoped to the caller's own identity: the delete only touches a row whose
 * endpoint matches AND that belongs to the owner account or staff user making the
 * request. That stops one account removing another's device by passing its endpoint.
 *
 * Called both when the user turns notifications off and on sign-out, so a shared
 * device stops receiving the previous person's alerts.
 */

const bodySchema = z.object({ endpoint: z.string().url() });

export const POST = route(async (req: NextRequest) => {
  const { endpoint } = parse(bodySchema, await readJson(req));

  const owner = await currentOwner();
  const user = owner ? null : await getCurrentUser();
  if (!owner && !user) return ok({ removed: 0 });

  const where = owner
    ? { endpoint, ownerAccountId: owner.id }
    : { endpoint, userId: user!.id };

  const result = await prisma.pushSubscription.deleteMany({ where });
  return ok({ removed: result.count });
});
