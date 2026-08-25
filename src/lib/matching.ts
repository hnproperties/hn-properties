import { prisma } from './prisma';
import { getSettings } from './settings';

/**
 * Requirement ↔ listing matching. Weights live in Settings so the desk can retune
 * the engine without a deploy; the defaults are in settings.ts.
 */
type Weights = { budget: number; location: number; area: number; config: number; headroom: number };

async function weights(): Promise<Weights> {
  const s = await getSettings();
  return {
    budget: Number(s['match.weight.budget'] ?? 35),
    location: Number(s['match.weight.location'] ?? 25),
    area: Number(s['match.weight.area'] ?? 20),
    config: Number(s['match.weight.config'] ?? 20),
    headroom: Number(s['match.budgetHeadroomPct'] ?? 10) / 100,
  };
}

const REQUIREMENT_INCLUDE = { categories: true, locations: true } as const;

const LISTING_FOR_MATCH = {
  id: true,
  publicId: true,
  listingType: true,
  price: true,
  status: true,
  visibility: true,
  publicLocationId: true,
  property: {
    select: {
      categoryId: true,
      locationId: true,
      bedrooms: true,
      bathrooms: true,
      plotArea: true,
      builtUpArea: true,
      carpetArea: true,
      areaUnit: true,
      facing: true,
      location: { select: { id: true, parentId: true } },
    },
  },
} as const;

type MatchResult = { listingId: string; score: number; reasons: string[] };

function usableArea(property: any) {
  return Number(property.builtUpArea ?? property.carpetArea ?? property.plotArea ?? 0);
}

function scorePair(requirement: any, listing: any, w: Weights): MatchResult | null {
  const property = listing.property;
  const reasons: string[] = [];

  // Hard filters — a listing that fails any of these is not a near miss, it is wrong.
  if (listing.listingType !== requirement.listingType) return null;
  const wantedCategories = requirement.categories.map((c: any) => c.categoryId);
  if (wantedCategories.length && !wantedCategories.includes(property.categoryId)) return null;
  if (requirement.bedroomsMin && (property.bedrooms ?? 0) < requirement.bedroomsMin) return null;

  const ceiling = requirement.budgetMax ? Number(requirement.budgetMax) * (1 + w.headroom) : null;
  const price = Number(listing.price ?? 0);
  if (ceiling && price && price > ceiling) return null;

  let score = 0;

  // Budget: full marks inside the range, tapering across the headroom band.
  if (!requirement.budgetMax || !price) {
    score += w.budget * 0.5;
  } else if (price <= Number(requirement.budgetMax)) {
    score += w.budget;
    reasons.push('Within budget');
  } else {
    const over = (price - Number(requirement.budgetMax)) / (Number(requirement.budgetMax) * w.headroom);
    score += w.budget * Math.max(0, 1 - over);
    reasons.push('Slightly over budget');
  }

  // Location: exact locality beats the parent area beats anywhere in the city.
  const wantedLocations = requirement.locations.map((l: any) => l.locationId);
  if (!wantedLocations.length) {
    score += w.location * 0.5;
  } else if (wantedLocations.includes(property.locationId)) {
    score += w.location;
    reasons.push('Preferred locality');
  } else if (property.location?.parentId && wantedLocations.includes(property.location.parentId)) {
    score += w.location * 0.7;
    reasons.push('Nearby locality');
  }

  // Area
  const size = usableArea(property);
  if (!requirement.areaMin && !requirement.areaMax) {
    score += w.area * 0.5;
  } else if (size) {
    const min = Number(requirement.areaMin ?? 0);
    const max = Number(requirement.areaMax ?? Number.MAX_SAFE_INTEGER);
    if (size >= min && size <= max) {
      score += w.area;
      reasons.push('Area fits');
    } else if (size >= min * 0.85 && size <= max * 1.15) {
      score += w.area * 0.6;
      reasons.push('Area close');
    }
  }

  // Configuration
  let configScore = 0;
  let configParts = 0;
  if (requirement.bedroomsMin) {
    configParts += 1;
    if ((property.bedrooms ?? 0) >= requirement.bedroomsMin) {
      configScore += 1;
      reasons.push(`${property.bedrooms} bedrooms`);
    }
  }
  if (requirement.bathroomsMin) {
    configParts += 1;
    if ((property.bathrooms ?? 0) >= requirement.bathroomsMin) configScore += 1;
  }
  if (requirement.facing) {
    configParts += 1;
    if (property.facing === requirement.facing) {
      configScore += 1;
      reasons.push('Preferred facing');
    }
  }
  score += configParts ? (w.config * configScore) / configParts : w.config * 0.5;

  const total = Math.max(0, Math.min(100, Math.round(score)));
  return { listingId: listing.id, score: total, reasons };
}

