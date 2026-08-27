export const LISTING_TYPES = ['SALE', 'RENT', 'LEASE'] as const;
export const LISTING_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_VERIFICATION', 'VERIFIED', 'PUBLISHED', 'ON_HOLD',
  'SOLD', 'RENTED', 'EXPIRED', 'REJECTED', 'OFF_MARKET', 'COMING_SOON', 'ARCHIVED',
] as const;
export const VISIBILITIES = ['PUBLIC', 'PARTNER', 'PRIVATE'] as const;
export const AREA_UNITS = ['SQFT', 'SQM', 'SQYD', 'ACRE', 'HECTARE', 'BIGHA'] as const;
export const FACINGS = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST'] as const;
export const FURNISHINGS = ['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED'] as const;
export const MOTIVATIONS = ['NORMAL', 'MOTIVATED', 'URGENT', 'VERY_URGENT', 'INVESTMENT', 'RELOCATING', 'OTHER'] as const;
export const SOURCE_TYPES = [
  'DIRECT_OWNER', 'EXISTING_CLIENT', 'REFERRAL', 'WEBSITE', 'WHATSAPP', 'INSTAGRAM',
  'FACEBOOK', 'CONSULTANT', 'EMPLOYEE', 'COLD_LEAD', 'OTHER',
] as const;
export const CONTACT_METHODS = ['CALL', 'WHATSAPP', 'EMAIL'] as const;
export const RECORD_STATUSES = ['ACTIVE', 'INACTIVE', 'BLACKLISTED'] as const;
export const CLIENT_KINDS = ['BUYER', 'TENANT', 'INVESTOR', 'SELLER', 'LANDLORD'] as const;
export const FINANCING_STATUSES = ['SELF_FUNDED', 'LOAN_REQUIRED', 'LOAN_APPROVED', 'UNKNOWN'] as const;
export const REQUIREMENT_STATUSES = ['OPEN', 'MATCHING', 'SHARED', 'ON_HOLD', 'FULFILLED', 'CLOSED'] as const;
export const LEAD_STATUSES = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'PROPERTY_SHARED', 'VISIT_SCHEDULED', 'VISIT_COMPLETED',
  'NEGOTIATION', 'TOKEN', 'FOLLOW_UP', 'CLOSED_WON', 'CLOSED_LOST',
] as const;
export const LEAD_BOARD_STATUSES = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'PROPERTY_SHARED', 'VISIT_SCHEDULED', 'NEGOTIATION', 'TOKEN', 'CLOSED_WON',
] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const VISIT_STATUSES = ['REQUESTED', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'] as const;
export const INTEREST_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'NOT_INTERESTED'] as const;
export const DEAL_STAGES = ['DISCUSSION', 'NEGOTIATION', 'TOKEN', 'AGREEMENT', 'REGISTRATION', 'CLOSED_WON', 'CLOSED_LOST'] as const;
export const PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'RECEIVED', 'OVERDUE', 'CANCELLED'] as const;
export const DOCUMENT_KINDS = [
  'REGISTRY', 'SALE_DEED', 'KHASRA', 'B1', 'DIVERSION', 'TAX_RECEIPT', 'NOC', 'MAP',
  'BUILDING_PERMISSION', 'AGREEMENT', 'ID_PROOF', 'OTHER',
] as const;
export const CONSULTANT_STATUSES = ['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'] as const;
export const COLLABORATION_STATUSES = ['PENDING', 'APPROVED', 'SHARED', 'REJECTED', 'CLOSED'] as const;
export const LOCATION_TYPES = ['COUNTRY', 'STATE', 'CITY', 'AREA', 'LOCALITY', 'LANDMARK'] as const;
export const CATEGORY_SEGMENTS = ['RESIDENTIAL', 'COMMERCIAL', 'LAND'] as const;

export const AMENITY_OPTIONS = [
  'Borewell', 'Municipal water', 'Power backup', 'Lift', 'Security', 'CCTV', 'Gated society',
  'Park', 'Club house', 'Gym', 'Swimming pool', 'Covered parking', 'Modular kitchen',
  'Wardrobes', 'Servant room', 'Pooja room', 'Store room', 'Garden', 'Terrace', 'Boundary wall',
  'Corner plot', 'Wide road', 'Fire safety', 'Loading bay', 'Three-phase power',
];

export const BUSINESS_SUITABILITY = [
  'Retail shop', 'Showroom', 'Office', 'Clinic', 'Restaurant', 'Cafe', 'Bank', 'Coaching centre',
  'Warehouse', 'Godown', 'Manufacturing', 'Hotel', 'Hostel', 'School',
];

