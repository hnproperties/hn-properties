import { z } from 'zod';
import * as C from './constants';

/**
 * Empty strings from HTML forms should mean "not provided", not "invalid number".
 * Whitespace, null and undefined are all treated the same way — an optional field
 * must never be the reason a form is rejected.
 */
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ? undefined : v),
    schema,
  );

const num = blankToUndefined(z.coerce.number().finite());
const int = blankToUndefined(z.coerce.number().finite().transform((n) => Math.round(n)));
const str = (max = 500) => blankToUndefined(z.string().trim().max(max));
const text = blankToUndefined(z.string().trim().max(8000));
const bool = z.preprocess((v) => (v === 'on' || v === 'true' ? true : v === 'false' ? false : v), z.boolean());
const date = blankToUndefined(z.coerce.date());
const enumOf = (values: readonly string[]) => blankToUndefined(z.enum(values as [string, ...string[]]));
const list = z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string().trim().max(120)));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, 'Enter a valid phone number');

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: str(20).optional(),
  password: blankToUndefined(z.string().min(8)).optional(),
  roleId: z.string().min(1),
  consultantId: str(60).optional(),
  isActive: bool.optional(),
});

export const locationSchema = z.object({
  type: z.enum(C.LOCATION_TYPES as unknown as [string, ...string[]]),
  name: z.string().trim().min(2).max(120),
  slug: str(120).optional(),
  code: str(8).optional(),
  parentId: str(60).optional(),
  pincode: str(10).optional(),
  latitude: num.optional(),
  longitude: num.optional(),
  isActive: bool.optional(),
  sortOrder: int.optional(),
});

export const categorySchema = z.object({
  segment: z.enum(C.CATEGORY_SEGMENTS as unknown as [string, ...string[]]),
  name: z.string().trim().min(2).max(80),
  slug: str(80).optional(),
  parentId: str(60).optional(),
  hasBedrooms: bool.optional(),
  hasFurnishing: bool.optional(),
  hasFrontage: bool.optional(),
  isLand: bool.optional(),
  isActive: bool.optional(),
  sortOrder: int.optional(),
});

export const ownerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  altPhone: str(20).optional(),
  whatsapp: str(20).optional(),
  email: blankToUndefined(z.string().email()).optional(),
  address: str(300).optional(),
  preferredVia: enumOf(C.CONTACT_METHODS).optional(),
  sourceType: enumOf(C.SOURCE_TYPES).optional(),
  sourceDetail: str(200).optional(),
  notes: text.optional(),
  status: enumOf(C.RECORD_STATUSES).optional(),
  assignedToId: str(60).optional(),
  lastContactAt: date.optional(),
});

