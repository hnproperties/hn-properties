import type { Metadata } from 'next';
import Link from 'next/link';
import BrowseFilters from '@/components/BrowseFilters';
import FilterShell from '@/components/FilterShell';
import ListingGrid from '@/components/ListingGrid';
import { getListings, getFacets } from '@/lib/public-data';
import type { PublicQuery } from '@/lib/search';
import { site } from '@/lib/constants';

export const revalidate = 120;

export const metadata: Metadata = {
  title: `Property on rent in ${site.city}`,
  description: `Flats, houses, shops, offices and warehouses on rent and lease in ${site.city}.`,
  alternates: { canonical: '/rent' },
};

const SORTS = [
  { value: '', label: 'Featured first' },
  { value: 'price-asc', label: 'Rent: low to high' },
  { value: 'price-desc', label: 'Rent: high to low' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'oldest', label: 'Oldest first' },
];

export default async function RentPage({ searchParams }: { searchParams: PublicQuery }) {
  const query = { ...searchParams, type: 'RENT' };
  const [{ rows, total, page, pages }, facets] = await Promise.all([getListings(query), getFacets('RENT')]);

  const activeCount = Object.entries(searchParams).filter(
    ([key]) => !['sort', 'page', 'type'].includes(key),
  ).length;

  return (
    <div className="wrap py-10">
      <p className="eyebrow">Rent</p>
      <h1 className="display mt-2 text-3xl text-[var(--navy)]">Property on rent in {site.city}</h1>
      <p className="mt-2 text-[var(--muted)]">
        {total} {total === 1 ? 'property' : 'properties'} available ·{' '}
        <Link href="/buy" className="link-underline">looking to buy instead?</Link>
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[290px_1fr]">
        <FilterShell activeCount={activeCount}>
          <BrowseFilters categories={facets.categories} locations={facets.locations} segments={facets.segments} />
        </FilterShell>

        <div>
          <div className="plate mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
            <p className="text-[var(--muted)]">Showing {rows.length} of {total}</p>
            <form className="flex items-center gap-3">
              {Object.entries(searchParams)
                .filter(([key]) => key !== 'sort' && key !== 'page')
                .map(([key, value]) => <input key={key} type="hidden" name={key} value={String(value)} />)}
              <label className="text-sm font-semibold text-[var(--ink-soft)]" htmlFor="sort">Sort</label>
              <select id="sort" name="sort" defaultValue={searchParams.sort ?? ''} className="field w-[190px] py-2">
                {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <button type="submit" className="btn btn-ghost py-2">Apply</button>
            </form>
          </div>

          <ListingGrid
            rows={rows}
            page={page}
            pages={pages}
            basePath="/rent"
            searchParams={searchParams as any}
            emptyTitle="No rentals match those filters"
            emptyBody="Rental stock moves quickly. Tell us what you need and we will call you when something fits."
          />
        </div>
      </div>
    </div>
  );
}
