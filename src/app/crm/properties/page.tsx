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
};

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
  if (f.location) filters.push({ location: { slug: f.location } });
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
          select: { id: true, publicId: true, listingType: true, status: true, price: true },
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
    prisma.location.findMany({
      where: { isActive: true, type: 'AREA', properties: { some: {} } },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.user.findMany({ where: { isActive: true, role: { key: { not: 'PARTNER' } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const [all, sale, rent, commercial, land, verified] = counts;

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
        rows={plain(rows) as any[]}
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
