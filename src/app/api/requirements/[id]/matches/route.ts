import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, notFound } from '@/lib/errors';
import { matchesForRequirement } from '@/lib/matching';

export const dynamic = 'force-dynamic';

export const GET = route(async (_req, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'requirement.view') && !can(user, 'requirement.view.all')) throw forbidden();

  const requirement = await prisma.requirement.findFirst({
    where: {
      id: params.id,
      ...(can(user, 'requirement.view.all') ? {} : { OR: [{ assignedToId: user.id }, { client: { assignedToId: user.id } }] }),
    },
  });
  if (!requirement) throw notFound('Requirement not found');

  const results = await matchesForRequirement(params.id);
  const listings = await prisma.listing.findMany({
    where: { id: { in: results.map((r) => r.listingId) } },
    include: {
      property: {
        select: {
          title: true, bedrooms: true, builtUpArea: true, plotArea: true, areaUnit: true,
          category: { select: { name: true } }, location: { select: { name: true } },
          media: { where: { isCover: true }, take: 1, select: { url: true } },
        },
      },
    },
  });

  const byId = new Map(listings.map((l) => [l.id, l]));
  return ok(
    plain(
      results
        .map((r) => ({ ...r, listing: byId.get(r.listingId) }))
        .filter((r) => r.listing),
    ),
  );
});
