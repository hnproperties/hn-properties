import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';

/**
 * Marks every lead the caller can see as viewed.
 *
 * Called when the Leads screen opens, so the desk highlight clears once the
 * leads have actually been looked at. Deliberately not tied to opening a single
 * lead: the highlight answers "is there anything new?", and once you are on the
 * list you have your answer.
 *
 * Scoping mirrors the leads resource — someone who only sees their own leads
 * clears only their own, so this never hides a colleague's new arrivals.
 */
export const POST = route(async (_req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'lead.view') && !can(user, 'lead.view.all')) throw forbidden();

  const scope = can(user, 'lead.view.all') ? {} : { assignedToId: user.id };

  const result = await prisma.lead.updateMany({
    where: { ...scope, viewedAt: null },
    data: { viewedAt: new Date() },
  });

  return NextResponse.json({ data: { marked: result.count } });
});
