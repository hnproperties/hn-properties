import Link from 'next/link';
import PropertyCard from '@/components/PropertyCard';
import HeroSearch from '@/components/HeroSearch';
import { getFeatured, getRecent, getComingSoon, getPublicIndexes, getLocationsWithInventory } from '@/lib/public-data';
import { site } from '@/lib/constants';

export const revalidate = 300;

const CATEGORY_TILES = [
  { icon: '🏠', title: 'Residential', body: 'Houses, flats, villas', href: '/buy?segment=RESIDENTIAL', tint: 'bg-[#e8f4fa] text-[#106a94]' },
  { icon: '🏢', title: 'Commercial', body: 'Shops, offices, showrooms', href: '/buy?segment=COMMERCIAL', tint: 'bg-[#eae7fb] text-[#4c3fb0]' },
  { icon: '📍', title: 'Plots & Land', body: 'Residential & commercial', href: '/buy?segment=LAND', tint: 'bg-[#fdeaea] text-[#b03636]' },
  { icon: '🌾', title: 'Agricultural', body: 'Farmland, farmhouse land', href: '/buy?category=agricultural-land', tint: 'bg-[#e8f6ed] text-[#16a34a]' },
  { icon: '🏭', title: 'Industrial', body: 'Industrial land & buildings', href: '/buy?category=industrial-land', tint: 'bg-[#fef6e7] text-[#a5690a]' },
];

const TRUST = [
  { icon: '🛡️', title: 'Verified Properties', body: 'Checked and confirmed by our own team', tint: 'bg-[#e8f6ed]' },
  { icon: '📍', title: 'Local Expertise', body: `Deep knowledge of ${site.city}`, tint: 'bg-[#e8f4fa]' },
  { icon: '🤝', title: 'Transparent Deals', body: 'Honest pricing, nothing hidden', tint: 'bg-[#fef6e7]' },
  { icon: '🔑', title: 'End to End Support', body: 'From first search to possession', tint: 'bg-[#eae7fb]' },
];

/** `short` is the two-word label used by the compact mobile tiles. */
const ACTIONS = [
  { href: '/buy', icon: '🏠', title: 'Buy Property', short: 'Buy', body: 'Find your next home or investment' },
  { href: '/rent', icon: '🔑', title: 'Rent Property', short: 'Rent', body: 'Residential and commercial rentals' },
  { href: '/sell', icon: '🏷️', title: 'Sell Property', short: 'Sell', body: 'List your property for sale' },
  { href: '/give-on-rent', icon: '📋', title: 'Give on Rent', short: 'Give on Rent', body: 'Find a screened tenant' },
  { href: '/requirement', icon: '🔎', title: 'Submit Requirement', short: 'Requirement', body: 'Tell us exactly what you need' },
];

