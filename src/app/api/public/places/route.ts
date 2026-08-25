import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, route } from '@/lib/api';
import { fuzzySearch } from '@/lib/fuzzy';

export const dynamic = 'force-dynamic';

/**
 * Place lookup for the map picker: curated localities first, then imported
 * landmarks. Matching is forgiving, so a misspelling still finds the place.
 *
 * Public, but read-only and limited to names and coordinates — the same
 * information printed on any signboard.
 */
export const GET = route(async (req: NextRequest) => {
  const term = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (term.length < 2) return ok([]);

  const rows = await prisma.location.findMany({
    where: { isActive: true, type: { in: ['AREA', 'LOCALITY', 'LANDMARK'] } },
    select: { id: true, name: true, type: true, latitude: true, longitude: true },
    take: 4000,
  });

  const matches = fuzzySearch(term, rows, (row) => row.name, 8);

  // A curated locality outranks a landmark of equal closeness.
  const ranked = matches.sort((a, b) => {
    const weight = (type: string) => (type === 'LANDMARK' ? 1 : 0);
    return weight(a.type) - weight(b.type);
  });

  return ok(
    ranked.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.type === 'LANDMARK' ? 'landmark' : 'locality',
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
    })),
  );
});
