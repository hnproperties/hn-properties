import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PUBLIC_LISTING_WHERE, PUBLIC_LISTING_SELECT } from '@/lib/visibility';
import PropertyCard from '@/components/PropertyCard';
import { site } from '@/lib/constants';

export const revalidate = 60;

export const metadata: Metadata = {
  title: `Search properties in ${site.city}`,
  description: `Search listings by reference code, locality or keyword at ${site.name}.`,
  alternates: { canonical: '/search' },
};

/** Reference codes look like HNP-S-JBP-000023 — sale or rent, city, serial. */
const CODE_PATTERN = /^HNP-[SR]-[A-Z]{3}-\d{4,}$/i;

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const term = (searchParams.q ?? '').trim();

  // A complete reference code has exactly one answer, so skip the results list
  // and open the property. Anything else falls through to a normal search.
  if (CODE_PATTERN.test(term)) {
    const exact = await prisma.listing.findFirst({
      where: { ...PUBLIC_LISTING_WHERE, publicId: { equals: term, mode: 'insensitive' } },
      select: { publicId: true },
    });
    if (exact) redirect(`/property/${exact.publicId}`);
  }

  const rows = term
    ? ((await prisma.listing.findMany({
        where: {
          ...PUBLIC_LISTING_WHERE,
          OR: [
            { publicId: { contains: term, mode: 'insensitive' } },
            { publicTitle: { contains: term, mode: 'insensitive' } },
            { publicDescription: { contains: term, mode: 'insensitive' } },
            { property: { colony: { contains: term, mode: 'insensitive' } } },
            { property: { landmark: { contains: term, mode: 'insensitive' } } },
            { property: { location: { name: { contains: term, mode: 'insensitive' } } } },
            { property: { category: { name: { contains: term, mode: 'insensitive' } } } },
          ],
        },
        select: PUBLIC_LISTING_SELECT,
        orderBy: [{ isHotDeal: 'desc' }, { publishedAt: 'desc' }],
        take: 48,
      })) as any[])
    : [];

  return (
    <div className="wrap py-10">
      <h1 className="display text-3xl text-[var(--navy)]">Search properties</h1>
      <p className="mt-2 text-[var(--muted)]">
        Enter a reference code such as HNP-S-JBP-000001, or search by locality, property type or keyword.
      </p>

      <form action="/search" className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={term}
          placeholder="Reference code, locality or keyword"
          aria-label="Search properties"
          className="field min-w-0 flex-1"
          autoFocus
        />
        <button type="submit" className="btn btn-primary shrink-0">
          Search
        </button>
      </form>

      {term && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          {rows.length === 0
            ? `Nothing matched “${term}”.`
            : `${rows.length} ${rows.length === 1 ? 'property' : 'properties'} matching “${term}”.`}
        </p>
      )}

      {term && rows.length === 0 && (
        <div className="plate mt-4 p-8 text-center">
          <p className="display text-lg text-[var(--navy)]">No match on the website</p>
          <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">
            Much of what we handle is placed before it reaches the website. Tell us what you are looking for, or call{' '}
            {site.phone}.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/requirement" className="btn btn-primary">
              Tell us what you need
            </Link>
            <Link href="/buy" className="btn btn-ghost">
              Browse everything
            </Link>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((listing) => (
            <PropertyCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
