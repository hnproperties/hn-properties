/**
 * Seed script.
 *
 * Order matters: permissions and roles first (nothing works without them), then
 * geography and categories, then accounts, then demo inventory.
 *
 * Demo people and phone numbers are fictional. Real credentials come from the
 * environment — nothing sensitive is hard-coded here.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLE_DEFAULTS, ROLE_KEYS } from '../src/lib/permissions';
import { SETTING_DEFAULTS } from '../src/lib/settings';

const prisma = new PrismaClient();

const hash = (plain: string) => bcrypt.hash(plain, 12);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function seedPermissionsAndRoles() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: { key: permission.key, group: permission.group, label: permission.label, isDanger: permission.isDanger ?? false },
      update: { group: permission.group, label: permission.label, isDanger: permission.isDanger ?? false },
    });
  }

  const permissionByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));

  for (const key of ROLE_KEYS) {
    const def = ROLE_DEFAULTS[key];
    const role = await prisma.role.upsert({
      where: { key },
      create: { key, name: def.name, description: def.description, rank: def.rank, isSystem: true },
      update: { name: def.name, description: def.description, rank: def.rank, isSystem: true },
    });

    // Don't stamp over permissions an admin has tuned; Super Admin always gets everything.
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (existing > 0 && key !== 'SUPER_ADMIN') continue;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: def.permissions
        .map((permissionKey) => permissionByKey.get(permissionKey))
        .filter((id): id is string => !!id)
        .map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  console.log(`  permissions: ${PERMISSIONS.length}, roles: ${ROLE_KEYS.length}`);
}

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as any, group: key.split('.')[0] },
      update: {},
    });
  }
}

/** Jabalpur is seed data, not schema: the same shape works for any city added later. */
async function seedLocations() {
  const india =
    (await prisma.location.findFirst({ where: { type: 'COUNTRY', slug: 'india' } })) ??
    (await prisma.location.create({ data: { type: 'COUNTRY', name: 'India', slug: 'india' } }));

  const mp =
    (await prisma.location.findFirst({ where: { slug: 'madhya-pradesh', parentId: india.id } })) ??
    (await prisma.location.create({ data: { type: 'STATE', name: 'Madhya Pradesh', slug: 'madhya-pradesh', parentId: india.id } }));

  const jabalpur =
    (await prisma.location.findFirst({ where: { slug: 'jabalpur', parentId: mp.id } })) ??
    (await prisma.location.create({
      data: { type: 'CITY', name: 'Jabalpur', slug: 'jabalpur', code: 'JBP', parentId: mp.id, latitude: 23.1815, longitude: 79.9864 },
    }));

  // Localities are seeded, not hard-coded — add to this list and re-run the seed;
  // existing entries are left alone, so it is safe to run repeatedly.
  const areas = [
    'Vijay Nagar', 'Napier Town', 'Tilhari', 'Bilhari', 'Civil Lines', 'Gorakhpur', 'Adhartal', 'Gwarighat',
    'Dhanvantri Nagar', 'Wright Town', 'Panagar', 'Saliwada', 'Adarsh Nagar', 'Jabalpur Road', 'Nagpur Road Jabalpur',
    'Rampur', 'South Civil Lines', 'Ranjhi', 'Karmeta', 'Shastri Nagar', 'Madan Mahal Extension', 'Damoh Naka',
    'Garha', 'Yadav Colony', 'Maharajpur', 'Barela', 'Shanti Nagar', 'Trimurty Nagar', 'Shatabadi puram',
    'Airport Road', 'Katanga', 'Pachpedhi', 'Polipather', 'Shiv Nagar', 'Katangi Road', 'Sanjeevani Nagar',
    'Tilwara', 'Narmada Road', 'Suhagi', 'Gupteshwar', 'Gole Bazar', 'Agarwal Colony', 'Bargi Hills Road',
    'Rasal Chowk', 'Madannahal', 'New Bhedaghat Road', 'Naya Gaon', 'Ghamapur', 'Housing Board Colony',
    'Ambedkar Colony', 'Kachhpura', 'Rimjha', 'Sarvodaya Nagar', 'Ranital', 'Surtalai', 'Shakti Nagar',
    'Prem Nagar', 'Gokulpur', 'Anand Colony Road', 'Nunpur', 'Ganga Nagar', 'Patan Road', 'Rani Durgawati Samadhi Road',
    'Kanchanpur', 'Anand Nagar', 'Krishna Colony', 'Ganjipura', 'Sneh Nagar', 'Shastri Bridge', 'Gohalpur',
    'Ranipur', 'Shukla Nagar', 'Sunderpur', 'Atha Kheda', 'Daya Nagar', 'Imliya', 'Amkhera Road Jagriti Nagar',
    'Manegaon', 'Karondi', 'Jasuja City', 'Kajarwara Gram', 'Bahdan', 'Padariya', 'Priyadarshni Colony',
    'Bargi', 'Patel Nagar', 'Avanti Vihar', 'Vikas Nagar', 'Majholi', 'Nigri', 'Narayanpur', 'Sheetalpuri',
    'Sadar', 'Gosalpur', 'Sihora', 'Ghana', 'Hinotiya', 'New Ram Nagar', 'Billapur Colony', 'Gandhigram',
    'Milloniganj', 'Ghughari', 'Kosamghat', 'Kanch Ghar', 'Uprainganj', 'Khajri', 'Prestige Town', 'Shahpura',
    'Sagra', 'Khamaria', 'Sai Colony', 'Sathiya Kuwan', 'Amjhar', 'Amkhera Gaon', 'Neemkheda', 'Choukital',
    'Nunsar', 'Kudwari', 'Marhatal', 'Madai', 'Bhita', 'Bargi Hills', 'Gauraiya Ghat', 'Raigwan', 'Madhotal',
    'Jhinna', 'Lalmati', 'Gora Bazar', 'Professor Colony', 'Maitri Nagar', 'Gotam Nagar', 'Pipariya Kalan',
    'Bijori', 'Belkhadu', 'Paduwa', 'Sakri', 'Transport Nagar', 'Ukhri Road', 'Jhiri', 'Chaukhada', 'Badi Omti',
    'Tewar', 'Sarafa Road', 'Andherdeo', 'Aggarwal Colony', 'Hanumantal Road', 'Umria', 'Indira Nagar',
    'Partala', 'Dhanvantari Nagar', 'Narmada Nagar', 'Umaria', 'Hanumantal Ward', 'Doctors Colony', 'Mukanwara',
    'Gurudev Colony', 'Chargawan', 'Silgaur', 'Raipura', 'Bhedaghat', 'GCF Jabalpur', 'Kasoudhan Nagar',
    'Dhanwantri Nagar', 'Kanchan Vihar', 'Medical College Colony', 'Raksha', 'Rewa Colony', 'Shankar Nagar',
    'Sita Pahadi', 'Sukha', 'Kundam', 'Naya Mohalla', 'Richhai', 'Galgala', 'Padwar', 'Bhedaghat Main Road',
    'Madan Mahal', 'Sushi Mandi',
  ];

  const created: Record<string, string> = {};
  for (const [index, name] of areas.entries()) {
    const existing = await prisma.location.findFirst({ where: { slug: slug(name), parentId: jabalpur.id } });
    const row =
      existing ??
      (await prisma.location.create({ data: { type: 'AREA', name, slug: slug(name), parentId: jabalpur.id, sortOrder: index } }));
    created[name] = row.id;
  }

  console.log(`  locations: Jabalpur + ${areas.length} areas`);
  return { cityId: jabalpur.id, areas: created };
}

