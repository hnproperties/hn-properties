import type { Metadata } from 'next';
import Link from 'next/link';
import { getFacets } from '@/lib/public-data';
import { site } from '@/lib/constants';

export const revalidate = 300;

export const metadata: Metadata = {
  title: `All property categories in ${site.city}`,
  description: `Browse every kind of property ${site.name} deals in — residential, commercial, land and industrial.`,
  alternates: { canonical: '/categories' },
};

const SEGMENTS = [
  { key: 'RESIDENTIAL', title: 'Residential', body: 'Homes to live in — flats, houses, villas and builder floors.', icon: '🏠', tint: 'bg-[#e8f4fa] text-[#106a94]' },
  { key: 'COMMERCIAL', title: 'Commercial', body: 'Shops, showrooms, offices, warehouses and hospitality space.', icon: '🏢', tint: 'bg-[#eae7fb] text-[#4c3fb0]' },
  { key: 'LAND', title: 'Land & plots', body: 'Residential and commercial plots, agricultural and industrial land.', icon: '📍', tint: 'bg-[#e8f6ed] text-[#16a34a]' },
];

export default async function CategoriesPage() {
  const facets = await getFacets();

  return (
    <div className="wrap py-12">
      <p className="eyebrow">Browse</p>
      <h1 className="display mt-2 text-3xl text-[var(--navy)]">All property categories</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Everything we deal in, with the number of live listings behind each. Pick a category to see what is available,
        or <Link href="/requirement" className="link-underline">tell us what you need</Link> if it isn&apos;t here.
      </p>

      <div className="mt-10 space-y-10">
        {SEGMENTS.map((segment) => {
          const categories = facets.categories.filter((c) => c.segment === segment.key);
          const count = facets.segments.find((s) => s.value === segment.key)?.count ?? 0;

          return (
            <section key={segment.key}>
              <div className="flex flex-wrap items-center gap-4">
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${segment.tint}`}>{segment.icon}</span>
                <div className="flex-1">
                  <h2 className="display text-2xl text-[var(--navy)]">{segment.title}</h2>
                  <p className="text-[var(--muted)]">{segment.body}</p>
                </div>
                <Link href={`/buy?segment=${segment.key}`} className="btn btn-ghost">
                  {count} live {count === 1 ? 'listing' : 'listings'}
                </Link>
              </div>

              {categories.length > 0 ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {categories.map((category) => (
                    <Link key={category.value} href={`/buy?category=${category.value}`} className="tile">
                      <span className="display text-lg text-[var(--navy)]">{category.label}</span>
                      <span className="text-sm text-[var(--muted)]">
                        {category.count} {category.count === 1 ? 'property' : 'properties'} available
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="plate mt-5 p-6 text-[var(--muted)]">
                  Nothing listed under {segment.title.toLowerCase()} right now.{' '}
                  <Link href="/requirement" className="link-underline">Submit a requirement</Link> and we will search our
                  off-market inventory for you.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
