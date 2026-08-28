import { revalidatePath } from 'next/cache';
import { emitChange } from './events';
import { prisma } from './prisma';
import type { ResourceDef } from './api';
import { forbidden, badRequest } from './errors';
import { can } from './rbac';
import { maskProperty, maskOwner, maskDeal } from './visibility';
import { activity, notify } from './audit';
import { nextCode, nextPropertyCode, nextListingPublicId, uniqueListingSlug } from './ids';
import { recomputeMatchesForRequirement, recomputeMatchesForListing } from './matching';
import * as V from './validators';
import type { CurrentUser } from './auth';

const mine = (user: CurrentUser, ...fields: string[]) => ({
  OR: fields.map((field) => ({ [field]: user.id })),
});

/* ─────────────────────────────────────────── owners */

export const ownerResource: ResourceDef = {
  name: 'owner',
  model: 'owner',
  label: 'Owner',
  searchFields: ['name', 'phone', 'code', 'email'],
  filterFields: ['status', 'assignedToId', 'sourceType'],
  defaultOrder: { createdAt: 'desc' },
  listInclude: { _count: { select: { properties: true } } },
  itemInclude: {
    properties: { select: { id: true, code: true, title: true, listings: { select: { publicId: true, status: true, listingType: true, price: true } } } },
  },
  createSchema: V.ownerSchema,
  updateSchema: V.ownerSchema.partial(),
  scope: (user) => mine(user, 'assignedToId'),
  mask: maskOwner,
  beforeCreate: async (input, user) => {
    const clash = await prisma.owner.findFirst({ where: { phone: input.phone } });
    if (clash) throw badRequest(`That number is already on file as ${clash.code} — ${clash.name}`);
    return { ...input, code: await nextCode('OWN'), assignedToId: input.assignedToId ?? user.id };
  },
};

/* ─────────────────────────────────────────── properties */

const PROPERTY_ITEM_INCLUDE = {
  category: true,
  location: { include: { parent: true } },
  owner: true,
  assignedTo: { select: { id: true, name: true } },
  media: { orderBy: { sortOrder: 'asc' as const } },
  listings: true,
  verifications: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  documents: { select: { id: true, kind: true, title: true, createdAt: true } },
  _count: { select: { documents: true } },
};

/**
 * Placeholder rows used when a property is saved without a category or locality.
 * Created once on first use and reused after, so incomplete records group together
 * and are easy to find and finish later.
 */