/** Human labels for every enum value the UI renders. */
export const LABELS: Record<string, string> = {
  SALE: 'Sale', RENT: 'Rent', LEASE: 'Lease',
  DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_VERIFICATION: 'Under verification', VERIFIED: 'Verified',
  PUBLISHED: 'Published', ON_HOLD: 'On hold', SOLD: 'Sold', RENTED: 'Rented', EXPIRED: 'Expired',
  REJECTED: 'Rejected', OFF_MARKET: 'Off-market', COMING_SOON: 'Coming soon', ARCHIVED: 'Archived',
  PUBLIC: 'Public', PARTNER: 'Partners only', PRIVATE: 'Private inventory',
  SQFT: 'Sq.Ft', SQM: 'Sq.M', SQYD: 'Sq.Yd', ACRE: 'Acre', HECTARE: 'Hectare', BIGHA: 'Bigha',
  NORTH: 'North', SOUTH: 'South', EAST: 'East', WEST: 'West', NORTH_EAST: 'North-East',
  NORTH_WEST: 'North-West', SOUTH_EAST: 'South-East', SOUTH_WEST: 'South-West',
  UNFURNISHED: 'Unfurnished', SEMI_FURNISHED: 'Semi-furnished', FURNISHED: 'Furnished',
  NORMAL: 'Normal', MOTIVATED: 'Motivated', URGENT: 'Urgent', VERY_URGENT: 'Very urgent',
  INVESTMENT: 'Investment', RELOCATING: 'Relocating', OTHER: 'Other',
  DIRECT_OWNER: 'Direct owner', EXISTING_CLIENT: 'Existing client', REFERRAL: 'Referral',
  WEBSITE: 'Website', WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook',
  CONSULTANT: 'Consultant', EMPLOYEE: 'Employee', COLD_LEAD: 'Cold lead',
  CALL: 'Call', EMAIL: 'Email',
  ACTIVE: 'Active', INACTIVE: 'Inactive', BLACKLISTED: 'Blacklisted',
  BUYER: 'Buyer', TENANT: 'Tenant', INVESTOR: 'Investor', SELLER: 'Seller', LANDLORD: 'Landlord',
  SELF_FUNDED: 'Self funded', LOAN_REQUIRED: 'Loan required', LOAN_APPROVED: 'Loan approved', UNKNOWN: 'Not known',
  OPEN: 'Open', MATCHING: 'Matching', SHARED: 'Shared', FULFILLED: 'Fulfilled', CLOSED: 'Closed',
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', PROPERTY_SHARED: 'Property shared',
  VISIT_SCHEDULED: 'Visit scheduled', VISIT_COMPLETED: 'Visit completed', NEGOTIATION: 'Negotiation',
  TOKEN: 'Token', FOLLOW_UP: 'Follow-up', CLOSED_WON: 'Closed won', CLOSED_LOST: 'Closed lost',
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High',
  REQUESTED: 'Requested', SCHEDULED: 'Scheduled', CONFIRMED: 'Confirmed', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', RESCHEDULED: 'Rescheduled', NOT_INTERESTED: 'Not interested',
  DISCUSSION: 'Discussion', AGREEMENT: 'Agreement', REGISTRATION: 'Registration',
  PENDING: 'Pending', PARTIAL: 'Partial', RECEIVED: 'Received', OVERDUE: 'Overdue',
  APPROVED: 'Approved', SUSPENDED: 'Suspended',
  REGISTRY: 'Registry', SALE_DEED: 'Sale deed', KHASRA: 'Khasra', B1: 'B-1', DIVERSION: 'Diversion',
  TAX_RECEIPT: 'Tax receipt', NOC: 'NOC', MAP: 'Map', BUILDING_PERMISSION: 'Building permission',
  ID_PROOF: 'ID proof',
  RESIDENTIAL: 'Residential', COMMERCIAL: 'Commercial', LAND: 'Land',
  COUNTRY: 'Country', STATE: 'State', CITY: 'City', AREA: 'Area', LOCALITY: 'Locality', LANDMARK: 'Landmark',
  INCOMING: 'Incoming', OUTGOING: 'Outgoing',
};

export const label = (value?: string | null) => (value ? LABELS[value] ?? value : '—');

export const toOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: label(v) }));

/** Statuses that mean the listing is live for the public. */
export const LIVE_STATUSES = ['PUBLISHED'] as const;

/**
 * Property types as owners describe them, each pointing at one category slug in the
 * database. The labels combine near-identical categories ("Flat / Apartment") so the
 * list stays short; the value is what gets stored.
 */
