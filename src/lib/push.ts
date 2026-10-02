/**
 * Web Push delivery helpers (VAPID via the `web-push` package).
 *
 * Two entry points for the two audiences:
 *   sendPushToUsers(userIds, payload)       — staff, keyed by User.id
 *   sendPushToOwners(ownerIds, payload)     — owners, keyed by OwnerAccount.id
 *
 * Both are fire-and-forget from the caller's perspective: they never throw,
 * and they prune dead endpoints (HTTP 404 / 410) automatically so the database
 * doesn't fill with stale subscriptions.
 *
 * Payload shape must match what the service worker's push handler expects:
 *   { title, body?, href?, tag?, kind? }
 */

import webpush from 'web-push';
import { prisma } from './prisma';

export type PushPayload = {
  title: string;
  body?: string;
  href?: string;
  /** Coalesces repeated notifications of the same kind into one entry. */
  tag?: string;
  /** Mirrors the `kind` field on the Notification model for routing. */
  kind?: string;
};

// VAPID setup — called once per process on first use.
let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error('[push] VAPID env vars are not set (VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
}

/** Send to all registered devices for a list of staff user IDs. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: unique } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  await deliverAndPrune(subs, payload);
}

/** Send to all registered devices for a list of owner account IDs. */
export async function sendPushToOwners(ownerAccountIds: string[], payload: PushPayload): Promise<void> {
  const unique = [...new Set(ownerAccountIds.filter(Boolean))];
  if (!unique.length) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { ownerAccountId: { in: unique } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  await deliverAndPrune(subs, payload);
}

// ─── Internal ────────────────────────────────────────────────────────────────

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliverAndPrune(subs: SubRow[], payload: PushPayload): Promise<void> {
  if (!subs.length) return;

  try {
    ensureVapid();
  } catch (err) {
    console.error('[push] VAPID not configured:', err);
    return;
  }

  const body = JSON.stringify(payload);
  const deadIds: string[] = [];

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
        .then(() => ({ id: sub.id, ok: true as const }))
        .catch((err: unknown) => ({ id: sub.id, ok: false as const, err })),
    ),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && !result.value.ok) {
      const { id, err } = result.value;
      // 404 / 410 = subscription is gone on the push service side; prune it.
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        deadIds.push(id);
      } else {
        console.error('[push] delivery failed for subscription', id, err);
      }
    }
  }

  if (deadIds.length) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: deadIds } } })
      .catch((err) => console.error('[push] failed to prune dead subscriptions', err));
  }
}
