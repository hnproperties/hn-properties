'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoApproval from './PhotoApproval';
import { inr, area, shortDate } from '@/lib/format';
import { label, placeLine } from '@/lib/constants';
import { play } from '@/lib/sound';

const CHECKS: [string, string][] = [
  ['ownerIdSeen', 'Owner identity seen'],
  ['siteVisited', 'Property visited by our team'],
  ['docsReceived', 'Ownership documents received'],
  ['photosOurs', 'Photographs taken by us'],
  ['availability', 'Availability confirmed with the owner'],
];

/** One submission: what the owner sent, the verification checklist, and the decision. */
export default function ReviewCard({
  listing,
  canPublish,
  canVerify,
  canSeeOwner,
  canSeeAddress,
  mapUrl,
  mapEmbedUrl,
}: {
  listing: any;
  canPublish: boolean;
  canVerify: boolean;
  canSeeOwner: boolean;
  canSeeAddress?: boolean;
  mapUrl?: string | null;
  mapEmbedUrl?: string | null;
}) {
  const router = useRouter();
  const property = listing.property ?? {};
  const existing = property.verifications?.[0];

  const [checks, setChecks] = useState<Record<string, boolean>>({
    ownerIdSeen: !!existing?.ownerIdSeen,
    siteVisited: !!existing?.siteVisited,
    docsReceived: !!existing?.docsReceived,
    photosOurs: !!existing?.photosOurs,
    availability: !!existing?.availability,
  });
  const [price, setPrice] = useState<string>(listing.price ? String(listing.price) : '');
  const [title, setTitle] = useState<string>(listing.publicTitle ?? '');
  const [description, setDescription] = useState<string>(listing.publicDescription ?? '');
  const [year, setYear] = useState<string>(property.constructionYear ? String(property.constructionYear) : '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verified, setVerified] = useState(!!property.isVerified);
  const approvedCount = (property.media ?? []).filter((m: any) => m.isPublic).length;

  async function saveChecklist() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/properties/${property.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checks),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? 'Could not save');
    setVerified(payload.data.isVerified);
    setMessage(payload.data.isVerified ? 'HN Verified — all checks passed.' : 'Checklist saved. Not verified until every check passes.');
  }

  /** Saves the copy an owner submitted, after the desk has tidied it up. */
  async function saveDetails() {
    setSavingDetails(true);
    setDetailsMessage(null);

    const [listingResponse, propertyResponse] = await Promise.all([
      fetch(`/api/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicTitle: title,
          publicDescription: description,
          ...(price ? { price: Number(price) } : {}),
        }),
      }),
      fetch(`/api/properties/${property.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: description,
          constructionYear: year ? Number(year) : undefined,
        }),
      }),
    ]);

    setSavingDetails(false);
    if (listingResponse.ok && propertyResponse.ok) {
      setDetailsMessage('Saved.');
      router.refresh();
    } else {
      const payload = await (listingResponse.ok ? propertyResponse : listingResponse).json().catch(() => ({}));
      setDetailsMessage(payload.error ?? 'Could not save those details');
    }
  }

  async function decide(action: 'publish' | 'coming-soon' | 'reject') {
    if (action === 'reject' && !confirm('Reject this submission? The owner record and photographs stay on file.')) return;

    setBusy(true);
    setMessage(null);

    // Carry any edits made on this card through before publishing.
    if (action !== 'reject') {
      await saveDetails();
    }

    const response = await fetch(`/api/listings/${listing.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      play('error');
      return setMessage(payload.error ?? 'Could not complete that');
    }
    play('success');

    setMessage(
      action === 'reject'
        ? 'Rejected. It stays in the CRM but will never appear publicly.'
        : `Done — public ID ${payload.data.publicId}.`,
    );
    router.refresh();
  }

  const size = property.builtUpArea ?? property.plotArea ?? property.carpetArea;

  return (
    <article className="plate overflow-hidden">
      <div className="grid gap-6 p-5 lg:grid-cols-[320px_1fr]">
        {/* First photograph, as a thumbnail. Curation happens in the panel below. */}
        <div>
          {property.media?.length ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={property.media[0].url} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
              <p className="mt-2 text-xs text-[var(--muted)]">
                {property.media.length} submitted ·{' '}
                {property.media.filter((m: any) => m.isPublic).length} approved for the website
              </p>
            </>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-[var(--paper)] text-sm text-[var(--muted)]">
              No photographs submitted
            </div>
          )}
        </div>

        {/* Details and decision */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">{label(listing.status)}</span>
                <span className="badge badge-sale">{label(listing.listingType)}</span>
                {verified && <span className="badge badge-verified">HN Verified</span>}
              </div>
              <h2 className="display mt-2 text-xl text-[var(--navy)]">{listing.publicTitle}</h2>
              <p className="mono text-xs text-[var(--muted)]">{property.code} · submitted {shortDate(listing.createdAt)}</p>
            </div>
            <a href={`/crm/properties/${property.id}`} className="btn btn-ghost py-2 text-sm">Open full record</a>
          </div>

          <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {[
              ['Type', property.category?.name],
              ['Locality', placeLine(property.location?.name)],
              ['Area', size ? area(size, property.areaUnit) : null],
              ['Configuration', property.bedrooms ? `${property.bedrooms} BHK, ${property.bathrooms ?? '—'} bath` : null],
              ['Floor', property.floorNumber ? `${property.floorNumber}${property.totalFloors ? ` of ${property.totalFloors}` : ''}` : null],
              ['Owner expectation', property.ownerExpectation ? inr(property.ownerExpectation) : null],
              ['Owner', canSeeOwner ? property.owner?.name : 'Hidden for your role'],
              ['Owner phone', canSeeOwner ? property.owner?.phone : '—'],
            ].filter(([, value]) => value).map(([key, value]) => (
              <div key={key as string} className="flex justify-between gap-4 border-b pb-1.5 text-sm">
                <dt className="text-[var(--muted)]">{key}</dt>
                <dd className="text-right font-medium">{value as string}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[var(--navy)]">Listing details</p>
              <button type="button" className="btn btn-ghost py-2 text-sm" disabled={savingDetails} onClick={saveDetails}>
                {savingDetails ? 'Saving…' : 'Save details'}
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              This is what the website will show. Tidy up whatever the owner wrote before publishing.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]">
              <div>
                <label className="label" htmlFor={`title-${listing.id}`}>Public title</label>
                <input
                  id={`title-${listing.id}`}
                  className="field py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor={`year-${listing.id}`}>Year built</label>
                <input
                  id={`year-${listing.id}`}
                  type="number"
                  min={1900}
                  max={new Date().getFullYear() + 5}
                  className="field py-2"
                  placeholder="e.g. 2019"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="label" htmlFor={`desc-${listing.id}`}>Description — &ldquo;anything else we should know&rdquo;</label>
              <textarea
                id={`desc-${listing.id}`}
                className="field min-h-[110px] py-2"
                placeholder="What the owner told us, rewritten for buyers."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {detailsMessage && (
              <p className={`mt-2 text-sm font-medium ${detailsMessage === 'Saved.' ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>
                {detailsMessage}
              </p>
            )}
          </div>

          {canSeeAddress && (property.addressLine || mapUrl) && (
            <div className="mt-5 rounded-lg border border-[var(--brass)] bg-[var(--brass-soft)] p-4">
              <p className="font-semibold text-[var(--navy)]">Where it is — private</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Given by the owner so our team can find it. Never shown on the website.
              </p>
              {property.addressLine && <p className="mt-2 text-sm">{property.addressLine}</p>}

              {mapEmbedUrl && (
                <div className="mt-3 overflow-hidden rounded-lg border">
                  <iframe
                    title="Property location"
                    className="h-[200px] w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={mapEmbedUrl}
                  />
                </div>
              )}

              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-3 py-2 text-sm">
                  📍 Open in Google Maps
                </a>
              )}
            </div>
          )}

          <PhotoApproval propertyId={property.id} initial={property.media ?? []} />

          {/* Verification checklist */}
          {canVerify && (
            <div className="mt-5 rounded-lg border p-4">
              <p className="font-semibold text-[var(--navy)]">HN Verified checklist</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                The badge appears only when all five pass. Tick only what has actually been done.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CHECKS.map(([key, text]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={!!checks[key]}
                      onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}
                    />
                    {text}
                  </label>
                ))}
              </div>
              <button type="button" className="btn btn-ghost mt-3 py-2 text-sm" disabled={busy} onClick={saveChecklist}>
                Save checklist
              </button>
            </div>
          )}

          {/* Decision */}
          <div className="mt-5 flex flex-wrap items-end gap-3 border-t pt-4">
            <div className="w-[200px]">
              <label className="label" htmlFor={`price-${listing.id}`}>
                {listing.listingType === 'SALE' ? 'Public price (₹)' : 'Public rent (₹)'}
              </label>
              <input
                id={`price-${listing.id}`}
                type="number"
                className="field py-2"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Set before publishing"
              />
            </div>

            {canPublish ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => decide('publish')}
                  title={approvedCount === 0 ? 'Approve and save at least one photograph first' : undefined}
                >
                  {busy ? 'Working…' : 'Publish to website'}
                </button>
                <button type="button" className="btn btn-brass" disabled={busy} onClick={() => decide('coming-soon')}>
                  Coming soon
                </button>
                <button type="button" className="btn btn-ghost text-[var(--danger)]" disabled={busy} onClick={() => decide('reject')}>
                  Reject
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Your role cannot publish — a manager will make the decision.</p>
            )}
          </div>

          {approvedCount === 0 && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No photograph is approved yet. Tick <span className="font-medium">Show publicly</span> on the ones you want,
              then press <span className="font-medium">Save photographs</span> — the tick alone does not save it.
            </p>
          )}

          {message && <p className="mt-3 text-sm font-medium text-[var(--brand)]">{message}</p>}
        </div>
      </div>
    </article>
  );
}
