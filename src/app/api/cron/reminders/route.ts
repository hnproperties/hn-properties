import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUsers } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * Fires any reminder (Follow-up or Site Visit) whose time has arrived. Meant to
 * be called every few minutes by an external scheduler (cron-job.org) — Vercel's
 * own Cron only runs once a day on this project's plan, far too coarse for
 * something meant to feel like an alarm going off near the actual time. "Add
 * reminder" sets reminderRequested on the record; this is what actually acts on
 * it, which is why that button alone was never enough on its own.
 *
 * Same Bearer-token auth as /api/cron/daily, and the same CRON_SECRET — nothing
 * new to configure beyond pointing the scheduler's URL at this path with that
 * header set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const now = new Date();
  let sent = 0;

  const dueFollowUps = await prisma.followUp.findMany({
    where: { reminderRequested: true, remindedAt: null, dueAt: { lte: now }, assignedToId: { not: null } },
    select: { id: true, note: true, assignedToId: true, leadId: true },
  });
  for (const f of dueFollowUps) {
    await sendPushToUsers([f.assignedToId!], {
      title: '⏰ Reminder: follow-up due',
      body: f.note || 'A follow-up you set a reminder for is due now.',
      href: '/crm/follow-ups',
      tag: `followup-${f.id}`,
      kind: 'REMINDER',
    });
    await prisma.followUp.update({ where: { id: f.id }, data: { remindedAt: now } });
    sent += 1;
  }

  const dueVisits = await prisma.siteVisit.findMany({
    where: { reminderRequested: true, remindedAt: null, scheduledAt: { lte: now }, agentId: { not: null } },
    select: { id: true, code: true, agentId: true },
  });
  for (const v of dueVisits) {
    await sendPushToUsers([v.agentId!], {
      title: '⏰ Reminder: site visit due',
      body: `Site visit ${v.code} is due now.`,
      href: '/crm/site-visits',
      tag: `visit-${v.id}`,
      kind: 'REMINDER',
    });
    await prisma.siteVisit.update({ where: { id: v.id }, data: { remindedAt: now } });
    sent += 1;
  }

  return NextResponse.json({ data: { sent } });
}