const CATEGORIES: { segment: 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND'; name: string; flags?: Record<string, boolean> }[] = [
  { segment: 'RESIDENTIAL', name: 'Flat', flags: { hasBedrooms: true, hasFurnishing: true } },
  { segment: 'RESIDENTIAL', name: 'Apartment', flags: { hasBedrooms: true, hasFurnishing: true } },
  { segment: 'RESIDENTIAL', name: 'House', flags: { hasBedrooms: true, hasFurnishing: true } },
  { segment: 'RESIDENTIAL', name: 'Villa', flags: { hasBedrooms: true, hasFurnishing: true } },
  { segment: 'RESIDENTIAL', name: 'Bungalow', flags: { hasBedrooms: true } },
  { segment: 'RESIDENTIAL', name: 'Duplex', flags: { hasBedrooms: true } },
  { segment: 'RESIDENTIAL', name: 'Builder Floor', flags: { hasBedrooms: true, hasFurnishing: true } },
  { segment: 'RESIDENTIAL', name: 'Farmhouse', flags: { hasBedrooms: true } },
  { segment: 'RESIDENTIAL', name: 'Residential Plot', flags: { isLand: true } },
  { segment: 'COMMERCIAL', name: 'Shop', flags: { hasFrontage: true } },
  { segment: 'COMMERCIAL', name: 'Showroom', flags: { hasFrontage: true } },
  { segment: 'COMMERCIAL', name: 'Office', flags: { hasFurnishing: true } },
  { segment: 'COMMERCIAL', name: 'Commercial Building', flags: {} },
  { segment: 'COMMERCIAL', name: 'Warehouse', flags: {} },
  { segment: 'COMMERCIAL', name: 'Godown', flags: {} },
  { segment: 'COMMERCIAL', name: 'Hotel', flags: {} },
  { segment: 'COMMERCIAL', name: 'Restaurant', flags: {} },
  { segment: 'COMMERCIAL', name: 'Institutional Property', flags: {} },
  { segment: 'COMMERCIAL', name: 'Commercial Plot', flags: { isLand: true } },
  { segment: 'LAND', name: 'Agricultural Land', flags: { isLand: true } },
  { segment: 'LAND', name: 'Farmland', flags: { isLand: true } },
  { segment: 'LAND', name: 'Industrial Land', flags: { isLand: true } },
  { segment: 'LAND', name: 'Development Land', flags: { isLand: true } },
  { segment: 'LAND', name: 'Open Yard', flags: { isLand: true } },
];

