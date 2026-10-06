import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ListingGrid from '@/components/ListingGrid';
import MarketFilters from '@/components/MarketFilters';
import { getListings, getPublicIndexes, getLocationsWithInventory } from '@/lib/public-data';
import { site } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** Only localities that actually hold inventory get a page — no thin duplicates. */
export async function generateStaticParams() {
  const locations = await getLocationsWithInventory();
  return locations.map((location) => ({ location: location.slug }));
}

export async function generateMetadata({ params }: { params: { location: string } }): Promise<Metadata> {
  const locations = await getLocationsWithInventory();
  const match = locations.find((l) => l.slug === params.location);
  if (!match) return { title: 'Locality not found' };
  return {
    title: `Property in ${match.name}, ${site.city}`,
    description: `${match.count} properties for sale and on rent in ${match.name}, ${site.city}.`,
    alternates: { canonical: `/properties/${match.slug}` },
  };
}

export default async function LocationPage({
  params,
  searchParams,
}: {
  params: { location: string };
  searchParams: Record<string, string>;
}) {
  const locations = await getLocationsWithInventory();
  const match = locations.find((l) => l.slug === params.location);
  if (!match) notFound();

  const [{ rows, total, page, pages }, indexes] = await Promise.all([
    getListings({ ...searchParams, location: params.location }),
    getPublicIndexes(),
  ]);

  return (
    <div className="wrap py-10">
      <p className="eyebrow">{site.city}</p>
      <h1 className="display mt-2 text-3xl">Property in {match.name}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{total} listings, for sale and on rent</p>

      <div className="mt-6">
        <MarketFilters categories={indexes.categories} locations={indexes.locations} />
      </div>

      <div className="mt-8">
        <ListingGrid rows={rows} page={page} pages={pages} basePath={`/properties/${params.location}`} searchParams={searchParams} />
      </div>
    </div>
  );
}
