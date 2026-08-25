import Link from 'next/link';
import PropertyCard from './PropertyCard';

type Props = {
  rows: any[];
  page?: number;
  pages?: number;
  basePath?: string;
  searchParams?: Record<string, string | undefined>;
  emptyTitle?: string;
  emptyBody?: string;
};

export default function ListingGrid({ rows, page = 1, pages = 1, basePath = '', searchParams = {}, emptyTitle, emptyBody }: Props) {
  if (!rows.length) {
    return (
      <div className="plate p-10 text-center">
        <p className="display text-lg">{emptyTitle ?? 'No properties match those filters'}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          {emptyBody ?? 'Tell us what you need and we will search our off-market inventory and our network.'}
        </p>
        <Link href="/requirement" className="btn btn-primary mt-5">Submit your requirement</Link>
      </div>
    );
  }

  const pageHref = (next: number) => {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v !== undefined) as [string, string][],
    );
    params.set('page', String(next));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((listing) => <PropertyCard key={listing.id} listing={listing} />)}
      </div>

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-ghost">Previous</Link>}
          <span className="mono px-3 text-xs text-[var(--muted)]">Page {page} of {pages}</span>
          {page < pages && <Link href={pageHref(page + 1)} className="btn btn-ghost">Next</Link>}
        </nav>
      )}
    </>
  );
}