async function seedCategories() {
  const ids: Record<string, string> = {};
  for (const [index, category] of CATEGORIES.entries()) {
    const row = await prisma.propertyCategory.upsert({
      where: { slug: slug(category.name) },
      create: {
        segment: category.segment,
        name: category.name,
        slug: slug(category.name),
        sortOrder: index,
        hasBedrooms: !!category.flags?.hasBedrooms,
        hasFurnishing: !!category.flags?.hasFurnishing,
        hasFrontage: !!category.flags?.hasFrontage,
        isLand: !!category.flags?.isLand,
      },
      update: {},
    });
    ids[category.name] = row.id;
  }
  console.log(`  categories: ${CATEGORIES.length}`);
  return ids;
}

async function seedUsers() {
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.key, r.id]));

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@hnproperties.in').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error('Set SEED_ADMIN_PASSWORD (at least 8 characters) in .env before seeding.');
  }

  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      code: 'EMP-0001',
      name: process.env.SEED_ADMIN_NAME ?? 'Harshit Narang',
      email: adminEmail,
      phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '9713041004',
      passwordHash: await hash(adminPassword),
      roleId: roles.SUPER_ADMIN,
    },
    update: { roleId: roles.SUPER_ADMIN, isActive: true },
  });

  if (process.env.SEED_DEMO === 'false') {
    console.log('  users: super admin only (SEED_DEMO=false)');
    return { superAdmin, manager: superAdmin, sales: superAdmin };
  }

  // Development accounts only. Fictional people, shared demo password.
  const demoPassword = await hash(process.env.SEED_DEMO_PASSWORD ?? 'demo-password-123');

  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.hnproperties.in' },
    create: { code: 'EMP-0002', name: 'Rekha Verma (demo)', email: 'manager@demo.hnproperties.in', phone: '9000000002', passwordHash: demoPassword, roleId: roles.MANAGER },
    update: {},
  });

  const sales = await prisma.user.upsert({
    where: { email: 'sales@demo.hnproperties.in' },
    create: { code: 'EMP-0003', name: 'Imran Sheikh (demo)', email: 'sales@demo.hnproperties.in', phone: '9000000003', passwordHash: demoPassword, roleId: roles.SALES },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: 'staff@demo.hnproperties.in' },
    create: { code: 'EMP-0004', name: 'Pooja Tiwari (demo)', email: 'staff@demo.hnproperties.in', phone: '9000000004', passwordHash: demoPassword, roleId: roles.STAFF },
    update: {},
  });

  const consultant = await prisma.consultant.upsert({
    where: { code: 'PTR-0001' },
    create: {
      code: 'PTR-0001',
      firmName: 'Shreeji Estates (demo)',
      contactName: 'Ankit Jain (demo)',
      phone: '9000000010',
      city: 'Jabalpur',
      status: 'APPROVED',
      commissionPct: 1,
      approvedAt: new Date(),
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: 'partner@demo.hnproperties.in' },
    create: {
      code: 'PTU-0001', name: 'Ankit Jain (demo)', email: 'partner@demo.hnproperties.in', phone: '9000000010',
      passwordHash: demoPassword, roleId: roles.PARTNER, consultantId: consultant.id,
    },
    update: {},
  });

  console.log('  users: super admin + 4 demo staff + 1 demo partner');
  return { superAdmin, manager, sales };
}

