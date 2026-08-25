import type { Prisma } from '@prisma/client';
import { PUBLIC_LISTING_WHERE } from './visibility';

export type PublicQuery = {
  type?: string; // SALE | RENT
  q?: string;
  category?: string; // category slug
  segment?: string;
  location?: string; // location slug
  city?: string;
  min?: string;
  max?: string;
  areaMin?: string;
  areaMax?: string;
  beds?: string;
  bedsMax?: string;
  baths?: string;
  furnishing?: string;
  facing?: string;
  floorMin?: string;
  floorMax?: string;
  parking?: string;
  mainRoad?: string;
  corner?: string;
  gated?: string;
  ready?: string;
  verified?: string;
  featured?: string;
  sort?: string;
  page?: string;
};

const numeric = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * One filter builder, shared by the /buy and /rent pages, the public API and the
 * sitemap — so a listing can never be visible on one surface and hidden on another.
 */
export function buildPublicWhere(query: PublicQuery): Prisma.ListingWhereInput {
  const property: Prisma.PropertyWhereInput = {};
  const and: Prisma.ListingWhereInput[] = [PUBLIC_LISTING_WHERE];

  if (query.category) {
    const slugs = query.category.split(',').map((s) => s.trim()).filter(Boolean);
    property.category = slugs.length > 1 ? { slug: { in: slugs } } : { slug: slugs[0] };
  } else if (query.segment) {
    property.category = { segment: query.segment as any };
  }

  // beds is a minimum, bedsMax an upper bound — together they express "exactly 3 BHK"
  // or "up to 20 rooms" without needing two different filters.
  if (query.beds || query.bedsMax) {
    property.bedrooms = {
      gte: query.beds ? Number(query.beds) : undefined,
      lte: query.bedsMax ? Number(query.bedsMax) : undefined,
    };
  }
  if (query.baths) property.bathrooms = { gte: Number(query.baths) };
  if (query.furnishing) property.furnishing = query.furnishing as any;
  if (query.facing) property.facing = query.facing as any;
  if (query.mainRoad === 'true') property.isMainRoad = true;
  if (query.corner === 'true') property.isCorner = true;
  if (query.gated === 'true') property.isGated = true;
  if (query.ready === 'true') property.isReadyToMove = true;
  if (query.verified === 'true') property.isVerified = true;
  if (query.parking === 'true') property.parkingCovered = { gte: 1 };

  const floorMin = numeric(query.floorMin);
  const floorMax = numeric(query.floorMax);
  if (floorMin || floorMax || query.floorMin === '0') {
    property.floorNumber = { gte: query.floorMin === '0' ? 0 : floorMin, lte: floorMax };
  }

  const areaMin = numeric(query.areaMin);
  const areaMax = numeric(query.areaMax);
  if (areaMin || areaMax) {
    const range = { gte: areaMin, lte: areaMax };
    property.OR = [{ builtUpArea: range }, { carpetArea: range }, { plotArea: range }];
  }

  if (query.location) {
    and.push({
      OR: [
        { publicLocation: { slug: query.location } },
        { property: { location: { slug: query.location } } },
        { property: { location: { parent: { slug: query.location } } } },
      ],
    });
  }
  if (query.city) {
    and.push({
      OR: [
        { property: { location: { slug: query.city } } },
        { property: { location: { parent: { slug: query.city } } } },
        { property: { location: { parent: { parent: { slug: query.city } } } } },
      ],
    });
  }

  if (query.type === 'RENT') and.push({ listingType: { in: ['RENT', 'LEASE'] } });
  else if (query.type === 'SALE') and.push({ listingType: 'SALE' });

  const min = numeric(query.min);
  const max = numeric(query.max);
  if (min || max) and.push({ price: { gte: min, lte: max } });
  if (query.featured === 'true') and.push({ isFeatured: true });

  if (query.q) {
    const term = query.q.trim();
    and.push({
      OR: [
        { publicTitle: { contains: term, mode: 'insensitive' } },
        { publicId: { contains: term, mode: 'insensitive' } },
        { publicDescription: { contains: term, mode: 'insensitive' } },
        { property: { colony: { contains: term, mode: 'insensitive' } } },
        { property: { landmark: { contains: term, mode: 'insensitive' } } },
        { property: { location: { name: { contains: term, mode: 'insensitive' } } } },
        { property: { category: { name: { contains: term, mode: 'insensitive' } } } },
      ],
    });
  }

  if (Object.keys(property).length) and.push({ property });
  return { AND: and };
}

export function publicOrderBy(sort?: string): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case 'price-asc':
      return [{ price: 'asc' }];
    case 'price-desc':
      return [{ price: 'desc' }];
    case 'popular':
      return [{ viewCount: 'desc' }, { publishedAt: 'desc' }];
    case 'oldest':
      return [{ publishedAt: 'asc' }];
    default:
      return [{ isFeatured: 'desc' }, { publishedAt: 'desc' }];
  }
}

export const PAGE_SIZE = 12;
