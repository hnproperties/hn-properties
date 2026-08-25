'use client';

import { useCallback, useEffect, useState } from 'react';
import { inr, area } from '@/lib/format';
import { label } from '@/lib/constants';

/**
 * Partner portal. Everything here comes from the partner projection — a partner
 * cannot see owner details, minimum price, internal notes or the client database,
 * and the API refuses those fields regardless of what this page asks for.
 */
export default function PartnerHome() {
  const [listings, setListings] = useState<any[]>([]);
  const [collaborations, setCollaborations] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [brief, setBrief] = useState('');
  const [selected, setSelected] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    const [listingsResponse, collabResponse] = await Promise.all([
      fetch(`/api/partner/listings?${params}`),
      fetch('/api/partner/collaborations'),
    ]);
    if (!listingsResponse.ok) {
      setState('blocked');
      return;
    }
    setListings((await listingsResponse.json()).data.rows ?? []);
    if (collabResponse.ok) setCollaborations((await collabResponse.json()).data ?? []);
    setState('ready');
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function request() {
    const response = await fetch('/api/partner/collaborations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: selected || undefined, clientBrief: brief }),
    });
    const payload = await response.json();
    setSent(response.ok ? `Request ${payload.data.code} sent. We will respond shortly.` : payload.error ?? 'Could not send');
    if (response.ok) {
      setBrief('');
      setSelected('');
      await load();
    }
  }

  if (state === 'blocked') {
    return (
      <div className="plate p-8 text-center">
        <p className="display text-lg">Your firm is not approved for inventory access yet</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Once we approve your firm, shared inventory appears here. You can still send us a client brief by phone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-2xl">Shared inventory</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Properties we have opened to partner firms. Owner details, minimum prices and internal notes are never included.
            </p>
          </div>
          <input
            className="field w-[240px]"
            placeholder="Search and press Enter"
            onKeyDown={(e) => e.key === 'Enter' && setQuery((e.target as HTMLInputElement).value)}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state === 'loading' && <p className="text-sm text-[var(--muted)]">Loading…</p>}
          {state === 'ready' && !listings.length && (
            <p className="plate p-6 text-sm text-[var(--muted)] sm:col-span-2 lg:col-span-3">
              Nothing shared with your firm right now.
            </p>
          )}
          {listings.map((listing) => {
            const size = listing.property?.builtUpArea ?? listing.property?.plotArea;
            return (
              <article key={listing.id} className="plate p-4">
                <div className="flex items-baseline justify-between">
                  <span className="mono text-xs text-[var(--muted)]">{listing.publicId}</span>
                  <span className="badge">{label(listing.listingType)}</span>
                </div>
                <h2 className="display mt-2 text-base">{listing.publicTitle}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {[listing.publicLocation?.name, listing.property?.category?.name].filter(Boolean).join(' · ')}
                  {size ? ` · ${area(size, listing.property?.areaUnit)}` : ''}
                </p>
                <p className="display mt-2 text-lg">{listing.isPriceOnRequest ? 'On request' : inr(listing.price)}</p>
                <button
                  type="button"
                  className="btn btn-ghost mt-3 w-full py-1.5 text-xs"
                  onClick={() => setSelected(listing.id)}
                >
                  {selected === listing.id ? 'Selected' : 'Request collaboration'}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="plate p-5">
          <h2 className="display text-lg">Send a request</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Describe what your client needs. Do not include their personal details — we only need the brief.
          </p>
          <textarea
            className="field mt-3 min-h-[110px]"
            placeholder="e.g. Client looking for a 3BHK in Napier Town, budget up to ₹90 lakh, ready to move."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          {selected && <p className="mt-2 text-xs text-[var(--muted)]">Attached to the listing you selected above.</p>}
          <button type="button" className="btn btn-primary mt-3" onClick={request} disabled={!brief && !selected}>
            Send request
          </button>
          {sent && <p className="mt-2 text-sm">{sent}</p>}
        </div>

        <div className="plate p-5">
          <h2 className="display text-lg">Your requests</h2>
          <ul className="mt-3 divide-y text-sm">
            {!collaborations.length && <li className="py-6 text-center text-[var(--muted)]">No requests yet.</li>}
            {collaborations.map((collaboration) => (
              <li key={collaboration.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <span>
                  <span className="mono text-xs">{collaboration.code}</span>
                  {collaboration.listing && <span className="text-[var(--muted)]"> · {collaboration.listing.publicId}</span>}
                </span>
                <span className="badge">{label(collaboration.status)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