async function placeholderCategoryId() {
  const existing = await prisma.propertyCategory.findFirst({ where: { slug: 'unspecified' }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.propertyCategory.create({
    data: { name: 'Unspecified', slug: 'unspecified', segment: 'RESIDENTIAL', sortOrder: 999, isActive: true },
    select: { id: true },
  });
  return created.id;
}

async function placeholderLocationId() {
  const existing = await prisma.location.findFirst({ where: { slug: 'unspecified' }, select: { id: true } });
  if (existing) return existing.id;
  const city = await prisma.location.findFirst({ where: { type: 'CITY' }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
  const created = await prisma.location.create({
    data: { name: 'Unspecified', slug: 'unspecified', type: 'LOCALITY', parentId: city?.id, sortOrder: 999, isActive: true },
    select: { id: true },
  });
  return created.id;
}

export const propertyResource: ResourceDef = {
  name: 'property',
  model: 'property',
  label: 'Property',
  searchFields: ['code', 'title', 'colony', 'landmark'],
  filterFields: ['categoryId', 'locationId', 'assignedToId', 'ownerId', 'isVerified', 'motivation'],
  defaultOrder: { createdAt: 'desc' },
  listInclude: {
    category: { select: { name: true, segment: true } },
    location: { select: { name: true, parent: { select: { name: true } } } },
    assignedTo: { select: { id: true, name: true } },
    listings: { select: { id: true, publicId: true, listingType: true, status: true, visibility: true, price: true } },
    media: { where: { isCover: true }, take: 1, select: { url: true, thumbUrl: true } },
  },
  itemInclude: PROPERTY_ITEM_INCLUDE,
  createSchema: V.propertySchema,
  updateSchema: V.propertySchema.partial(),
  scope: (user) => ({ OR: [{ assignedToId: user.id }, { createdById: user.id }] }),
  mask: maskProperty,
  beforeCreate: async (input, user) => {
    const { media, ...rest } = input;

    // Category, locality and title are columns the database cannot store as null,
    // but staff should still be able to save a half-known property and finish it
    // later. Fill the gaps with clearly-labelled placeholders they can correct,
    // rather than refusing the save.
    const categoryId = rest.categoryId || (await placeholderCategoryId());
    const locationId = rest.locationId || (await placeholderLocationId());

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: { parent: { include: { parent: true } } },
    });
    const cityCode = findCityCode(location);
    return {
      ...rest,
      title: (rest.title ?? '').trim() || 'Untitled property',
      categoryId,
      locationId,
      code: await nextPropertyCode(cityCode),
      createdById: user.id,
      assignedToId: rest.assignedToId ?? user.id,
      ...(media?.length ? { media: { create: media } } : {}),
    };
  },
  afterCreate: async (row, _input, user) => {
    await activity({ entityType: 'property', entityId: row.id, propertyId: row.id, userId: user.id, action: 'Property created' });
  },
  beforeUpdate: async (input, existing, user) => {
    const { media, ...rest } = input;
    if (rest.minimumPrice !== undefined && !can(user, 'property.private.view')) throw forbidden();
    if (rest.minimumPrice !== undefined && Number(existing.minimumPrice ?? 0) !== Number(rest.minimumPrice)) {
      await prisma.priceHistory.create({
        data: {
          propertyId: existing.id,
          field: 'minimumPrice',
          oldValue: existing.minimumPrice,
          newValue: rest.minimumPrice,
          changedById: user.id,
        },
      });
    }
    // Media is replaced wholesale: the editor sends the full ordered set it wants kept.
    return media ? { ...rest, media: { deleteMany: {}, create: media } } : rest;
  },
  afterDelete: async () => {
    refreshPublicPages();
  },
  beforeDelete: async (existing) => {
    const deals = await prisma.deal.count({ where: { listing: { propertyId: existing.id } } });
    if (deals > 0) {
      throw badRequest(
        `This property has ${deals} deal${deals > 1 ? 's' : ''} against it. Delete those first, or archive the property instead of deleting it.`,
      );
    }
  },
  afterUpdate: async (row, _existing, input, user) => {
    await activity({
      entityType: 'property',
      entityId: row.id,
      propertyId: row.id,
      userId: user.id,
      action: 'Property updated',
      detail: Object.keys(input ?? {}).slice(0, 8).join(', '),
    });

    const listings = await prisma.listing.findMany({ where: { propertyId: row.id }, select: { publicId: true } });
    for (const listing of listings) refreshPublicPages(listing.publicId);
  },
};

function findCityCode(location: any): string {
  let node = location;
  while (node) {
    if (node.type === 'CITY') return node.code || node.name?.slice(0, 3).toUpperCase() || 'JBP';
    node = node.parent;
  }
  return 'JBP';
}

/* ─────────────────────────────────────────── listings */

export const listingResource: ResourceDef = {
  name: 'property', // listings inherit property permissions
  model: 'listing',
  label: 'Listing',
  searchFields: ['publicId', 'publicTitle'],
  filterFields: ['status', 'visibility', 'listingType', 'assignedToId', 'isFeatured', 'isHotDeal', 'propertyId'],
  defaultOrder: { createdAt: 'desc' },
  listInclude: {
    property: {
      select: {
        id: true, code: true, title: true, bedrooms: true, builtUpArea: true, plotArea: true, areaUnit: true,
        category: { select: { name: true, segment: true } },
        location: { select: { name: true } },
        media: { where: { isCover: true }, take: 1, select: { url: true } },
      },
    },
    assignedTo: { select: { id: true, name: true } },
    _count: { select: { leads: true, siteVisits: true } },
  },
  itemInclude: {
    property: { include: { category: true, location: true, media: true } },
    assignedTo: { select: { id: true, name: true } },
  },
  createSchema: V.listingSchema,
  updateSchema: V.listingSchema.partial(),
  scope: (user) => ({ OR: [{ assignedToId: user.id }, { property: { createdById: user.id } }, { property: { assignedToId: user.id } }] }),
  codeOf: (row) => row.publicId,
  beforeCreate: async (input, user) => {
    const property = await prisma.property.findUnique({
      where: { id: input.propertyId },
      include: { location: { include: { parent: { include: { parent: true } } } } },
    });
    if (!property) throw badRequest('That property no longer exists');
    const publicId = await nextListingPublicId(input.listingType, findCityCode(property.location));
    const status = gateStatus(input.status, user);
    return {
      ...input,
      publicId,
      slug: await uniqueListingSlug(input.publicTitle, publicId),
      status,
      assignedToId: input.assignedToId ?? property.assignedToId ?? user.id,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    };
  },
  afterCreate: async (row) => {
    await recomputeMatchesForListing(row.id);
    refreshPublicPages(row.publicId);
  },
  afterDelete: async (existing) => {
    // Without this the listing lingers on the cached public pages until they expire.
    refreshPublicPages(existing.publicId);
  },
  beforeUpdate: async (input, existing, user) => {
    const next = { ...input };
    if (next.status !== undefined) next.status = gateStatus(next.status, user);
    if (next.visibility !== undefined && next.visibility === 'PUBLIC' && !can(user, 'property.publish')) throw forbidden();
    if (next.isFeatured !== undefined && !can(user, 'property.publish')) throw forbidden();
    // Marking a hot deal puts a listing on a public shelf, so it needs the same
    // permission as publishing or featuring — not merely edit access.
    if (next.isHotDeal !== undefined && !can(user, 'property.publish')) throw forbidden();
    if (next.price !== undefined && Number(existing.price ?? 0) !== Number(next.price)) {
      await prisma.priceHistory.create({
        data: {
          propertyId: existing.propertyId,
          listingId: existing.id,
          field: 'price',
          oldValue: existing.price,
          newValue: next.price,
          changedById: user.id,
        },
      });
    }
    if (next.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') next.publishedAt = new Date();
    return next;
  },
  beforeDelete: async (existing) => {
    // A deal points at this listing and would be orphaned. Say so plainly rather
    // than letting the database reject it with a foreign-key error.
    const deals = await prisma.deal.count({ where: { listingId: existing.id } });
    if (deals > 0) {
      throw badRequest(
        `This listing is attached to ${deals} deal${deals > 1 ? 's' : ''}. Delete the deal first, or set the listing to Archived to take it off the market.`,
      );
    }
  },
  afterUpdate: async (row, existing, _input, user) => {
    if (row.status !== existing.status) {
      await activity({
        entityType: 'listing',
        entityId: row.id,
        propertyId: row.propertyId,
        userId: user.id,
        action: 'Status changed',
        detail: `${existing.status} → ${row.status}`,
      });
    }
    await recomputeMatchesForListing(row.id);
    refreshPublicPages(row.publicId);
  },
};

/** Clears the cached public pages and tells open tabs, so an edit shows up straight away. */
function refreshPublicPages(publicId?: string) {
  emitChange({ kind: 'changed', publicFacing: true });
  try {
    revalidatePath('/');
    revalidatePath('/buy');
    revalidatePath('/rent');
    revalidatePath('/categories');
    if (publicId) revalidatePath(`/property/${publicId}`);
  } catch {
    /* revalidation is a nicety; never fail a save because of it */
  }
}

/** Publishing and verification are gated capabilities, whatever the client sends. */
function gateStatus(status: string | undefined, user: CurrentUser) {
  if (!status) return undefined;
  if (['PUBLISHED', 'COMING_SOON'].includes(status) && !can(user, 'property.publish')) throw forbidden();
  if (status === 'VERIFIED' && !can(user, 'property.verify')) throw forbidden();
  return status;
}

/* ─────────────────────────────────────────── clients & requirements */

export const clientResource: ResourceDef = {
  name: 'client',
  model: 'client',
  label: 'Client',
  searchFields: ['name', 'phone', 'code', 'email'],
  filterFields: ['kind', 'status', 'assignedToId', 'financing'],
  defaultOrder: { createdAt: 'desc' },
  listInclude: { _count: { select: { requirements: true, leads: true } } },
  itemInclude: {
    requirements: { include: { categories: true, locations: true } },
    leads: { orderBy: { createdAt: 'desc' as const }, take: 10 },
    siteVisits: { orderBy: { scheduledAt: 'desc' as const }, take: 10, include: { listing: { select: { publicId: true, publicTitle: true } } } },
  },
  createSchema: V.clientSchema,
  updateSchema: V.clientSchema.partial(),
  scope: (user) => mine(user, 'assignedToId'),
  beforeCreate: async (input, user) => ({
    ...input,
    code: await nextCode('CLT'),
    assignedToId: input.assignedToId ?? user.id,
  }),
};

export const requirementResource: ResourceDef = {
  name: 'requirement',
  model: 'requirement',
  label: 'Requirement',
  searchFields: ['code', 'purpose', 'notes'],
  filterFields: ['status', 'listingType', 'assignedToId', 'clientId'],
  defaultOrder: { createdAt: 'desc' },
  listInclude: {
    client: { select: { id: true, name: true, phone: true, code: true } },
    _count: { select: { matches: true } },
  },
  itemInclude: {
    client: true,
    categories: { include: { category: true } },
    locations: { include: { location: true } },
  },
  createSchema: V.requirementSchema,
  updateSchema: V.requirementSchema.partial(),
  scope: (user) => ({ OR: [{ assignedToId: user.id }, { client: { assignedToId: user.id } }] }),
  beforeCreate: async (input, user) => {
    const { categoryIds = [], locationIds = [], ...rest } = input;
    return {
      ...rest,
      code: await nextCode('REQ'),
      assignedToId: rest.assignedToId ?? user.id,
      categories: { create: categoryIds.map((categoryId: string) => ({ categoryId })) },
      locations: { create: locationIds.map((locationId: string) => ({ locationId })) },
    };
  },
  afterCreate: async (row) => {
    await recomputeMatchesForRequirement(row.id);
  },
  beforeUpdate: async (input, existing) => {
    const { categoryIds, locationIds, ...rest } = input;
    return {
      ...rest,
      ...(rest.isPublic && !existing.isPublic ? { publishedAt: new Date() } : {}),
      ...(categoryIds ? { categories: { deleteMany: {}, create: categoryIds.map((categoryId: string) => ({ categoryId })) } } : {}),
      ...(locationIds ? { locations: { deleteMany: {}, create: locationIds.map((locationId: string) => ({ locationId })) } } : {}),
    };
  },
  afterUpdate: async (row) => {
    await recomputeMatchesForRequirement(row.id);
    try {
      revalidatePath('/wanted');
    } catch {
      /* cache refresh is a nicety */
    }
  },
};

/* ─────────────────────────────────────────── leads, visits, deals */

export const leadResource: ResourceDef = {
  name: 'lead',
  model: 'lead',
  label: 'Lead',
  searchFields: ['name', 'phone', 'code', 'message'],
  filterFields: ['status', 'priority', 'assignedToId', 'sourceType', 'listingId'],
  defaultOrder: [{ priority: 'desc' }, { createdAt: 'desc' }],
  listInclude: {
    listing: { select: { id: true, publicId: true, publicTitle: true } },
    assignedTo: { select: { id: true, name: true } },
    client: { select: { id: true, name: true } },
  },
  itemInclude: {
    listing: { select: { id: true, publicId: true, publicTitle: true, price: true } },
    client: true,
    requirement: true,
    assignedTo: { select: { id: true, name: true } },
    followUps: { orderBy: { dueAt: 'asc' as const } },
    siteVisits: true,
  },
  createSchema: V.leadSchema,
  updateSchema: V.leadSchema.partial(),
  scope: (user) => mine(user, 'assignedToId'),
  beforeCreate: async (input, user) => ({
    ...input,
    code: await nextCode('LED'),
    assignedToId: input.assignedToId ?? user.id,
  }),
  beforeUpdate: async (input, existing, user) => {
    if (input.assignedToId && input.assignedToId !== existing.assignedToId && !can(user, 'lead.assign')) throw forbidden();
    return input;
  },
  afterUpdate: async (row, existing, _input, user) => {
    if (row.status !== existing.status) {
      await activity({ entityType: 'lead', entityId: row.id, userId: user.id, action: 'Status changed', detail: `${existing.status} → ${row.status}` });
    }
    if (row.assignedToId && row.assignedToId !== existing.assignedToId) {
      await notify([row.assignedToId], { kind: 'LEAD_ASSIGNED', title: `Lead assigned: ${row.name}`, href: `/crm/leads?id=${row.id}` });
    }
  },
};

export const siteVisitResource: ResourceDef = {
  name: 'visit',
  model: 'siteVisit',
  label: 'Site visit',
  searchFields: ['code', 'notes', 'feedback'],
  filterFields: ['status', 'agentId', 'listingId', 'clientId', 'interest'],
  defaultOrder: { scheduledAt: 'asc' },
  listInclude: {
    listing: { select: { id: true, publicId: true, publicTitle: true } },
    client: { select: { id: true, name: true, phone: true } },
    agent: { select: { id: true, name: true } },
  },
  itemInclude: {
    listing: { include: { property: { select: { code: true, title: true, addressLine: true } } } },
    client: true,
    lead: true,
    agent: { select: { id: true, name: true } },
  },
  createSchema: V.siteVisitSchema,
  updateSchema: V.siteVisitSchema.partial(),
  scope: (user) => mine(user, 'agentId'),
  beforeCreate: async (input, user) => ({
    ...input,
    code: await nextCode('VST'),
    agentId: input.agentId ?? user.id,
    status: input.status ?? 'SCHEDULED',
  }),
  afterUpdate: async (row, _existing, input, user) => {
    if (input.status === 'COMPLETED' && row.leadId) {
      await prisma.lead.update({ where: { id: row.leadId }, data: { status: 'VISIT_COMPLETED' } });
    }
    await activity({ entityType: 'visit', entityId: row.id, userId: user.id, action: 'Visit updated', detail: row.status });
  },
};

export const dealResource: ResourceDef = {
  name: 'deal',
  model: 'deal',
  label: 'Deal',
  searchFields: ['code', 'notes'],
  filterFields: ['stage', 'dealType', 'agentId', 'listingId', 'consultantId'],
  defaultOrder: { updatedAt: 'desc' },
  listInclude: {
    listing: { select: { id: true, publicId: true, publicTitle: true } },
    buyer: { select: { id: true, name: true } },
    seller: { select: { id: true, name: true } },
    agent: { select: { id: true, name: true } },
    commissions: true,
  },
  itemInclude: {
    listing: { include: { property: { select: { code: true, title: true } } } },
    buyer: true,
    seller: true,
    agent: { select: { id: true, name: true } },
    offers: { orderBy: { createdAt: 'asc' as const } },
    payments: { orderBy: { dueAt: 'asc' as const } },
    commissions: true,
  },
  createSchema: V.dealSchema,
  updateSchema: V.dealSchema.partial(),
  scope: (user) => mine(user, 'agentId'),
  mask: maskDeal,
  beforeCreate: async (input, user) => ({
    ...input,
    code: await nextCode('DEL'),
    agentId: input.agentId ?? user.id,
  }),
  afterUpdate: async (row, existing, _input, user) => {
    if (row.stage !== existing.stage) {
      await activity({ entityType: 'deal', entityId: row.id, userId: user.id, action: 'Stage changed', detail: `${existing.stage} → ${row.stage}` });
    }
  },
};

/* ─────────────────────────────────────────── network & platform */

export const consultantResource: ResourceDef = {
  name: 'consultant',
  model: 'consultant',
  label: 'Consultant',
  searchFields: ['firmName', 'contactName', 'phone', 'code'],
  filterFields: ['status', 'city'],
  defaultOrder: { createdAt: 'desc' },
  listInclude: { _count: { select: { collaborations: true, deals: true } } },
  createSchema: V.consultantSchema,
  updateSchema: V.consultantSchema.partial(),
  scope: () => ({}),
  beforeCreate: async (input) => ({ ...input, code: await nextCode('PTR') }),
  /*
   * A firm with a login, a deal or a commission against it cannot simply vanish:
   * the partner user would be left pointing at nothing and the commission would
   * lose the party it is owed to. Say which of those is in the way, rather than
   * letting the database answer with a foreign-key error nobody can act on.
   * Collaboration requests are not counted — those cascade away with the firm,
   * which is the right outcome for a request that no longer has a requester.
   */
  beforeDelete: async (existing) => {
    const [users, deals, commissions, leads] = await Promise.all([
      prisma.user.count({ where: { consultantId: existing.id } }),
      prisma.deal.count({ where: { consultantId: existing.id } }),
      prisma.commission.count({ where: { consultantId: existing.id } }),
      prisma.lead.count({ where: { consultantId: existing.id } }),
    ]);

    const parts: string[] = [];
    const add = (count: number, one: string, many = `${one}s`) => {
      if (count > 0) parts.push(`${count} ${count === 1 ? one : many}`);
    };
    add(users, 'partner login');
    add(deals, 'deal');
    add(commissions, 'commission');
    add(leads, 'lead');

    if (parts.length) {
      throw badRequest(
        `${existing.firmName} still has ${parts.join(', ')} attached. Remove those first, or set the firm to Suspended instead — that takes away inventory access without losing the history.`,
      );
    }
  },
};

export const collaborationResource: ResourceDef = {
  name: 'consultant', // collaborations ride on consultant permissions
  model: 'collaboration',
  label: 'Collaboration',
  searchFields: ['code', 'clientBrief'],
  filterFields: ['status', 'consultantId', 'listingId'],
  defaultOrder: { createdAt: 'desc' },
  listInclude: {
    consultant: { select: { id: true, firmName: true, contactName: true, phone: true } },
    listing: { select: { id: true, publicId: true, publicTitle: true } },
  },
  createSchema: V.collaborationSchema,
  updateSchema: V.collaborationSchema.partial(),
  scope: () => ({}),
  beforeCreate: async (input) => ({ ...input, code: await nextCode('COL') }),
  beforeUpdate: async (input) => (input.status ? { ...input, decidedAt: new Date() } : input),
};

export const followUpResource: ResourceDef = {
  name: 'lead', // follow-ups ride on lead permissions
  model: 'followUp',
  label: 'Follow-up',
  searchFields: ['note'],
  filterFields: ['isDone', 'assignedToId', 'leadId', 'clientId', 'ownerId', 'listingId'],
  defaultOrder: { dueAt: 'asc' },
  listInclude: {
    lead: { select: { id: true, name: true, phone: true, code: true } },
    client: { select: { id: true, name: true, phone: true } },
    owner: { select: { id: true, name: true, phone: true } },
    listing: { select: { id: true, publicId: true, publicTitle: true } },
    assignedTo: { select: { id: true, name: true } },
  },
  createSchema: V.followUpSchema,
  updateSchema: V.followUpSchema.partial(),
  scope: (user) => mine(user, 'assignedToId'),
  beforeCreate: async (input, user) => ({ ...input, assignedToId: input.assignedToId ?? user.id }),
  beforeUpdate: async (input) => (input.isDone ? { ...input, completedAt: new Date() } : input),
};
