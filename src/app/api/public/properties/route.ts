import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { ok, route } from '@/lib/api';
import { PUBLIC_LISTING_SELECT } from '@/lib/visibility';
import { buildPublicWhere, publicOrderBy, PAGE_SIZE, type PublicQuery } from '@/lib/search';

export const dynamic = 'force-dynamic';

/** Open, read-only listing search. Uses the same projection as the website itself. */
export const GET = route(async (req: NextRequest) => {
  const query = Object.fromEntries(req.nextUrl.searchParams) as PublicQuery;
  const page = Math.max(1, Number(query.page ?? 1));
  const where = buildPublicWhere(query);

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: PUBLIC_LISTING_SELECT,
      orderBy: publicOrderBy(query.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.listing.count({ where }),
  ]);

  return ok({ rows: plain(rows), total, page, perPage: PAGE_SIZE });
});
