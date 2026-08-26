import type { Metadata } from 'next';
import Link from 'next/link';
import { getHotDeals } from '@/lib/public-data';
import PropertyCard from '@/components/PropertyCard';
import { site } from '@/lib/constants';

export const revalidate = 300;

export const metadata: Metadata = {
  title: `Hot deals on property in ${site.city}`,
  description: `Sharply priced and urgent listings currently on our books at ${site.name}. Deals move quickly — call to check what is still available.`,
  alternates: { canonical: '/hot-deals' },
};

export default async function HotDealsPage() {
  const deals = await getHotDeals();

  return (
    <div className="wrap py-12">
      <p className="eyebrow">Hot deals</p>
      <h1 className="display mt-2 text-3xl text-[var(--navy)]">🔥 Deals worth moving on</h1>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        Properties our team has picked out as sharply priced, urgent, or unusually well suited to the right
        buyer. These change often — if something here fits, call {site.phone} before it goes.
      </p>

      {deals.length === 0 ? (
        <div className="plate mt-10 p-12 text-center">
          <p className="display text-lg text-[var(--navy)]">No hot deals listed right now</p>
          <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">
            Our best deals are often placed before they reach the website. Tell us what you are looking for and
            we will call you when something fits.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/requirement" className="btn btn-primary">Tell us what you need</Link>
            <Link href="/buy" className="btn btn-ghost">Browse everything</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {deals.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>

          <section className="plate mt-12 p-6">
            <h2 className="display text-xl text-[var(--navy)]">Not seeing the right one?</h2>
            <p className="mt-2 max-w-2xl text-[var(--muted)]">
              Much of what we handle never reaches this page. Tell us your budget and area, and we will match it
              against our inventory and our consultant network.
            </p>
            <Link href="/requirement" className="btn btn-primary mt-4">Submit your requirement</Link>
          </section>
        </>
      )}
    </div>
  );
}
