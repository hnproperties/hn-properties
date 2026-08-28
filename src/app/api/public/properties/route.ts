import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { ok, route, clientIp } from '@/lib/api';
import { tooMany } from '@/lib/errors';
import { hashIp } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { PUBLIC_LISTING_SELECT } from '@/lib/visibility';
import { buildPublicWhere, publicOrderBy, PAGE_SIZE, type PublicQuery } from '@/lib/search';

export const dynamic = 'force-dynamic';

/*
 * Rate limit for the open listing search.
 *
 * This endpoint returns clean, paginated JSON — which makes it a far easier way to
 * copy the inventory than parsing the website's HTML. It cannot be closed, because
 * the listings are public on purpose and this is the same data any visitor sees,
 * so the aim is only to make bulk collection slow rather than instant.
 *
 * 60 a minute is far above anything a person browsing could produce, and far below
 * what emptying the catalogue in one sitting would need. It does not apply to the
 * website's own pages: those render server-side through lib/public-data and never
 * call this route, so a visitor cannot trip it however fast they click.
 */
const LIMIT = 60;
const WINDOW_MS = 60 * 1000;

/** Open, read-only listing search. Uses the same projection as the website itself. */
export const GET = route(async (req: NextRequest) => {
  const key = hashIp(clientIp(req)) ?? 'unknown';
  const limit = rateLimit(`public-properties:${key}`, LIMIT, WINDOW_MS);
  if (!limit.allowed) throw tooMany('Too many requests — please slow down and try again shortly');

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
