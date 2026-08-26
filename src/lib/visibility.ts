import type { Prisma } from '@prisma/client';
import type { CurrentUser } from './auth';
import { can } from './rbac';

/**
 * Layer 1 of the privacy model: fixed projections.
 *
 * The public site reads Listing and pulls only the columns below from Property.
 * Exact address, coordinates, owner, minimum price, motivation, internal score,
 * private notes and documents are not in this select, so they cannot leak through
 * a serialisation mistake — they are never fetched in the first place.
 */
export const PUBLIC_LISTING_SELECT = {
  id: true,
  publicId: true,
  slug: true,
  listingType: true,
  price: true,
  pricePerUnit: true,
  isPriceOnRequest: true,
  isNegotiable: true,
  maintenance: true,
  securityDeposit: true,
  leaseMonths: true,
  lockInMonths: true,
  escalationPct: true,
  publicTitle: true,
  publicDescription: true,
  seoTitle: true,
  seoDescription: true,
  ogImageUrl: true,
  isFeatured: true,
  isHotDeal: true,
  hotDealNote: true,
  hotDealUntil: true,
  status: true,
  publishedAt: true,
  viewCount: true,
  publicLocation: { select: { id: true, name: true, slug: true, type: true, latitude: true, longitude: true } },
  property: {
    select: {
      id: true,
      title: true,
      summary: true,
      colony: true,
      landmark: true,
      plotArea: true,
      builtUpArea: true,
      carpetArea: true,
      superBuiltArea: true,
      areaUnit: true,
      frontFeet: true,
      depthFeet: true,
      totalFloors: true,
      floorNumber: true,
      bedrooms: true,
      bathrooms: true,
      balconies: true,
      parkingCovered: true,
      parkingOpen: true,
      furnishing: true,
      constructionYear: true,
      frontageFeet: true,
      ceilingHeightFt: true,
      roadWidthFeet: true,
      powerKva: true,
      loadingAccess: true,
      suitableFor: true,
      facing: true,
      isCorner: true,
      isMainRoad: true,
      isGated: true,
      isReadyToMove: true,
      amenities: true,
      isVerified: true,
      category: { select: { id: true, name: true, slug: true, segment: true, isLand: true } },
      location: { select: { id: true, name: true, slug: true, type: true, parent: { select: { name: true, slug: true } } } },
      media: {
        where: { isPublic: true },
        select: { id: true, url: true, thumbUrl: true, alt: true, caption: true, isCover: true, sortOrder: true },
      },
    },
  },
} satisfies Prisma.ListingSelect;

/** Only published, publicly-visible listings in a live state ever leave the server. */
export const PUBLIC_LISTING_WHERE: Prisma.ListingWhereInput = {
  visibility: 'PUBLIC',
  status: { in: ['PUBLISHED'] },
  property: { isArchived: false },
};

/** "Coming soon" teasers: shown without commercial detail when explicitly made public. */
export const COMING_SOON_WHERE: Prisma.ListingWhereInput = {
  visibility: 'PUBLIC',
  status: 'COMING_SOON',
};

/** Partners see the public shape plus availability dates — never owner or commercials. */
export const PARTNER_LISTING_SELECT = {
  ...PUBLIC_LISTING_SELECT,
  lastCheckedAt: true,
  expiresAt: true,
} satisfies Prisma.ListingSelect;

export const PARTNER_LISTING_WHERE: Prisma.ListingWhereInput = {
  visibility: { in: ['PUBLIC', 'PARTNER'] },
  status: { in: ['PUBLISHED', 'VERIFIED', 'COMING_SOON'] },
  property: { isArchived: false },
};

type AnyRecord = Record<string, any>;

const ADDRESS_FIELDS = ['addressLine', 'mapLink', 'latitude', 'longitude', 'pincode', 'ward', 'road'];
const PRIVATE_FIELDS = [
  'minimumPrice',
  'ownerExpectation',
  'negotiationNote',
  'motivation',
  'internalScore',
  'sourceType',
  'sourceDetail',
  'privateNotes',
];

/**
 * Layer 2: permission masking on authenticated responses. Applied after the query,
 * on top of the projections above, so a CRM route cannot hand a sales employee a
 * field their role does not carry.
 */
export function maskProperty(row: AnyRecord | null, user: CurrentUser | null): AnyRecord | null {
  if (!row) return row;
  const out: AnyRecord = { ...row };
  if (!can(user, 'property.address.view')) for (const f of ADDRESS_FIELDS) delete out[f];
  if (!can(user, 'property.private.view')) for (const f of PRIVATE_FIELDS) delete out[f];
  if (!can(user, 'owner.contact.view')) {
    delete out.owner;
    delete out.ownerId;
  } else if (out.owner) {
    out.owner = maskOwner(out.owner, user);
  }
  if (!can(user, 'property.document.view')) delete out.documents;
  return out;
}

export function maskOwner(row: AnyRecord | null, user: CurrentUser | null): AnyRecord | null {
  if (!row) return row;
  if (can(user, 'owner.contact.view')) return row;
  const { phone, altPhone, whatsapp, email, address, notes, ...rest } = row;
  return rest;
}

export function maskDeal(row: AnyRecord | null, user: CurrentUser | null): AnyRecord | null {
  if (!row) return row;
  if (can(user, 'deal.commission.view')) return row;
  const { commissions, ...rest } = row;
  return rest;
}

export function maskMany<T extends AnyRecord>(
  rows: T[],
  user: CurrentUser | null,
  masker: (row: AnyRecord | null, user: CurrentUser | null) => AnyRecord | null,
) {
  return rows.map((row) => masker(row, user) as T);
}
