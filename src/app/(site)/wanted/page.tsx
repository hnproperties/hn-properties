import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicRequirements } from '@/lib/public-data';
import { inr, area, shortDate } from '@/lib/format';
import { label, site, waLink } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Property demand in ${site.city}`,
  description: `Live demand from buyers, tenants and companies on our books at ${site.name}. If you own something that fits, get in touch — we already have the client.`,
  alternates: { canonical: '/wanted' },
};

export default async function WantedPage() {
  const requirements = await getPublicRequirements();

  return (
    <div className="wrap py-12">
      <p className="eyebrow">🥇 Property Demand</p>
      <h1 className="display mt-2 text-3xl text-[var(--navy)]">What buyers, tenants and companies are asking for</h1>
      <p className="mt-3 max-w-3xl text-[var(--muted)]">
        These are live requirements from individuals, companies and corporate clients on our books. If you own something that fits, tell us —
        the buyer or tenant already exists, which usually means a faster, quieter sale than putting it on the open market.
      </p>

      {requirements.length === 0 ? (
        <div className="plate mt-10 p-12 text-center">
          <p className="display text-lg text-[var(--navy)]">No open demand listed at the moment</p>
          <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">
            We match most requirements privately. Call {site.phone} and we will tell you what our clients are asking for.
          </p>
          <Link href="/post" className="btn btn-primary mt-6">List your property anyway</Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {requirements.map((requirement) => {
            const types = requirement.categories.map((c: any) => c.category.name);
            const places = requirement.locations.map((l: any) => l.location.name);
            const heading = types.length ? types.join(' / ') : 'Property';
            const message = `Hello ${site.name}, I have a property that may suit requirement ${requirement.code}.`;

            return (
              <article key={requirement.id} className="plate flex flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`badge ${requirement.listingType === 'SALE' ? 'badge-verified' : 'badge-sale'}`}>
                    Wanted · {label(requirement.listingType) === 'Sale' ? 'to buy' : 'on rent'}
                  </span>
                  <span className="mono text-xs text-[var(--muted)]">{requirement.code}</span>
                </div>

                <h2 className="display mt-3 text-xl text-[var(--navy)]">{heading}</h2>
                <p className="mt-1 text-[var(--muted)]">
                  {places.length ? places.join(', ') : `Anywhere in ${site.city}`}
                </p>

                <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
                  {(requirement.budgetMin || requirement.budgetMax) && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">Budget</dt>
                      <dd className="font-semibold">
                        {requirement.budgetMin ? inr(requirement.budgetMin) : 'Up to'} {requirement.budgetMax ? `– ${inr(requirement.budgetMax)}` : ''}
                        {requirement.listingType !== 'SALE' ? ' / month' : ''}
                      </dd>
                    </div>
                  )}
                  {(requirement.areaMin || requirement.areaMax) && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">Area</dt>
                      <dd className="font-medium">
                        {requirement.areaMin ? area(requirement.areaMin, requirement.areaUnit) : ''}
                        {requirement.areaMax ? ` – ${area(requirement.areaMax, requirement.areaUnit)}` : ' and above'}
                      </dd>
                    </div>
                  )}
                  {requirement.bedroomsMin && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">Bedrooms</dt>
                      <dd className="font-medium">{requirement.bedroomsMin}+</dd>
                    </div>
                  )}
                  {requirement.purpose && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">Purpose</dt>
                      <dd className="font-medium">{requirement.purpose}</dd>
                    </div>
                  )}
                  {requirement.timeline && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">Timeline</dt>
                      <dd className="font-medium">{requirement.timeline}</dd>
                    </div>
                  )}
                </dl>

                {requirement.publicNote && (
                  <p className="mt-3 rounded-lg bg-[var(--paper)] p-3 text-sm">{requirement.publicNote}</p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <a
                    href={waLink(site.whatsapp, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary flex-1 whitespace-nowrap"
                  >
                    I have this property
                  </a>
                  <a href={`tel:${site.phone}`} className="btn btn-ghost">Call</a>
                </div>

                <p className="mt-2 text-xs text-[var(--muted)]">
                  Listed {shortDate(requirement.publishedAt ?? requirement.createdAt)}
                </p>
              </article>
            );
          })}
        </div>
      )}

      <section className="plate mt-12 p-6">
        <h2 className="display text-xl text-[var(--navy)]">Looking for something yourself?</h2>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Tell us what you need and we will search our inventory, our off-market listings and our network of
          consultants. Much of what we handle never reaches this website.
        </p>
        <Link href="/requirement" className="btn btn-primary mt-4">Submit your requirement</Link>
      </section>
    </div>
  );
}
