import Link from 'next/link';
import Photo from './Photo';
import { inr, area, coverFirst, type MediaItem } from '@/lib/format';
import { label } from '@/lib/constants';

type Props = { listing: any; compact?: boolean };

/** The public listing card. Every field on it comes from the public projection. */
export default function PropertyCard({ listing, compact }: Props) {
  const property = listing.property ?? {};
  const photo = coverFirst<MediaItem>(property.media)[0];
  const size = property.builtUpArea ?? property.plotArea ?? property.carpetArea;
  const place = listing.publicLocation?.name ?? property.location?.name;
  const isRent = listing.listingType !== 'SALE';
  const comingSoon = listing.status === 'COMING_SOON';

  // A hot deal keeps its badge until its end date passes. The date is optional,
  // so an undated deal simply stays hot until someone unticks it in the CRM.
  const hotDeal =
    !!listing.isHotDeal && (!listing.hotDealUntil || new Date(listing.hotDealUntil) >= new Date());

  return (
    <article
      className={`plate group overflow-hidden transition duration-500 [transition-timing-function:var(--ease-spring)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)] ${
        hotDeal ? 'ring-2 ring-[#e8590c] ring-offset-2' : ''
      }`}
    >
      <Link href={`/property/${listing.publicId}`} className="block">
        <div className={`photo ${compact ? 'aspect-[4/3]' : 'aspect-[16/10]'}`}>
          <Photo src={photo?.thumbUrl ?? photo?.url} alt={photo?.alt ?? listing.publicTitle} fallback="Photographs on request" />

          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="badge badge-sale bg-white/95">{isRent ? 'For Rent' : 'For Sale'}</span>
            {comingSoon && <span className="badge badge-soon">Coming soon</span>}
            {hotDeal && (
              <span className="badge bg-gradient-to-r from-[#e8590c] to-[#f08c00] text-white">🔥 Hot Deal</span>
            )}
          </div>
          {property.isVerified && (
            <span className="badge badge-verified absolute right-3 top-3 bg-white/95">✓ HN Verified</span>
          )}
        </div>

        <div className="space-y-2.5 p-4">
          <h3 className="display text-xl leading-snug text-[var(--navy)]">{listing.publicTitle}</h3>

          {hotDeal && listing.hotDealNote && (
            <p className="rounded-lg bg-[#fff4e6] px-3 py-2 text-sm font-medium text-[#c2410c]">
              {listing.hotDealNote}
            </p>
          )}
          <p className="text-base text-[var(--muted)]">
            📍 {[place, property.category?.name].filter(Boolean).join(' · ')}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-[var(--ink-soft)]">
            {property.bedrooms ? <span>{property.bedrooms} Bed</span> : null}
            {property.bathrooms ? <span>{property.bathrooms} Bath</span> : null}
            {size ? <span>{area(size, property.areaUnit)}</span> : null}
          </div>

          <div className="flex items-end justify-between border-t pt-3">
            <div>
              <p className="display text-2xl text-[var(--navy)]">
                {listing.isPriceOnRequest || comingSoon ? 'On request' : inr(listing.price)}
                {!listing.isPriceOnRequest && !comingSoon && isRent && (
                  <span className="text-sm font-medium text-[var(--muted)]"> / month</span>
                )}
              </p>
              <p className="mono text-xs text-[var(--muted)]">{listing.publicId}</p>
            </div>
            <span className="btn btn-primary sheen py-2.5 text-sm">Enquire Now</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
