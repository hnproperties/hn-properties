import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can, isPartner } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';
import { PARTNER_LISTING_SELECT, PARTNER_LISTING_WHERE } from '@/lib/visibility';
import { buildPublicWhere, publicOrderBy, type PublicQuery } from '@/lib/search';

export const dynamic = 'force-dynamic';

/**
 * Partner inventory search. Uses its own projection, and the partner's own firm must
 * be approved — a suspended partner keeps the login but loses the inventory.
 */
export const GET = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!isPartner(user) || !can(user, 'partner.portal')) throw forbidden();

  const consultant = user.consultantId
    ? await prisma.consultant.findUnique({ where: { id: user.consultantId }, select: { status: true } })
    : null;
  if (consultant?.status !== 'APPROVED') throw forbidden('Your firm is not approved for inventory access yet');

  const query = Object.fromEntries(req.nextUrl.searchParams) as PublicQuery;
  const page = Math.max(1, Number(query.page ?? 1));
  const perPage = 12;
  const publicWhere = buildPublicWhere(query);
  // Replace the public gate with the partner gate, keeping the user's filters.
  const where = { AND: [PARTNER_LISTING_WHERE, ...(publicWhere.AND as any[]).slice(1)] };

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: PARTNER_LISTING_SELECT,
      orderBy: publicOrderBy(query.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.listing.count({ where }),
  ]);

  return ok({ rows: plain(rows), total, page, perPage });
});
