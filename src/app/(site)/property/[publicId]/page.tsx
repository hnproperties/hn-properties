import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PropertyCard from '@/components/PropertyCard';
import PublicForm from '@/components/PublicForm';
import Gallery from '@/components/Gallery';
import ShareButtons from '@/components/ShareButtons';
import { getListingByPublicId, getSimilar, incrementView } from '@/lib/public-data';
import { whatsappListingMessage } from '@/lib/messaging';
import { inr, inrFull, area, ratePerUnit, coverFirst, shortDate, type MediaItem } from '@/lib/format';
import { label, site, waLink, placeLine } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { publicId: string } }): Promise<Metadata> {
  const listing = await getListingByPublicId(params.publicId);
  if (!listing) return { title: 'Property not found' };
  return {
    title: listing.seoTitle ?? listing.publicTitle,
    description: listing.seoDescription ?? listing.publicDescription?.slice(0, 155),
    alternates: { canonical: `/property/${listing.publicId}` },
    openGraph: {
      title: listing.publicTitle,
      description: listing.seoDescription ?? undefined,
      images: listing.ogImageUrl ? [listing.ogImageUrl] : coverFirst<MediaItem>(listing.property?.media).slice(0, 1).map((m) => m.url ?? ""),
    },
  };
}

export default async function PropertyPage({ params }: { params: { publicId: string } }) {
  const listing = await getListingByPublicId(params.publicId);
  if (!listing) notFound();

  const property = listing.property;
  const photos = coverFirst(property.media);
  const similar = await getSimilar(listing);
  void incrementView(listing.id); // fire and forget; never blocks the render

  const isRent = listing.listingType !== 'SALE';
  const comingSoon = listing.status === 'COMING_SOON';
  const size = property.builtUpArea ?? property.carpetArea ?? property.plotArea;
  const place = listing.publicLocation?.name ?? property.location?.name;
  const url = `${site.url}/property/${listing.publicId}`;

  const particulars: [string, string | null][] = [
    ['Property type', property.category?.name ?? null],
    ['Locality', placeLine(place)],
    ['Plot area', property.plotArea ? area(property.plotArea, property.areaUnit) : null],
    ['Built-up area', property.builtUpArea ? area(property.builtUpArea, property.areaUnit) : null],
    ['Carpet area', property.carpetArea ? area(property.carpetArea, property.areaUnit) : null],
    ['Bedrooms', property.bedrooms ? String(property.bedrooms) : null],
    ['Bathrooms', property.bathrooms ? String(property.bathrooms) : null],
    ['Balconies', property.balconies ? String(property.balconies) : null],
    ['Floor', property.floorNumber ? `${property.floorNumber}${property.totalFloors ? ` of ${property.totalFloors}` : ''}` : null],
    ['Parking', property.parkingCovered || property.parkingOpen ? `${property.parkingCovered ?? 0} covered, ${property.parkingOpen ?? 0} open` : null],
    ['Furnishing', property.furnishing ? label(property.furnishing) : null],
    ['Facing', property.facing ? label(property.facing) : null],
    ['Frontage', property.frontageFeet ? `${property.frontageFeet} ft` : null],
    ['Road width', property.roadWidthFeet ? `${property.roadWidthFeet} ft` : null],
    ['Power', property.powerKva ? `${property.powerKva} kVA` : null],
    ['Age', property.constructionYear ? `Built ${property.constructionYear}` : null],
    ['Listed', listing.publishedAt ? shortDate(listing.publishedAt) : null],
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.publicTitle,
    url,
    identifier: listing.publicId,
    datePosted: listing.publishedAt,
    description: listing.publicDescription ?? undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: place && place.toLowerCase() !== site.city.toLowerCase() ? place : site.city,
      addressRegion: site.state,
      addressCountry: 'IN',
    },
    ...(listing.price && !comingSoon
      ? { offers: { '@type': 'Offer', price: Number(listing.price), priceCurrency: 'INR', availability: 'https://schema.org/InStock' } }
      : {}),
  };

  return (
    <div className="wrap py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href={isRent ? '/rent' : '/buy'} className="link-underline">{isRent ? 'Rent' : 'Buy'}</Link>
        <span className="px-2">/</span>
        {place && (
          <>
            <Link href={`/properties/${listing.publicLocation?.slug ?? property.location?.slug}`} className="link-underline">{place}</Link>
            <span className="px-2">/</span>
          </>
        )}
        <span className="mono text-xs">{listing.publicId}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {/* Gallery — cover photograph first, chosen in the CRM */}
          <Gallery photos={photos} title={listing.publicTitle} />

          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2">
              {property.isVerified && <span className="badge badge-verified">HN Verified</span>}
              {comingSoon && <span className="badge badge-soon">Coming soon</span>}
              <span className="badge">{label(listing.listingType)}</span>
            </div>

            <h1 className="display mt-3 text-3xl leading-tight">{listing.publicTitle}</h1>
            <p className="mt-2 text-[var(--muted)]">{placeLine(place)}</p>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-y py-4">
              <p className="display text-3xl">
                {comingSoon || listing.isPriceOnRequest ? 'Price on request' : inrFull(listing.price)}
                {!comingSoon && !listing.isPriceOnRequest && isRent && (
                  <span className="text-sm font-normal text-[var(--muted)]"> per month</span>
                )}
              </p>
              {!comingSoon && size && listing.price && !isRent && (
                <p className="text-sm text-[var(--muted)]">{ratePerUnit(listing.price, size, property.areaUnit)}</p>
              )}
              {isRent && listing.securityDeposit && (
                <p className="text-sm text-[var(--muted)]">Deposit {inr(listing.securityDeposit)}</p>
              )}
              {listing.isNegotiable && !comingSoon && <span className="badge">Negotiable</span>}
            </div>

            {listing.publicDescription && (
              <div className="mt-6">
                <h2 className="display text-xl">About this property</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-[var(--ink-soft)]">{listing.publicDescription}</p>
              </div>
            )}

            <h2 className="display mt-10 text-xl">Particulars</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {particulars.filter(([, value]) => value).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 border-b pb-2 text-sm">
                  <dt className="text-[var(--muted)]">{key}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            {isRent && (listing.leaseMonths || listing.lockInMonths || listing.escalationPct || listing.maintenance) && (
              <>
                <h2 className="display mt-10 text-xl">Lease terms</h2>
                <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {[
                    ['Lease period', listing.leaseMonths ? `${listing.leaseMonths} months` : null],
                    ['Lock-in', listing.lockInMonths ? `${listing.lockInMonths} months` : null],
                    ['Escalation', listing.escalationPct ? `${listing.escalationPct}%` : null],
                    ['Maintenance', listing.maintenance ? inr(listing.maintenance) : null],
                  ].filter(([, v]) => v).map(([key, value]) => (
                    <div key={key as string} className="flex justify-between gap-4 border-b pb-2 text-sm">
                      <dt className="text-[var(--muted)]">{key}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            {property.amenities?.length > 0 && (
              <>
                <h2 className="display mt-10 text-xl">Features</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {property.amenities.map((amenity: string) => (
                    <li key={amenity} className="rounded-full border px-3 py-1 text-sm text-[var(--ink-soft)]">{amenity}</li>
                  ))}
                </ul>
              </>
            )}

            {property.suitableFor?.length > 0 && (
              <>
                <h2 className="display mt-10 text-xl">Suitable for</h2>
                <p className="mt-3 text-sm text-[var(--ink-soft)]">{property.suitableFor.join(', ')}</p>
              </>
            )}

            <div className="mt-10">
              <h2 className="display text-xl">Location</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {placeLine(place)}. We share the exact address once a visit is arranged.
              </p>
              {listing.publicLocation?.latitude && (
                <div className="plate mt-4 overflow-hidden">
                  <iframe
                    title="Approximate location"
                    className="h-[280px] w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${listing.publicLocation.latitude},${listing.publicLocation.longitude}&z=13&output=embed`}
                  />
                </div>
              )}
            </div>

            <div className="mt-8">
              <ShareButtons waHref={waLink(site.whatsapp, whatsappListingMessage(listing))} url={url} />
            </div>
          </div>
        </div>

        {/* Contact rail */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="plate p-5">
            <p className="eyebrow">Reference</p>
            <p className="mono mt-1 text-lg">{listing.publicId}</p>
            <div className="mt-4 flex flex-col gap-2">
              <a href={`tel:${site.phone}`} className="btn btn-primary">Call {site.phone}</a>
              <a
                href={waLink(site.whatsapp, `Hello HN Properties, I am interested in ${listing.publicId} — ${listing.publicTitle}.`)}
                className="btn btn-ghost"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp us
              </a>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">Enquire about this property</p>
            <PublicForm
              endpoint="/api/public/enquiries"
              hidden={{ listingId: listing.id }}
              submitLabel="Send enquiry"
              successTitle="Thank you — we have your enquiry"
              successBody="Someone from our team will call you shortly."
              fields={[
                { name: 'name', label: 'Your name', required: true, half: true },
                { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
                { name: 'message', label: 'Message', type: 'textarea', placeholder: 'When would you like to visit?' },
              ]}
            />
          </div>

          <div>
            <p className="eyebrow mb-2">Or request a site visit</p>
            <PublicForm
              endpoint="/api/public/site-visits"
              hidden={{ listingId: listing.id }}
              submitLabel="Request visit"
              successTitle="Visit requested"
              successBody="We will confirm the time with you and with the owner."
              fields={[
                { name: 'name', label: 'Your name', required: true, half: true },
                { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
                { name: 'preferredDate', label: 'Preferred date', type: 'date', required: true, half: true },
                { name: 'preferredTime', label: 'Preferred time', placeholder: 'e.g. after 5pm', half: true },
              ]}
            />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="display text-2xl">Similar properties</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((item) => <PropertyCard key={item.id} listing={item} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}
