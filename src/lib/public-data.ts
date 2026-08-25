import { cache } from 'react';
import { prisma, plain } from './prisma';
import { PUBLIC_LISTING_SELECT, PUBLIC_LISTING_WHERE, COMING_SOON_WHERE } from './visibility';
import { buildPublicWhere, publicOrderBy, PAGE_SIZE, type PublicQuery } from './search';

/**
 * Every public read goes through here, so the projection and the visibility gate
 * are applied in exactly one place. Each function degrades to empty rather than
 * throwing, so the marketplace still renders if the database is briefly unreachable.
 */
export async function getListings(query: PublicQuery) {
  const page = Math.max(1, Number(query.page ?? 1));
  const where = buildPublicWhere(query);
  try {
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
    return { rows: plain(rows) as any[], total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  } catch (error) {
    console.error('[public] listing query failed', error);
    return { rows: [] as any[], total: 0, page: 1, pages: 1 };
  }
}

export async function getFeatured(take = 6) {
  try {
    return plain(
      await prisma.listing.findMany({
        where: { ...PUBLIC_LISTING_WHERE, isFeatured: true },
        select: PUBLIC_LISTING_SELECT,
        orderBy: { publishedAt: 'desc' },
        take,
      }),
    ) as any[];
  } catch {
    return [];
  }
}

export async function getRecent(take = 6) {
  try {
    return plain(
      await prisma.listing.findMany({
        where: PUBLIC_LISTING_WHERE,
        select: PUBLIC_LISTING_SELECT,
        orderBy: { publishedAt: 'desc' },
        take,
      }),
    ) as any[];
  } catch {
    return [];
  }
}

export async function getComingSoon(take = 3) {
  try {
    return plain(
      await prisma.listing.findMany({ where: COMING_SOON_WHERE, select: PUBLIC_LISTING_SELECT, orderBy: { createdAt: 'desc' }, take }),
    ) as any[];
  } catch {
    return [];
  }
}

export async function getListingByPublicId(publicId: string) {
  try {
    const listing = await prisma.listing.findFirst({
      where: { AND: [{ OR: [{ publicId }, { slug: publicId }] }, { visibility: 'PUBLIC', status: { in: ['PUBLISHED', 'COMING_SOON'] } }] },
      select: PUBLIC_LISTING_SELECT,
    });
    return listing ? (plain(listing) as any) : null;
  } catch {
    return null;
  }
}

export async function getSimilar(listing: any, take = 3) {
  try {
    return plain(
      await prisma.listing.findMany({
        where: {
          ...PUBLIC_LISTING_WHERE,
          id: { not: listing.id },
          listingType: listing.listingType,
          property: { categoryId: listing.property?.category?.id },
        },
        select: PUBLIC_LISTING_SELECT,
        take,
      }),
    ) as any[];
  } catch {
    return [];
  }
}

/** Filter options and the category/locality indexes shown on the home page. */
export const getPublicIndexes = cache(async () => {
  try {
    const [categories, locations, counts] = await Promise.all([
      prisma.propertyCategory.findMany({ where: { isActive: true }, orderBy: [{ segment: 'asc' }, { sortOrder: 'asc' }] }),
      prisma.location.findMany({ where: { isActive: true, type: 'AREA' }, orderBy: { name: 'asc' } }),
      prisma.listing.groupBy({ by: ['listingType'], where: PUBLIC_LISTING_WHERE, _count: { _all: true } }),
    ]);
    return {
      categories: categories.map((c) => ({
        id: c.id,
        value: c.slug,
        label: c.name,
        segment: c.segment,
        hasBedrooms: c.hasBedrooms,
        hasFurnishing: c.hasFurnishing,
        hasFrontage: c.hasFrontage,
        isLand: c.isLand,
      })),
      locations: locations.map((l) => ({ id: l.id, value: l.slug, label: l.name })),
      counts: Object.fromEntries(counts.map((c) => [c.listingType, c._count._all])) as Record<string, number>,
    };
  } catch {
    return { categories: [], locations: [], counts: {} as Record<string, number> };
  }
});

/** Localities that actually have inventory — used for the location landing pages. */
export async function getLocationsWithInventory() {
  try {
    const rows = await prisma.location.findMany({
      where: { isActive: true, type: 'AREA', listings: { some: PUBLIC_LISTING_WHERE } },
      select: { id: true, name: true, slug: true, _count: { select: { listings: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ name: r.name, slug: r.slug, count: r._count.listings }));
  } catch {
    return [];
  }
}

/**
 * Counts for the filter sidebar — how many live listings sit behind each category
 * and locality, so the checkboxes can show numbers like a real marketplace.
 */
export async function getFacets(listingType?: 'SALE' | 'RENT') {
  const where = {
    ...PUBLIC_LISTING_WHERE,
    ...(listingType === 'SALE'
      ? { listingType: 'SALE' as const }
      : listingType === 'RENT'
        ? { listingType: { in: ['RENT', 'LEASE'] as any } }
        : {}),
  };

  try {
    const rows = await prisma.listing.findMany({
      where,
      select: {
        publicLocation: { select: { slug: true, name: true } },
        property: {
          select: {
            category: { select: { slug: true, name: true, segment: true } },
            location: { select: { slug: true, name: true } },
          },
        },
      },
      take: 2000,
    });

    const categories = new Map<string, { value: string; label: string; segment: string; count: number }>();
    const locations = new Map<string, { value: string; label: string; count: number }>();
    const segments = new Map<string, number>();

    for (const row of rows) {
      const category = row.property?.category;
      if (category) {
        const entry = categories.get(category.slug) ?? { value: category.slug, label: category.name, segment: category.segment, count: 0 };
        entry.count += 1;
        categories.set(category.slug, entry);
        segments.set(category.segment, (segments.get(category.segment) ?? 0) + 1);
      }
      const place = row.publicLocation ?? row.property?.location;
      if (place) {
        const entry = locations.get(place.slug) ?? { value: place.slug, label: place.name, count: 0 };
        entry.count += 1;
        locations.set(place.slug, entry);
      }
    }

    return {
      categories: [...categories.values()].sort((a, b) => b.count - a.count),
      locations: [...locations.values()].sort((a, b) => b.count - a.count),
      segments: [...segments.entries()].map(([value, count]) => ({ value, count })),
      total: rows.length,
    };
  } catch {
    return { categories: [], locations: [], segments: [], total: 0 };
  }
}

/**
 * Requirements HN has chosen to publish — what clients are looking for, so owners
 * with a matching property can come forward. The client is never named: only the
 * brief is public.
 */
export async function getPublicRequirements() {
  try {
    const rows = await prisma.requirement.findMany({
      where: { isPublic: true, status: { in: ['OPEN', 'MATCHING', 'SHARED'] } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 60,
      select: {
        id: true,
        code: true,
        listingType: true,
        budgetMin: true,
        budgetMax: true,
        areaMin: true,
        areaMax: true,
        areaUnit: true,
        bedroomsMin: true,
        purpose: true,
        timeline: true,
        publicNote: true,
        publishedAt: true,
        createdAt: true,
        categories: { select: { category: { select: { name: true, slug: true } } } },
        locations: { select: { location: { select: { name: true, slug: true } } } },
      },
    });
    return plain(rows) as any[];
  } catch {
    return [];
  }
}

export async function incrementView(listingId: string) {
  try {
    await prisma.listing.update({ where: { id: listingId }, data: { viewCount: { increment: 1 } } });
  } catch {
    /* a view counter is never worth failing a page render for */
  }
}