export const propertySchema = z.object({
  title: z.string().trim().min(4).max(200),
  summary: text.optional(),
  categoryId: z.string().min(1, 'Choose a category'),
  locationId: z.string().min(1, 'Choose a location'),
  colony: str(120).optional(),
  landmark: str(120).optional(),
  road: str(120).optional(),
  ward: str(60).optional(),
  pincode: str(10).optional(),
  addressLine: str(300).optional(),
  mapLink: str(600).optional(),
  latitude: num.optional(),
  longitude: num.optional(),
  plotArea: num.optional(),
  builtUpArea: num.optional(),
  carpetArea: num.optional(),
  superBuiltArea: num.optional(),
  areaUnit: enumOf(C.AREA_UNITS).optional(),
  frontFeet: num.optional(),
  depthFeet: num.optional(),
  totalFloors: int.optional(),
  floorNumber: int.optional(),
  bedrooms: int.optional(),
  bathrooms: int.optional(),
  balconies: int.optional(),
  parkingCovered: int.optional(),
  parkingOpen: int.optional(),
  furnishing: enumOf(C.FURNISHINGS).optional(),
  constructionYear: int.optional(),
  frontageFeet: num.optional(),
  ceilingHeightFt: num.optional(),
  roadWidthFeet: num.optional(),
  powerKva: num.optional(),
  loadingAccess: bool.optional(),
  suitableFor: list.optional(),
  footfallNote: str(200).optional(),
  facing: enumOf(C.FACINGS).optional(),
  isCorner: bool.optional(),
  isMainRoad: bool.optional(),
  isGated: bool.optional(),
  isReadyToMove: bool.optional(),
  amenities: list.optional(),
  minimumPrice: num.optional(),
  ownerExpectation: num.optional(),
  negotiationNote: text.optional(),
  motivation: enumOf(C.MOTIVATIONS).optional(),
  internalScore: blankToUndefined(z.coerce.number().int().min(0).max(100)).optional(),
  sourceType: enumOf(C.SOURCE_TYPES).optional(),
  sourceDetail: str(200).optional(),
  privateNotes: text.optional(),
  ownerId: str(60).optional(),
  assignedToId: str(60).optional(),
  media: z
    .array(
      z.object({
        url: z.string().trim().min(1).max(600),
        thumbUrl: str(600).optional(),
        alt: str(160).optional(),
        caption: str(200).optional(),
        isCover: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});

export const listingSchema = z.object({
  propertyId: z.string().min(1),
  listingType: z.enum(C.LISTING_TYPES as unknown as [string, ...string[]]),
  status: enumOf(C.LISTING_STATUSES).optional(),
  visibility: enumOf(C.VISIBILITIES).optional(),
  isFeatured: bool.optional(),
  isHotDeal: bool.optional(),
  hotDealNote: str(160).optional(),
  hotDealUntil: date.optional(),
  price: num.optional(),
  isPriceOnRequest: bool.optional(),
  isNegotiable: bool.optional(),
  maintenance: num.optional(),
  securityDeposit: num.optional(),
  leaseMonths: int.optional(),
  lockInMonths: int.optional(),
  escalationPct: num.optional(),
  publicTitle: z.string().trim().min(4).max(200),
  publicDescription: text.optional(),
  publicLocationId: str(60).optional(),
  seoTitle: str(160).optional(),
  seoDescription: str(320).optional(),
  ogImageUrl: blankToUndefined(z.string().trim().max(600)).optional(),
  expiresAt: date.optional(),
  nextCheckAt: date.optional(),
  assignedToId: str(60).optional(),
});

export const clientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  whatsapp: str(20).optional(),
  email: blankToUndefined(z.string().email()).optional(),
  kind: enumOf(C.CLIENT_KINDS).optional(),
  budgetMin: num.optional(),
  budgetMax: num.optional(),
  purpose: str(200).optional(),
  financing: enumOf(C.FINANCING_STATUSES).optional(),
  timeline: str(120).optional(),
  notes: text.optional(),
  status: enumOf(C.RECORD_STATUSES).optional(),
  sourceType: enumOf(C.SOURCE_TYPES).optional(),
  assignedToId: str(60).optional(),
  lastContactAt: date.optional(),
});

export const requirementSchema = z.object({
  clientId: z.string().min(1, 'Choose a client'),
  listingType: enumOf(C.LISTING_TYPES).optional(),
  status: enumOf(C.REQUIREMENT_STATUSES).optional(),
  budgetMin: num.optional(),
  budgetMax: num.optional(),
  areaMin: num.optional(),
  areaMax: num.optional(),
  areaUnit: enumOf(C.AREA_UNITS).optional(),
  bedroomsMin: int.optional(),
  bathroomsMin: int.optional(),
  facing: enumOf(C.FACINGS).optional(),
  purpose: str(200).optional(),
  timeline: str(120).optional(),
  notes: text.optional(),
  assignedToId: str(60).optional(),
  categoryIds: list.optional(),
  locationIds: list.optional(),
  isPublic: bool.optional(),
  publicNote: text.optional(),
});

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  whatsapp: str(20).optional(),
  email: blankToUndefined(z.string().email()).optional(),
  message: text.optional(),
  status: enumOf(C.LEAD_STATUSES).optional(),
  priority: enumOf(C.PRIORITIES).optional(),
  sourceType: enumOf(C.SOURCE_TYPES).optional(),
  sourceDetail: str(200).optional(),
  listingId: str(60).optional(),
  clientId: str(60).optional(),
  requirementId: str(60).optional(),
  assignedToId: str(60).optional(),
  lastContactAt: date.optional(),
  lostReason: str(200).optional(),
  notes: text.optional(),
});

export const siteVisitSchema = z.object({
  listingId: z.string().min(1, 'Choose a listing'),
  clientId: str(60).optional(),
  leadId: str(60).optional(),
  scheduledAt: z.coerce.date(),
  status: enumOf(C.VISIT_STATUSES).optional(),
  agentId: str(60).optional(),
  ownerAvailable: bool.optional(),
  feedback: text.optional(),
  interest: enumOf(C.INTEREST_LEVELS).optional(),
  followUpAt: date.optional(),
  notes: text.optional(),
});

export const dealSchema = z.object({
  listingId: z.string().min(1, 'Choose a listing'),
  stage: enumOf(C.DEAL_STAGES).optional(),
  dealType: enumOf(C.LISTING_TYPES).optional(),
  sellerId: str(60).optional(),
  buyerId: str(60).optional(),
  leadId: str(60).optional(),
  askingPrice: num.optional(),
  agreedPrice: num.optional(),
  tokenAmount: num.optional(),
  monthlyRent: num.optional(),
  deposit: num.optional(),
  leaseMonths: int.optional(),
  lockInMonths: int.optional(),
  escalationPct: num.optional(),
  agreementDate: date.optional(),
  registrationDate: date.optional(),
  lostReason: str(200).optional(),
  notes: text.optional(),
  agentId: str(60).optional(),
  consultantId: str(60).optional(),
});

export const offerSchema = z.object({
  dealId: z.string().min(1),
  by: z.enum(['BUYER', 'OWNER']),
  amount: z.coerce.number().positive(),
  note: str(300).optional(),
});