export default async function HomePage() {
  const [featured, recent, comingSoon, indexes, localities] = await Promise.all([
    getFeatured(8),
    getRecent(6),
    getComingSoon(3),
    getPublicIndexes(),
    getLocationsWithInventory(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="hero-band relative z-0">
        <div className="wrap grid content-center gap-8 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:py-12 lg:pb-24">
          <div className="animate-rise">
            <h1 className="display text-shadow-hero text-4xl leading-[1.1] sm:text-5xl">
              Find the Right<br />Property in <span className="text-[var(--accent)]">{site.city}</span>
            </h1>
            <p className="text-shadow-hero mt-4 text-xl font-semibold text-white">Buy • Rent • Sell • Give on Rent</p>
            <p className="text-shadow-hero mt-2 text-lg text-white/85">Your trusted property consultant — {site.name}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {['✓ Verified Properties', `📍 Local ${site.city} Expertise`, '👤 Personalised Assistance'].map((chip) => (
                <span key={chip} className="rounded-full border border-white/40 bg-black/25 px-4 py-2 text-base text-white transition duration-300 hover:-translate-y-0.5 hover:bg-black/35">
                  {chip}
                </span>
              ))}
            </div>

            <dl className="mt-8 flex gap-10 border-t border-white/15 pt-5">
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-white/75">For sale</dt>
                <dd className="display text-shadow-hero text-4xl">{indexes.counts.SALE ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-white/75">On rent</dt>
                <dd className="display text-shadow-hero text-4xl">{(indexes.counts.RENT ?? 0) + (indexes.counts.LEASE ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-white/75">Localities</dt>
                <dd className="display text-shadow-hero text-4xl">{localities.length}</dd>
              </div>
            </dl>
          </div>

          {/* Action panel */}
          <div className="glass-dark animate-rise-2 p-5 shadow-2xl">
            <p className="text-sm text-white/70">Talk to {site.name}</p>
            <a href={`tel:${site.phone}`} className="display block text-3xl">📞 {site.phone}</a>
            <p className="mt-1 text-xs text-white/60">Your trusted property consultant</p>

            {/*
              Phones get five compact tiles in a row — icon over a short label —
              so the whole panel is glanceable without scrolling. From sm up the
              original wide rows return, where there is room for the descriptions.
            */}
            <div className="mt-4 grid grid-cols-5 gap-1.5 sm:hidden">
              {ACTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-xl bg-white px-1 py-2.5 text-center transition active:scale-95"
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="text-[10.5px] font-semibold leading-tight text-[var(--navy)]">{item.short}</span>
                </Link>
              ))}
            </div>

            <div className="mt-4 hidden space-y-2 sm:block">
              {ACTIONS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg bg-white px-4 py-2.5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-[var(--navy)]">{item.title}</span>
                    <span className="block text-sm text-[var(--muted)]">{item.body}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Search panel, overlapping the hero */}
      <section className="wrap animate-rise-3 relative z-30 -mt-10">
        <HeroSearch categories={indexes.categories} locations={indexes.locations} />
      </section>

      {/* Categories */}
      <section className="wrap py-14">
        <div className="flex items-end justify-between">
          <h2 className="display text-2xl text-[var(--navy)] sm:text-3xl">Browse by Category</h2>
          <Link href="/categories" className="link-grow text-base font-semibold text-[var(--brand)]">View all categories →</Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORY_TILES.map((tile) => (
            <Link key={tile.title} href={tile.href} className="tile animate-rise">
              <span className={`tile-icon ${tile.tint}`}>{tile.icon}</span>
              <span>
                <span className="display block text-lg text-[var(--navy)]">{tile.title}</span>
                <span className="block text-sm text-[var(--muted)]">{tile.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="wrap pb-14">
          <div className="flex items-end justify-between">
            <h2 className="display text-2xl text-[var(--navy)] sm:text-3xl">Featured Properties in {site.city}</h2>
            <Link href="/buy" className="link-grow text-base font-semibold text-[var(--brand)]">View all properties →</Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.slice(0, 8).map((listing, i) => (
              <div key={listing.id} className={`animate-rise-${(i % 3) + 1}`}>
                <PropertyCard listing={listing} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust bar */}
      <section className="wrap pb-14">
        <div className="plate grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ${item.tint}`}>{item.icon}</span>
              <span>
                <span className="block text-base font-semibold text-[var(--navy)]">{item.title}</span>
                <span className="block text-sm text-[var(--muted)]">{item.body}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Localities */}
      {localities.length > 0 && (
        <section className="border-y bg-white py-12">
          <div className="wrap">
            <h2 className="display text-2xl text-[var(--navy)] sm:text-3xl">Browse by Locality</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {localities.map((locality) => (
                <Link
                  key={locality.slug}
                  href={`/properties/${locality.slug}`}
                  className="rounded-full border bg-white px-5 py-2.5 text-base font-medium transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:text-[var(--brand)] hover:shadow-md"
                >
                  {locality.name} <span className="text-xs text-[var(--muted)]">({locality.count})</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent + coming soon */}
      <section className="wrap py-14">
        <h2 className="display text-2xl text-[var(--navy)] sm:text-3xl">Recently Added</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recent.map((listing) => <PropertyCard key={listing.id} listing={listing} compact />)}
        </div>

        {comingSoon.length > 0 && (
          <>
            <h2 className="display mt-14 text-2xl text-[var(--navy)]">Coming Soon</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Properties we are preparing to list. Call us to hear about them first.</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {comingSoon.map((listing) => <PropertyCard key={listing.id} listing={listing} compact />)}
            </div>
          </>
        )}
      </section>

      {/* Owner CTAs */}
      <section className="border-t bg-white py-14">
        <div className="wrap grid gap-5 md:grid-cols-3">
          {[
            { title: 'Have a property to sell?', body: 'Share the details and we will value it, verify it and bring you buyers.', href: '/sell', cta: 'Sell Your Property' },
            { title: 'Want to rent it out?', body: 'We screen tenants, handle viewings and put the agreement in place.', href: '/give-on-rent', cta: 'List for Rent' },
            { title: "Can't find what you need?", body: 'Tell us the requirement. Much of our inventory never reaches the website.', href: '/requirement', cta: 'Submit Requirement' },
          ].map((card) => (
            <div key={card.href} className="plate flex flex-col p-6">
              <h3 className="display text-xl text-[var(--navy)]">{card.title}</h3>
              <p className="mt-2 flex-1 text-base text-[var(--muted)]">{card.body}</p>
              <Link href={card.href} className="btn btn-primary mt-5 self-start">{card.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="wrap py-14">
        <h2 className="display text-2xl text-[var(--navy)] sm:text-3xl">Why {site.name}</h2>
        <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Local knowledge', `We work ${site.city} street by street — what a locality is worth, which colonies are moving, where the road is going to widen.`],
            ['Residential and commercial', 'Flats and houses, but also shops, offices, warehouses and agricultural land. One consultant for the whole portfolio.'],
            ['A verification process', 'Our HN Verified mark means we have met the owner, visited the property, seen the ownership papers and confirmed availability.'],
            ['Owner and buyer support', 'Site visits arranged, paperwork explained, negotiation handled in person.'],
            ['Buy and rent', 'The same team handles sale and rental, so a client who is renting today can buy through us later.'],
            ['One number', `Everything goes through ${site.phone}. Nothing gets lost between channels.`],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="text-lg font-semibold text-[var(--navy)]">{title}</h3>
              <p className="mt-1.5 text-base leading-relaxed text-[var(--muted)]">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-xs text-[var(--muted)]">
          HN Verified describes our own internal checks. It is not a legal guarantee of title —
          please have your advocate examine the documents before any transaction.
        </p>
      </section>
    </>
  );
}