/** Only inventory that can actually be offered gets matched. */
const MATCHABLE = {
  status: { in: ['PUBLISHED', 'VERIFIED', 'COMING_SOON', 'OFF_MARKET'] as any },
  property: { isArchived: false },
};

export async function matchesForRequirement(requirementId: string, limit = 24): Promise<MatchResult[]> {
  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId }, include: REQUIREMENT_INCLUDE });
  if (!requirement) return [];
  const w = await weights();
  const listings = await prisma.listing.findMany({
    where: { ...MATCHABLE, listingType: requirement.listingType },
    select: LISTING_FOR_MATCH,
    take: 500,
  });
  return listings
    .map((listing) => scorePair(requirement, listing, w))
    .filter((m): m is MatchResult => !!m && m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function recomputeMatchesForRequirement(requirementId: string) {
  const results = await matchesForRequirement(requirementId);
  await prisma.$transaction([
    prisma.requirementMatch.deleteMany({ where: { requirementId, isShared: false, isRejected: false } }),
    prisma.requirementMatch.createMany({
      data: results.map((r) => ({ requirementId, listingId: r.listingId, score: r.score, reasons: r.reasons })),
      skipDuplicates: true,
    }),
  ]);
  return results;
}

/** The other direction: when a listing appears, which clients were waiting for it. */
export async function matchesForListing(listingId: string, limit = 24) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: LISTING_FOR_MATCH });
  if (!listing) return [];
  const w = await weights();
  const requirements = await prisma.requirement.findMany({
    where: { status: { in: ['OPEN', 'MATCHING', 'SHARED'] }, listingType: listing.listingType },
    include: REQUIREMENT_INCLUDE,
    take: 500,
  });
  return requirements
    .map((requirement) => {
      const result = scorePair(requirement, listing, w);
      return result ? { requirementId: requirement.id, score: result.score, reasons: result.reasons } : null;
    })
    .filter((m): m is { requirementId: string; score: number; reasons: string[] } => !!m && m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function recomputeMatchesForListing(listingId: string) {
  const results = await matchesForListing(listingId);
  await prisma.$transaction([
    prisma.requirementMatch.deleteMany({ where: { listingId, isShared: false, isRejected: false } }),
    prisma.requirementMatch.createMany({
      data: results.map((r) => ({ requirementId: r.requirementId, listingId, score: r.score, reasons: r.reasons })),
      skipDuplicates: true,
    }),
  ]);
  return results;
}

/** Duplicate detection before a new property is saved. */
export async function findPossibleDuplicates(input: {
  ownerPhone?: string;
  locationId?: string;
  categoryId?: string;
  plotArea?: number;
  builtUpArea?: number;
}) {
  const size = input.plotArea ?? input.builtUpArea;
  const candidates = await prisma.property.findMany({
    where: {
      isArchived: false,
      OR: [
        input.ownerPhone ? { owner: { phone: input.ownerPhone } } : {},
        input.locationId && input.categoryId ? { locationId: input.locationId, categoryId: input.categoryId } : {},
      ].filter((clause) => Object.keys(clause).length > 0),
    },
    select: {
      id: true, code: true, title: true, plotArea: true, builtUpArea: true,
      owner: { select: { name: true } }, location: { select: { name: true } },
    },
    take: 20,
  });
  if (!size) return candidates;
  return candidates.filter((c) => {
    const other = Number(c.plotArea ?? c.builtUpArea ?? 0);
    return !other || Math.abs(other - size) / Math.max(other, size) < 0.15;
  });
}
