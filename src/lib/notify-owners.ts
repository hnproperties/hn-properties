import { prisma } from './prisma';
import { sendPushToOwners, type PushPayload } from './push';

/**
 * Owner-facing counterpart to `notify()` in audit.ts.
 *
 * Staff have a `Notification` row they read in the CRM; owners have no such inbox,
 * so this touches nothing in the database — it only sends a web push to owners'
 * registered devices. Because there is no record, a push that no device receives
 * leaves no trace, which is the right weight for "your property went live".
 *
 * Kept out of audit.ts on purpose: `notify()` is the staff trail, and mixing an
 * owner push into it would blur two audiences that must never cross.
 */
export async function notifyOwners(ownerIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(ownerIds.filter(Boolean))];
  if (!unique.length) return;

  /*
   * An owner can be reached directly, or through the OwnerAccount linked to them.
   * A push subscription always hangs off an OwnerAccount (that is the signed-in
   * surface), so resolve the account ids for whichever kind of id we were handed.
   */
  const accounts = await prisma.ownerAccount.findMany({
    where: { OR: [{ id: { in: unique } }, { ownerId: { in: unique } }] },
    select: { id: true },
  });
  if (!accounts.length) return;

  // Never let a push failure surface to the caller — see lib/push.ts, which is
  // itself non-throwing, so this is belt-and-braces around the account lookup.
  try {
    await sendPushToOwners(
      accounts.map((a) => a.id),
      payload,
    );
  } catch (error) {
    console.error('[notifyOwners] push failed', error);
  }
}