export const paymentSchema = z.object({
  dealId: z.string().min(1),
  direction: enumOf(['INCOMING', 'OUTGOING']).optional(),
  label: z.string().trim().min(2).max(120),
  amount: z.coerce.number().positive(),
  dueAt: date.optional(),
  paidAt: date.optional(),
  method: str(60).optional(),
  reference: str(120).optional(),
  status: enumOf(C.PAYMENT_STATUSES).optional(),
  notes: text.optional(),
});

export const commissionSchema = z.object({
  dealId: z.string().min(1),
  party: z.string().trim().min(2).max(120),
  consultantId: str(60).optional(),
  percent: num.optional(),
  amount: z.coerce.number(),
  isReceived: bool.optional(),
  receivedAt: date.optional(),
  notes: str(300).optional(),
});

export const followUpSchema = z.object({
  dueAt: z.coerce.date(),
  note: str(300).optional(),
  leadId: str(60).optional(),
  clientId: str(60).optional(),
  ownerId: str(60).optional(),
  assignedToId: str(60).optional(),
  isDone: bool.optional(),
});

export const consultantSchema = z.object({
  firmName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  whatsapp: str(20).optional(),
  email: blankToUndefined(z.string().email()).optional(),
  city: str(80).optional(),
  status: enumOf(C.CONSULTANT_STATUSES).optional(),
  commissionPct: num.optional(),
  notes: text.optional(),
});

export const collaborationSchema = z.object({
  consultantId: z.string().min(1),
  listingId: str(60).optional(),
  clientBrief: text.optional(),
  status: enumOf(C.COLLABORATION_STATUSES).optional(),
  sharedFields: list.optional(),
  responseNote: str(500).optional(),
});

export const verificationSchema = z.object({
  propertyId: z.string().min(1),
  ownerIdSeen: bool.optional(),
  siteVisited: bool.optional(),
  docsReceived: bool.optional(),
  photosOurs: bool.optional(),
  availability: bool.optional(),
  notes: text.optional(),
});

export const documentSchema = z.object({
  propertyId: z.string().min(1),
  kind: z.enum(C.DOCUMENT_KINDS),
  title: z.string().trim().min(2).max(160),
  storageKey: z.string().trim().min(2).max(400),
  mimeType: str(120).optional(),
  sizeBytes: int.optional(),
  notes: str(300).optional(),
});

/** Public forms. `website` is a honeypot: real people leave it empty. */
const publicContact = {
  name: z.string().trim().min(2, 'Please tell us your name').max(120),
  phone: phoneSchema,
  whatsapp: str(20).optional(),
  email: blankToUndefined(z.string().email()).optional(),
  website: z.string().optional(),
};

export const enquirySchema = z.object({
  ...publicContact,
  listingId: str(60).optional(),
  message: text.optional(),
  preferredAt: str(120).optional(),
});

export const siteVisitRequestSchema = z.object({
  ...publicContact,
  listingId: z.string().min(1),
  preferredDate: z.coerce.date(),
  preferredTime: str(40).optional(),
  message: text.optional(),
});

export const ownerSubmissionSchema = z.object({
  ...publicContact,
  intent: z.enum(['SELL', 'RENT_OUT']),
  categorySlug: str(80).optional(),
  locality: str(160).optional(),
  landmark: str(160).optional(),
  cityId: str(60).optional(),
  addressLine: str(400).optional(),
  mapLink: str(600).optional(),

  // Measurements — owners rarely have all of these, so every one is optional.
  areaSize: num.optional(),        // plot area
  builtUpArea: num.optional(),
  superBuiltArea: num.optional(),
  carpetArea: num.optional(),
  areaUnit: enumOf(C.AREA_UNITS).optional(),

  bedrooms: int.optional(),
  bathrooms: int.optional(),
  floorNumber: int.optional(),
  totalFloors: int.optional(),
  facing: enumOf(C.FACINGS).optional(),
  furnishing: enumOf(C.FURNISHINGS).optional(),
  constructionYear: int.optional(),
  parkingCovered: int.optional(),

  expectedPrice: num.optional(),
  isNegotiable: bool.optional(),
  description: text.optional(),
  preferredTime: str(60).optional(),
  photos: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v),
    z.array(z.string()).max(15),
  ).optional(),
});

export const publicRequirementSchema = z.object({
  ...publicContact,
  listingType: z.enum(['SALE', 'RENT']),
  categorySlug: str(80).optional(),
  localities: str(300).optional(),
  budgetMin: num.optional(),
  budgetMax: num.optional(),
  areaMin: num.optional(),
  bedroomsMin: int.optional(),
  purpose: str(160).optional(),
  timeline: str(120).optional(),
  notes: text.optional(),
});

export const contactSchema = z.object({
  ...publicContact,
  message: z.string().trim().min(5).max(4000),
});