type Spec = {
  code: string;
  title: string;
  category: string;
  area: string;
  listingType: 'SALE' | 'RENT';
  price: number;
  minimumPrice?: number;
  status?: 'PUBLISHED' | 'COMING_SOON' | 'OFF_MARKET' | 'UNDER_VERIFICATION';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'PARTNER';
  bedrooms?: number;
  bathrooms?: number;
  builtUpArea?: number;
  plotArea?: number;
  areaUnit?: 'SQFT' | 'ACRE';
  summary: string;
  amenities?: string[];
  featured?: boolean;
  verified?: boolean;
  ownerIndex: number;
  deposit?: number;
};

const SPECS: Spec[] = [
  {
    code: 'A', title: '3BHK flat in Napier Town', category: 'Flat', area: 'Napier Town', listingType: 'SALE',
    price: 8_200_000, minimumPrice: 7_800_000, bedrooms: 3, bathrooms: 2, builtUpArea: 1450, ownerIndex: 0,
    summary: 'Third-floor flat in a lift-equipped building, close to the main market and schools. Covered parking, borewell and municipal water.',
    amenities: ['Lift', 'Covered parking', 'Borewell', 'Municipal water', 'Security'], featured: true, verified: true,
  },
  {
    code: 'B', title: 'Residential plot in Vijay Nagar', category: 'Residential Plot', area: 'Vijay Nagar', listingType: 'SALE',
    price: 5_500_000, minimumPrice: 5_200_000, plotArea: 2400, ownerIndex: 1,
    summary: 'East-facing corner plot in a developed colony, boundary wall complete, clear title, ready for construction.',
    amenities: ['Corner plot', 'Boundary wall', 'Wide road'], verified: true,
  },
  {
    code: 'C', title: 'Shop on the main road, Wright Town', category: 'Shop', area: 'Wright Town', listingType: 'RENT',
    price: 45_000, deposit: 270_000, builtUpArea: 520, ownerIndex: 2,
    summary: 'Ground-floor shop with 18ft frontage on a busy stretch. Suitable for retail, a clinic or a bank branch.',
    amenities: ['Three-phase power', 'Wide road'], featured: true,
  },
  {
    code: 'D', title: '2BHK builder floor in Gorakhpur', category: 'Builder Floor', area: 'Gorakhpur', listingType: 'RENT',
    price: 16_500, deposit: 50_000, bedrooms: 2, bathrooms: 2, builtUpArea: 950, ownerIndex: 0,
    summary: 'Semi-furnished first floor with independent entry, two-wheeler parking and a quiet lane.',
    amenities: ['Wardrobes', 'Modular kitchen'], verified: true,
  },
  {
    code: 'E', title: 'Agricultural land near Bhedaghat', category: 'Agricultural Land', area: 'Bhedaghat', listingType: 'SALE',
    price: 9_000_000, plotArea: 4.5, areaUnit: 'ACRE', ownerIndex: 1,
    summary: 'Level agricultural land with an approach road and a working borewell, about twenty minutes from the city.',
    amenities: ['Borewell'],
  },
  {
    code: 'F', title: '4BHK house in Katanga', category: 'House', area: 'Katanga', listingType: 'SALE',
    price: 12_500_000, minimumPrice: 11_800_000, bedrooms: 4, bathrooms: 3, builtUpArea: 2100, plotArea: 1800, ownerIndex: 2,
    summary: 'Independent house on an 1800 sq.ft plot with a small garden, covered parking for two cars and a pooja room.',
    amenities: ['Garden', 'Covered parking', 'Pooja room', 'Store room', 'Borewell'], featured: true, verified: true,
  },
  {
    code: 'G', title: 'Office space in Madan Mahal', category: 'Office', area: 'Madan Mahal', listingType: 'RENT',
    price: 32_000, deposit: 192_000, builtUpArea: 1100, ownerIndex: 0,
    summary: 'Second-floor office with a cabin layout, lift access and dedicated parking. Suitable for a professional practice.',
    amenities: ['Lift', 'Power backup', 'CCTV'],
  },
  {
    code: 'H', title: 'Villa in Tilhari', category: 'Villa', area: 'Tilhari', listingType: 'SALE',
    price: 21_000_000, minimumPrice: 19_500_000, bedrooms: 4, bathrooms: 4, builtUpArea: 3200, plotArea: 4000,
    status: 'COMING_SOON', ownerIndex: 1,
    summary: 'Gated-society villa with a lawn, servant quarter and a double-height living room. Full details to follow.',
    amenities: ['Gated society', 'Garden', 'Servant room', 'Club house'],
  },
  {
    code: 'I', title: 'Warehouse near Adhartal', category: 'Warehouse', area: 'Adhartal', listingType: 'RENT',
    price: 85_000, deposit: 510_000, builtUpArea: 6000, status: 'OFF_MARKET', visibility: 'PRIVATE', ownerIndex: 2,
    summary: 'Off-market warehouse with loading access and three-phase power. Owner prefers a quiet enquiry.',
    amenities: ['Loading bay', 'Three-phase power', 'Boundary wall'],
  },
  {
    code: 'J', title: '2BHK flat in Ranjhi', category: 'Flat', area: 'Ranjhi', listingType: 'SALE',
    price: 4_100_000, bedrooms: 2, bathrooms: 2, builtUpArea: 880, status: 'UNDER_VERIFICATION', visibility: 'PRIVATE', ownerIndex: 0,
    summary: 'Owner submission awaiting document check and a site visit.',
  },
];

