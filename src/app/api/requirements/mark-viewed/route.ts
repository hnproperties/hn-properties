import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';

/**
 * Marks every requirement the caller can see as viewed — the same pattern as
 * /api/leads/mark-viewed. Called when the Requirements screen opens, so the
 * sidebar badge clears once they have actually been looked at. A requirement
 * submitted from the public "Submit Requirement" form had no highlight
 * anywhere in the CRM before this; this is the other half of that fix, the
 * first half being the new count in the pulse route.
 */
export const POST = route(async (_req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'requirement.view') && !can(user, 'requirement.view.all')) throw forbidden();

  const scope = can(user, 'requirement.view.all')
    ? {}
    : { OR: [{ assignedToId: user.id }, { client: { assignedToId: user.id } }] };

  const result = await prisma.requirement.updateMany({
    where: { ...scope, viewedAt: null },
    data: { viewedAt: new Date() },
  });

  return NextResponse.json({ data: { marked: result.count } });
});
