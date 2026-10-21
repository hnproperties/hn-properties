import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma, plain } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import PropertyTable from '@/components/crm/PropertyTable';
import { OWNER_PROPERTY_TYPES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Search = {
  tab?: string;
  q?: string;
  category?: string;
  location?: string;
  beds?: string;
  areaMin?: string;
  areaMax?: string;
  priceMin?: string;
  priceMax?: string;
  verified?: string;
  status?: string;
  assigned?: string;
  // Radius search: either an explicit pin (lat/lng) or "radiusKm around the
  // locality already picked in `location`" — see where these are used below.
  lat?: string;
  lng?: string;
  radiusKm?: string;
};

/** Straight-line distance between two points in km — plenty accurate at a city
 * scale, and much simpler than pulling in a real geo library for this. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Inventory list. Rows are clickable through to the full record, and the search box
 * matches a public ID (HNP-S-JBP-000004) or an internal code as well as free text.
 */
export default async function PropertiesPage({ searchParams }: { searchParams: Search }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!can(user, 'property.view') && !can(user, 'property.view.all')) redirect('/crm');

  const scope = can(user, 'property.view.all')
    ? {}
    : { OR: [{ assignedToId: user.id }, { createdById: user.id }] };

  const term = (searchParams.q ?? '').trim();
  const like = { contains: term, mode: 'insensitive' as const };
  const search = term
    ? {
        OR: [
          { code: like },
          { title: like },
          { colony: like },
          { landmark: like },
          { listings: { some: { publicId: like } } },
          { listings: { some: { publicTitle: like } } },
          { location: { name: like } },
        ],
      }
    : {};

  /**
   * Filters, each optional and each narrowing the same query. With a few hundred
   * properties this is the difference between scrolling and finding.
   */
  const f = searchParams;
  const numeric = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);

  const filters: any[] = [];
  if (f.category) filters.push({ category: { slug: f.category } });

  /*
   * Radius search. The origin is either an explicit pin (lat/lng from the map
   * picker) or — if a locality is picked in the Locality select and a radius is
   * also chosen — that locality's own stored coordinates. Either way, once a
   * radius is active it replaces the Locality field's usual exact-match
   * behaviour; "Gwarighat, within 2km" means properties near Gwarighat, not only
   * properties whose locality field literally says Gwarighat.
   *
   * The where-clause box below is deliberately a loose rectangle, not the circle
   * itself — Prisma/Postgres compare plain numbers fine, there's no need for a
   * geo extension for that part. It just needs to comfortably contain the real
   * circle so nothing genuinely inside the radius gets excluded before the exact
   * distance check below the query, which is what actually enforces the circle
   * and what the corner cases (the four triangles between box and circle) get
   * filtered back out by.
   */
  const radiusKm = numeric(f.radiusKm);
  let origin: { lat: number; lng: number } | null = null;
  if (radiusKm) {
    const pinLat = numeric(f.lat);
    const pinLng = numeric(f.lng);
    if (pinLat != null && pinLng != null) {
      origin = { lat: pinLat, lng: pinLng };
    } else if (f.location) {
      // findFirst, not findUnique: slug is only unique combined with its parent
      // locality (parentId_slug), not on its own.
      const place = await prisma.location.findFirst({ where: { slug: f.location }, select: { latitude: true, longitude: true } });
      if (place?.latitude != null && place.longitude != null) origin = { lat: Number(place.latitude), lng: Number(place.longitude) };
    }
  }

  if (origin) {
    // ~111km per degree of latitude everywhere; longitude's distance per degree
    // shrinks with latitude, hence the cos() correction — otherwise the box would
    // be needlessly wide (near the equator) or too narrow (far from it) for the
    // actual circle. Jabalpur sits at a latitude where this matters a little.
    const latDelta = radiusKm! / 111;
    const lngDelta = radiusKm! / (111 * Math.cos((origin.lat * Math.PI) / 180));
    filters.push({
      latitude: { gte: origin.lat - latDelta, lte: origin.lat + latDelta },
      longitude: { gte: origin.lng - lngDelta, lte: origin.lng + lngDelta },
    });
  } else if (f.location) {
    filters.push({ location: { slug: f.location } });
  }

  if (f.beds) filters.push({ bedrooms: { gte: Number(f.beds) } });
  if (f.verified === 'true') filters.push({ isVerified: true });
  if (f.verified === 'false') filters.push({ isVerified: false });
  if (f.assigned) filters.push({ assignedToId: f.assigned });
  if (f.status) filters.push({ listings: { some: { status: f.status as any } } });

  const areaMin = numeric(f.areaMin);
  const areaMax = numeric(f.areaMax);
  if (areaMin || areaMax) {
    const range = { gte: areaMin, lte: areaMax };
    filters.push({ OR: [{ builtUpArea: range }, { carpetArea: range }, { plotArea: range }] });
  }

  const priceMin = numeric(f.priceMin);
  const priceMax = numeric(f.priceMax);
  if (priceMin || priceMax) {
    filters.push({
      OR: [
        { listings: { some: { price: { gte: priceMin, lte: priceMax } } } },
        { ownerExpectation: { gte: priceMin, lte: priceMax } },
      ],
    });
  }

  const tab = searchParams.tab ?? 'all';
  const tabWhere =
    tab === 'sale' ? { listings: { some: { listingType: 'SALE' as const } } }
    : tab === 'rent' ? { listings: { some: { listingType: { in: ['RENT', 'LEASE'] as any } } } }
    : tab === 'commercial' ? { category: { segment: { in: ['COMMERCIAL'] as any } } }
    : tab === 'land' ? { category: { segment: 'LAND' as const } }
    : tab === 'verified' ? { isVerified: true }
    : {};

  const [rows, counts, categories, locations, team] = await Promise.all([
    prisma.property.findMany({
      where: { AND: [scope, search, tabWhere, { isArchived: false }, ...filters] },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        category: { select: { name: true, segment: true } },
        location: { select: { name: true } },
        assignedTo: { select: { name: true } },
        media: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true, thumbUrl: true } },
        listings: {
          select: { id: true, publicId: true, listingType: true, status: true, price: true, isHotDeal: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.$transaction([
      prisma.property.count({ where: { AND: [scope, { isArchived: false }] } }),
      prisma.property.count({ where: { AND: [scope, { isArchived: false }, { listings: { some: { listingType: 'SALE' } } }] } }),
      prisma.property.count({ where: { AND: [scope, { isArchived: false }, { listings: { some: { listingType: { in: ['RENT', 'LEASE'] } } } }] } }),
      prisma.property.count({ where: { AND: [scope, { isArchived: false }, { category: { segment: 'COMMERCIAL' } }] } }),
      prisma.property.count({ where: { AND: [scope, { isArchived: false }, { category: { segment: 'LAND' } }] } }),
      prisma.property.count({ where: { AND: [scope, { isArchived: false }, { isVerified: true }] } }),
    ]),
    Promise.resolve(OWNER_PROPERTY_TYPES),
    // Was isActive: true, type: 'AREA', properties: { some: {} } — three filters
    // that each cut the list down further: excluding localities of the 'LOCALITY'
    // type (as opposed to 'AREA'), excluding ones still pending approval, and
    // excluding anywhere with no property in the CRM yet. Staff filtering here
    // need the full list — including a locality with nothing in it yet, which is
    // exactly when you'd want to go look.
    prisma.location.findMany({
      where: { type: { in: ['AREA', 'LOCALITY'] } },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.user.findMany({ where: { isActive: true, role: { key: { not: 'PARTNER' } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const [all, sale, rent, commercial, land, verified] = counts;

  /*
   * The bounding box above is a loose rectangle, so it can still include the four
   * corner areas outside the actual circle (nearer the box's corners than its
   * centre). This is what turns that rectangle into the real circle the person
   * asked for — exact distance, filtered to the radius, nearest first. A property
   * with no coordinates on file can't be placed in a circle at all, so it's left
   * out of a radius search rather than guessed at.
   */
  let finalRows = rows;
  if (origin) {
    finalRows = rows
      .map((row: any) => {
        const rLat = row.latitude != null ? Number(row.latitude) : null;
        const rLng = row.longitude != null ? Number(row.longitude) : null;
        const distanceKm = rLat != null && rLng != null ? haversineKm(origin!.lat, origin!.lng, rLat, rLng) : null;
        return { ...row, distanceKm };
      })
      .filter((row: any) => row.distanceKm != null && row.distanceKm <= radiusKm!)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl text-[var(--navy)]">Properties</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Your inventory — private records behind every listing.</p>
        </div>
        {can(user, 'property.create') && (
          <Link href="/crm/properties/new" className="btn btn-navy">＋ Add Property</Link>
        )}
      </header>

      <PropertyTable
        rows={plain(finalRows) as any[]}
        tab={tab}
        term={term}
        categories={categories}
        locations={locations.map((l) => ({ value: l.slug, label: l.name }))}
        team={team.map((u) => ({ value: u.id, label: u.name }))}
        canDelete={can(user, 'property.delete')}
        canSeePrivate={can(user, 'property.private.view')}
        tabs={[
          { key: 'all', label: 'All', count: all },
          { key: 'sale', label: 'For sale', count: sale },
          { key: 'rent', label: 'For rent', count: rent },
          { key: 'commercial', label: 'Commercial', count: commercial },
          { key: 'land', label: 'Land', count: land },
          { key: 'verified', label: 'Verified', count: verified },
        ]}
      />
    </div>
  );
}
