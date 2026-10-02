import { createHash } from 'crypto';
import { prisma } from './prisma';
import { sendPushToUsers } from './push';
import type { CurrentUser } from './auth';

type AuditInput = {
  user?: CurrentUser | null;
  action: string;
  entityType?: string;
  entityId?: string;
  entityCode?: string;
  summary?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
};

export const hashIp = (ip?: string | null) =>
  ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;

/**
 * Append-only audit trail. Never throws: a logging failure must not roll back the
 * user's actual work, but it should be visible in the server log.
 */
export async function audit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.user?.id ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        entityCode: input.entityCode ?? null,
        summary: input.summary ?? null,
        meta: (input.meta as any) ?? undefined,
        ipHash: hashIp(input.ip),
      },
    });
  } catch (error) {
    console.error('[audit] failed to record', input.action, error);
  }
}

/** Per-record timeline entry, shown on the property/lead/deal pages. */
export async function activity(input: {
  entityType: string;
  entityId: string;
  propertyId?: string | null;
  userId?: string | null;
  action: string;
  detail?: string;
}) {
  try {
    await prisma.activity.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        propertyId: input.propertyId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        detail: input.detail ?? null,
      },
    });
  } catch (error) {
    console.error('[activity] failed to record', input.action, error);
  }
}

export async function notify(userIds: string[], data: { kind: string; title: string; body?: string; href?: string }) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  try {
    await prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, ...data })),
    });
  } catch (error) {
    console.error('[notify] failed', error);
  }

  /*
   * Also push to those users' registered devices, so the alert reaches a phone with
   * the app closed. Kept in its own try/catch and awaited, but it never rejects (see
   * lib/push.ts) — a push-service hiccup must never stop the in-app notification
   * above from being written, nor fail the caller's request.
   */
  try {
    await sendPushToUsers(unique, {
      title: data.title,
      body: data.body,
      href: data.href,
      kind: data.kind,
      // One tag per kind+recipient-set: a run of "overdue follow-ups" collapses into
      // the latest rather than stacking on the lock screen.
      tag: data.kind,
    });
  } catch (error) {
    console.error('[notify] push failed', error);
  }
}