export const OWNER_PROPERTY_TYPES = [
  { value: 'flat', label: 'Flat / Apartment' },
  { value: 'house', label: 'House / Villa' },
  { value: 'builder-floor', label: 'Builder Floor' },
  { value: 'farmhouse', label: 'Farmhouse' },
  { value: 'residential-plot', label: 'Residential Plot' },
  { value: 'shop', label: 'Commercial Shop / Showroom' },
  { value: 'office', label: 'Office Space' },
  { value: 'commercial-building', label: 'Commercial Building' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'godown', label: 'Godown' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'institutional-property', label: 'Institutional Property' },
  { value: 'commercial-plot', label: 'Commercial Plot' },
  { value: 'agricultural-land', label: 'Agricultural Land' },
  { value: 'farmland', label: 'Farmland' },
  { value: 'industrial-land', label: 'Industrial Land' },
  { value: 'development-land', label: 'Development Land' },
  { value: 'open-yard', label: 'Open Yard' },
];

/**
 * Which measurement and configuration fields apply to which type. A flat has a
 * carpet and super built-up area but no plot; a godown has neither bedrooms nor
 * furnishing. Each list is the set of types that should see that field.
 */
const LAND_TYPES = [
  'residential-plot', 'commercial-plot', 'agricultural-land', 'farmland',
  'industrial-land', 'development-land', 'open-yard',
];

export const FIELD_TYPES = {
  plotArea: [
    'house', 'builder-floor', 'farmhouse', 'commercial-building', 'warehouse', 'godown',
    'hotel', 'restaurant', 'institutional-property', ...LAND_TYPES,
  ],
  builtUpArea: [
    'house', 'builder-floor', 'farmhouse', 'shop', 'office', 'commercial-building',
    'warehouse', 'godown', 'hotel', 'restaurant', 'institutional-property',
  ],
  superBuiltArea: ['flat', 'builder-floor', 'shop', 'office', 'commercial-building'],
  carpetArea: [
    'flat', 'house', 'builder-floor', 'farmhouse', 'shop', 'office', 'commercial-building',
    'warehouse', 'godown', 'hotel', 'restaurant', 'institutional-property',
  ],
  constructionYear: [
    'flat', 'house', 'builder-floor', 'farmhouse', 'shop', 'office', 'commercial-building',
    'warehouse', 'godown', 'hotel', 'restaurant', 'institutional-property',
  ],
  bedrooms: ['flat', 'house', 'builder-floor', 'farmhouse'],
  floors: ['flat', 'builder-floor', 'shop', 'office', 'commercial-building', 'house', 'hotel'],
  parking: [
    'flat', 'house', 'builder-floor', 'farmhouse', 'shop', 'office', 'commercial-building',
    'hotel', 'restaurant', 'institutional-property',
  ],
  furnishing: ['flat', 'house', 'builder-floor', 'farmhouse', 'office', 'shop', 'restaurant'],
  hotelRooms: ['hotel'],
};

/**
 * Maps a stored PropertyCategory to the slug the owner-facing field rules use,
 * so the CRM entry form asks exactly what the public sell and rent forms ask.
 * Most slugs already line up; only the merged categories need translating.
 */
const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  'flat-apartment': 'flat',
  'house-villa': 'house',
  'commercial-shop-showroom': 'shop',
  'office-space': 'office',
};

export function ownerTypeFor(nameOrSlug?: string | null): string | undefined {
  if (!nameOrSlug) return undefined;
  const slug = nameOrSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return CATEGORY_SLUG_ALIASES[slug] ?? slug;
}

export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'HN Properties',
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || '9713041004',
  whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || process.env.NEXT_PUBLIC_CONTACT_PHONE || '9713041004',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hnpropertiesjbp@gmail.com',
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS || 'Jabalpur, Madhya Pradesh',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  city: process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Jabalpur',
  state: process.env.NEXT_PUBLIC_DEFAULT_STATE || 'Madhya Pradesh',
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/hnpropertiesjbp',
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || '',
};

/**
 * "Katanga, Jabalpur" for a locality, but "Jabalpur, Madhya Pradesh" when the
 * locality is the city itself — never "Jabalpur, Jabalpur".
 */
export function placeLine(place?: string | null): string {
  const name = place?.trim();
  if (!name || name.toLowerCase() === site.city.toLowerCase()) return `${site.city}, ${site.state}`;
  return `${name}, ${site.city}`;
}

export const waLink = (phone: string, message: string) =>
  `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(message)}`;