async function seedInventory(
  categories: Record<string, string>,
  locations: { cityId: string; areas: Record<string, string> },
  staff: { superAdmin: any; manager: any; sales: any },
) {
  if (process.env.SEED_DEMO === 'false') return;
  if ((await prisma.property.count()) > 0) {
    console.log('  inventory: already present, skipping demo data');
    return;
  }

  const owners = await Promise.all([
    prisma.owner.create({ data: { code: 'OWN-0001', name: 'Suresh Agrawal (demo)', phone: '9000000101', whatsapp: '9000000101', sourceType: 'DIRECT_OWNER', assignedToId: staff.manager.id, notes: 'Demo record.' } }),
    prisma.owner.create({ data: { code: 'OWN-0002', name: 'Farida Khan (demo)', phone: '9000000102', sourceType: 'REFERRAL', assignedToId: staff.sales.id, notes: 'Demo record.' } }),
    prisma.owner.create({ data: { code: 'OWN-0003', name: 'Devendra Patel (demo)', phone: '9000000103', sourceType: 'EXISTING_CLIENT', assignedToId: staff.manager.id, notes: 'Demo record.' } }),
  ]);

  const listingIds: Record<string, string> = {};
  let saleSeq = 0;
  let rentSeq = 0;

  for (const [index, spec] of SPECS.entries()) {
    const property = await prisma.property.create({
      data: {
        code: `HNP-JBP-${String(index + 1).padStart(6, '0')}`,
        title: spec.title,
        summary: spec.summary,
        categoryId: categories[spec.category],
        locationId: locations.areas[spec.area],
        colony: spec.area,
        landmark: 'Demo landmark',
        addressLine: `Plot 00, ${spec.area}, Jabalpur (demo address)`,
        pincode: '482001',
        latitude: 23.1815,
        longitude: 79.9864,
        bedrooms: spec.bedrooms,
        bathrooms: spec.bathrooms,
        builtUpArea: spec.builtUpArea,
        plotArea: spec.plotArea,
        areaUnit: spec.areaUnit ?? 'SQFT',
        furnishing: spec.bedrooms ? 'SEMI_FURNISHED' : undefined,
        facing: 'EAST',
        isMainRoad: spec.category === 'Shop',
        isReadyToMove: !!spec.builtUpArea,
        amenities: spec.amenities ?? [],
        minimumPrice: spec.minimumPrice,
        ownerExpectation: spec.price,
        motivation: spec.code === 'I' ? 'MOTIVATED' : 'NORMAL',
        internalScore: 60 + ((index * 7) % 35),
        sourceType: 'DIRECT_OWNER',
        privateNotes: 'Demo record — replace before going live.',
        ownerId: owners[spec.ownerIndex].id,
        assignedToId: index % 2 === 0 ? staff.manager.id : staff.sales.id,
        createdById: staff.superAdmin.id,
        isVerified: !!spec.verified,
        verifiedAt: spec.verified ? new Date() : null,
        media: {
          create: [
            { url: `https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1400&q=60&sig=${spec.code}1`, alt: spec.title, isCover: true, sortOrder: 0 },
            { url: `https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&q=60&sig=${spec.code}2`, alt: `${spec.title} — interior`, sortOrder: 1 },
            { url: `https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1400&q=60&sig=${spec.code}3`, alt: `${spec.title} — surroundings`, sortOrder: 2 },
          ],
        },
      },
    });

    const status = spec.status ?? 'PUBLISHED';
    const isPublic = status === 'PUBLISHED' || status === 'COMING_SOON';
    const seq = spec.listingType === 'SALE' ? ++saleSeq : ++rentSeq;
    const publicId = `HNP-${spec.listingType === 'SALE' ? 'S' : 'R'}-JBP-${String(seq).padStart(6, '0')}`;

    const listing = await prisma.listing.create({
      data: {
        publicId,
        slug: `${slug(spec.title)}-${publicId.toLowerCase()}`,
        propertyId: property.id,
        listingType: spec.listingType,
        status,
        visibility: spec.visibility ?? (isPublic ? 'PUBLIC' : 'PRIVATE'),
        isFeatured: !!spec.featured,
        price: spec.price,
        securityDeposit: spec.deposit,
        leaseMonths: spec.listingType === 'RENT' ? 11 : undefined,
        lockInMonths: spec.listingType === 'RENT' ? 6 : undefined,
        publicTitle: spec.title,
        publicDescription: spec.summary,
        publicLocationId: locations.areas[spec.area],
        seoTitle: `${spec.title} — HN Properties, Jabalpur`,
        seoDescription: spec.summary.slice(0, 150),
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        expiresAt: status === 'PUBLISHED' ? new Date(Date.now() + 90 * 86_400_000) : null,
        lastCheckedAt: new Date(),
        assignedToId: property.assignedToId,
        viewCount: 10 + index * 7,
      },
    });
    listingIds[spec.code] = listing.id;

    if (spec.verified) {
      await prisma.verification.create({
        data: {
          propertyId: property.id,
          ownerIdSeen: true, siteVisited: true, docsReceived: true, photosOurs: true, availability: true,
          passed: true, verifiedById: staff.manager.id, notes: 'Demo verification.',
        },
      });
    }

    await prisma.activity.create({
      data: { entityType: 'property', entityId: property.id, propertyId: property.id, userId: staff.superAdmin.id, action: 'Property created', detail: 'Seed data' },
    });
  }

  const client = await prisma.client.create({
    data: {
      code: 'CLT-0001', name: 'Rahul Sharma (demo)', phone: '9000000201', kind: 'BUYER',
      budgetMin: 7_000_000, budgetMax: 9_000_000, purpose: 'Self use', financing: 'LOAN_APPROVED',
      timeline: 'Within 3 months', assignedToId: staff.sales.id, sourceType: 'WEBSITE', notes: 'Demo record.',
    },
  });

  const tenant = await prisma.client.create({
    data: {
      code: 'CLT-0002', name: 'Neha Dubey (demo)', phone: '9000000202', kind: 'TENANT',
      budgetMax: 20_000, purpose: 'Family accommodation', assignedToId: staff.sales.id, sourceType: 'REFERRAL', notes: 'Demo record.',
    },
  });

  const requirement = await prisma.requirement.create({
    data: {
      code: 'REQ-0001', clientId: client.id, listingType: 'SALE',
      budgetMin: 7_000_000, budgetMax: 9_000_000, areaMin: 1200, bedroomsMin: 3,
      purpose: 'Self use', timeline: 'Within 3 months', assignedToId: staff.sales.id,
      categories: { create: [{ categoryId: categories['Flat'] }, { categoryId: categories['House'] }] },
      locations: { create: [{ locationId: locations.areas['Napier Town'] }, { locationId: locations.areas['Katanga'] }] },
    },
  });

  await prisma.requirement.create({
    data: {
      code: 'REQ-0002', clientId: tenant.id, listingType: 'RENT', budgetMax: 20_000, bedroomsMin: 2,
      purpose: 'Family accommodation', assignedToId: staff.sales.id,
      categories: { create: [{ categoryId: categories['Builder Floor'] }, { categoryId: categories['Flat'] }] },
      locations: { create: [{ locationId: locations.areas['Gorakhpur'] }] },
    },
  });

  const lead = await prisma.lead.create({
    data: {
      code: 'LED-0001', name: 'Rahul Sharma (demo)', phone: '9000000201', status: 'QUALIFIED', priority: 'HIGH',
      sourceType: 'WEBSITE', sourceDetail: 'Listing HNP-S-JBP-000001', listingId: listingIds.A,
      clientId: client.id, requirementId: requirement.id, assignedToId: staff.sales.id,
      message: 'Interested in the Napier Town flat, would like to visit this weekend.',
    },
  });

  await prisma.lead.create({
    data: {
      code: 'LED-0002', name: 'Neha Dubey (demo)', phone: '9000000202', status: 'NEW', priority: 'MEDIUM',
      sourceType: 'WHATSAPP', clientId: tenant.id, assignedToId: staff.sales.id,
      message: 'Looking for a 2BHK on rent in Gorakhpur.',
    },
  });

  await prisma.followUp.createMany({
    data: [
      { dueAt: new Date(Date.now() + 86_400_000), note: 'Confirm visit timing', leadId: lead.id, assignedToId: staff.sales.id },
      { dueAt: new Date(Date.now() - 86_400_000), note: 'Send shortlist on WhatsApp', clientId: tenant.id, assignedToId: staff.sales.id },
    ],
  });

  await prisma.siteVisit.create({
    data: {
      code: 'VST-0001', listingId: listingIds.A, clientId: client.id, leadId: lead.id,
      scheduledAt: new Date(Date.now() + 2 * 86_400_000), status: 'CONFIRMED',
      agentId: staff.sales.id, ownerAvailable: true, notes: 'Owner will be present.',
    },
  });

  const deal = await prisma.deal.create({
    data: {
      code: 'DEL-0001', listingId: listingIds.F, dealType: 'SALE', stage: 'NEGOTIATION',
      sellerId: owners[2].id, buyerId: client.id, leadId: lead.id,
      askingPrice: 12_500_000, agentId: staff.manager.id, notes: 'Demo deal in negotiation.',
    },
  });

  await prisma.offer.createMany({
    data: [
      { dealId: deal.id, by: 'BUYER', amount: 11_500_000, note: 'First offer' },
      { dealId: deal.id, by: 'OWNER', amount: 12_200_000, note: 'Counter' },
    ],
  });

  await prisma.commission.create({ data: { dealId: deal.id, party: 'HN Properties', percent: 2, amount: 244_000 } });

  const consultant = await prisma.consultant.findFirst({ where: { code: 'PTR-0001' } });
  if (consultant) {
    await prisma.collaboration.create({
      data: {
        code: 'COL-0001',
        consultantId: consultant.id,
        listingId: listingIds.B,
        clientBrief: 'Client looking for a plot around 2400 sq.ft in Vijay Nagar, budget up to ₹60 lakh.',
        status: 'PENDING',
      },
    });
  }

  // Counters must start where the seed left off, or the next real record collides.
  await prisma.counter.createMany({
    data: [
      { key: 'property:JBP', value: SPECS.length },
      { key: 'listing:S:JBP', value: saleSeq },
      { key: 'listing:R:JBP', value: rentSeq },
      { key: 'code:OWN', value: 3 },
      { key: 'code:CLT', value: 2 },
      { key: 'code:REQ', value: 2 },
      { key: 'code:LED', value: 2 },
      { key: 'code:VST', value: 1 },
      { key: 'code:DEL', value: 1 },
      { key: 'code:PTR', value: 1 },
      { key: 'code:COL', value: 1 },
      { key: 'code:EMP', value: 4 },
      { key: 'code:PTU', value: 1 },
    ],
    skipDuplicates: true,
  });

  console.log(`  inventory: ${SPECS.length} properties, 2 clients, 2 requirements, 2 leads, 1 visit, 1 deal`);
}

async function main() {
  console.log('Seeding HN Properties…');
  await seedPermissionsAndRoles();
  await seedSettings();
  const locations = await seedLocations();
  const categories = await seedCategories();
  const staff = await seedUsers();
  await seedInventory(categories, locations, staff);
  console.log('Done. Sign in with SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
