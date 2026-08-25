import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';
import { matchesForListing } from '@/lib/matching';

export const dynamic = 'force-dynamic';

/** Which waiting clients fit this listing. Private by definition. */
export const GET = route(async (_req, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'requirement.view') && !can(user, 'requirement.view.all')) throw forbidden();

  const results = await matchesForListing(params.id);
  const requirements = await prisma.requirement.findMany({
    where: { id: { in: results.map((r) => r.requirementId) } },
    include: { client: { select: { id: true, name: true, phone: true, code: true, assignedToId: true } } },
  });

  const visible = can(user, 'requirement.view.all')
    ? requirements
    : requirements.filter((r) => r.assignedToId === user.id || r.client.assignedToId === user.id);

  const byId = new Map(visible.map((r) => [r.id, r]));
  return ok(plain(results.map((r) => ({ ...r, requirement: byId.get(r.requirementId) })).filter((r) => r.requirement)));
});
