import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/constants';

export const metadata: Metadata = {
  title: `About ${site.name}`,
  description: `${site.name} is a property consultancy in ${site.city}, Madhya Pradesh, founded by Harshit Narang.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="wrap max-w-3xl py-14">
      <p className="eyebrow">About</p>
      <h1 className="display mt-2 text-3xl">HN Properties</h1>

      <div className="mt-6 space-y-5 leading-relaxed text-[var(--ink-soft)]">
        <p>
          HN Properties is a property consultancy based in {site.city}, Madhya Pradesh, founded by
          Harshit Narang. We deal in residential, commercial and agricultural property — houses,
          flats, villas, plots, shops, showrooms, offices, warehouses, farmland and institutional
          space — for sale and on rent.
        </p>
        <p>
          Our work is local and it is done in person. We know which colonies are moving, what a
          plot on a particular road is actually worth, and which owners are serious. A listing on
          this site has been seen by us, not forwarded from a chain of brokers.
        </p>
        <p>
          For owners, that means an honest asking price and buyers who have been qualified before
          they arrive. For buyers and tenants, it means a shortlist worth your time, and someone
          who stays on the file through negotiation, agreement and registration.
        </p>
        <p>
          We are building towards a proper property marketplace for {site.city} — with a verified
          inventory, a working requirement-matching system, and a network of consultants we
          collaborate with. This website is the first part of it.
        </p>
      </div>

      <div className="plate mt-10 p-6">
        <p className="eyebrow">Talk to us</p>
        <p className="mt-2 text-lg">{site.phone}</p>
        <p className="text-sm text-[var(--muted)]">{site.address}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/contact" className="btn btn-primary">Contact us</Link>
          <Link href="/requirement" className="btn btn-ghost">Submit a requirement</Link>
        </div>
      </div>
    </div>
  );
}
