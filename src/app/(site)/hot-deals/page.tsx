import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
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
      {/*
        The artwork carries the heading visually, but search engines and screen
        readers still need real text — hence the sr-only h1 alongside it. The
        image is decorative (alt="") because the h1 already says the same thing;
        announcing it twice would be worse, not better.
      */}
      <div className="flex flex-col items-center text-center">
        <h1 className="sr-only">Hot deals on property in {site.city}</h1>
        <Image
          src="/hot-deals-banner.png"
          alt=""
          width={1000}
          height={563}
          priority
          className="h-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[520px]"
        />
        <p className="mt-2 max-w-3xl text-lg text-[var(--muted)]">
          Properties our team has picked out as sharply priced, urgent, or unusually well suited to the right
          buyer. These change often — if something here fits, call {site.phone} before it goes.
        </p>
      </div>

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
