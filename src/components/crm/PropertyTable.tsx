'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import Photo from '../Photo';
import { inr, area } from '@/lib/format';
import { label } from '@/lib/constants';

type Row = any;

type Option = { value: string; label: string };

type Props = {
  rows: Row[];
  tabs: { key: string; label: string; count: number }[];
  tab: string;
  term: string;
  canDelete: boolean;
  canSeePrivate: boolean;
  categories?: Option[];
  locations?: Option[];
  team?: Option[];
};

/** Status colour carries the same meaning everywhere: green live, red gone, amber waiting. */
export function statusTone(status?: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-[#e8f6ed] text-[#16a34a]';
    case 'SOLD':
    case 'RENTED':
      return 'bg-[#fdeaea] text-[#c1121f]';
    case 'SUBMITTED':
    case 'UNDER_VERIFICATION':
      return 'bg-[#fef6e7] text-[#a5690a]';
    case 'COMING_SOON':
      return 'bg-[#eae7fb] text-[#4c3fb0]';
    case 'OFF_MARKET':
    case 'ON_HOLD':
    case 'ARCHIVED':
      return 'bg-[var(--paper)] text-[var(--muted)]';
    default:
      return '';
  }
}

const STATUSES = [
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_VERIFICATION', label: 'Under verification' },
  { value: 'COMING_SOON', label: 'Coming soon' },
  { value: 'OFF_MARKET', label: 'Off-market' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'RENTED', label: 'Rented' },
];

export default function PropertyTable({
  rows,
  tabs,
  tab,
  term,
  canDelete,
  canSeePrivate,
  categories = [],
  locations = [],
  team = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  function go(next: Record<string, string>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    router.push(`${pathname}?${search.toString()}`);
  }

  /** Deletes each selected property, reporting the first refusal with its reason. */
  async function removeSelected() {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} propert${selected.length > 1 ? 'ies' : 'y'}? This cannot be undone.`)) return;

    setBusy(true);
    setMessage(null);
    let failure: string | null = null;

    for (const id of selected) {
      const response = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        failure ??= payload.error ?? 'Could not delete one property';
      }
    }

    setBusy(false);
    setSelected([]);
    setMessage(failure);
    router.refresh();
  }

  const filterKeys = ['category', 'location', 'beds', 'areaMin', 'areaMax', 'priceMin', 'priceMax', 'verified', 'status', 'assigned'];
  const activeFilters = filterKeys.filter((key) => params.get(key)).length;
  const value = (key: string) => params.get(key) ?? '';

  /** Sold, rented out, or back on the market — the everyday state changes. */
  async function setStatus(listingId: string, action: string, label: string) {
    if (!confirm(`${label}? The record stays in the CRM either way.`)) return;

    setWorking(listingId);
    setMessage(null);

    const response = await fetch(`/api/listings/${listingId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    setWorking(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? 'Could not change that');
      return;
    }
    router.refresh();
  }

  /**
   * One-click hot-deal toggle straight from the inventory list. The flag lives on
   * the listing, not the property, because price and public visibility do — a
   * property with both a sale and a rent listing can be a deal on one and not the
   * other. This toggles the listing shown in this row.
   */
  async function toggleHotDeal(listingId: string, next: boolean) {
    setWorking(listingId);
    setMessage(null);

    const response = await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHotDeal: next }),
    });

    setWorking(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? 'Could not change that');
      return;
    }
    setMessage(next ? 'Added to Hot Deals' : 'Removed from Hot Deals');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => go({ tab: item.key === 'all' ? '' : item.key })}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === item.key || (tab === 'all' && item.key === 'all')
                ? 'border-[var(--brand)] text-[var(--brand)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {item.label} <span className="text-xs">({item.count})</span>
          </button>
        ))}
      </div>

      {/* Search and bulk actions */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="min-w-[260px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get('q');
            go({ q: String(value ?? '') });
          }}
        >
          <input
            name="q"
            defaultValue={term}
            className="field py-2.5"
            placeholder="Search code (HNP-S-JBP-000004), title, locality…"
          />
        </form>

        <button
          type="button"
          className={`btn py-2 text-sm ${activeFilters > 0 ? 'btn-navy' : 'btn-ghost'}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>

        {(term || activeFilters > 0) && (
          <button type="button" className="btn btn-ghost py-2 text-sm" onClick={() => router.push(pathname)}>
            Clear all
          </button>
        )}

        {selected.length > 0 && canDelete && (
          <>
            <span className="text-sm font-medium">{selected.length} selected</span>
            <button type="button" className="btn btn-ghost py-2 text-sm text-[var(--danger)]" disabled={busy} onClick={removeSelected}>
              {busy ? 'Deleting…' : 'Delete selected'}
            </button>
            <button type="button" className="btn btn-ghost py-2 text-sm" onClick={() => setSelected([])}>Clear</button>
          </>
        )}

        <p className="ml-auto text-sm text-[var(--muted)]">{rows.length} shown</p>
      </div>

      {showFilters && (
        <div className="plate grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="f-category">Property type</label>
            <select id="f-category" className="field py-2" value={value('category')} onChange={(e) => go({ category: e.target.value })}>
              <option value="">Any</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-location">Locality</label>
            <select id="f-location" className="field py-2" value={value('location')} onChange={(e) => go({ location: e.target.value })}>
              <option value="">Anywhere</option>
              {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-status">Listing status</label>
            <select id="f-status" className="field py-2" value={value('status')} onChange={(e) => go({ status: e.target.value })}>
              <option value="">Any</option>
              {STATUSES.map((s2) => <option key={s2.value} value={s2.value}>{s2.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-beds">Bedrooms</label>
            <select id="f-beds" className="field py-2" value={value('beds')} onChange={(e) => go({ beds: e.target.value })}>
              <option value="">Any</option>
              {['1', '2', '3', '4', '5'].map((n) => <option key={n} value={n}>{n}+</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-areaMin">Area from</label>
            <input
              id="f-areaMin"
              type="number"
              className="field py-2"
              placeholder="Sq.Ft"
              defaultValue={value('areaMin')}
              onBlur={(e) => go({ areaMin: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-areaMax">Area up to</label>
            <input
              id="f-areaMax"
              type="number"
              className="field py-2"
              placeholder="Sq.Ft"
              defaultValue={value('areaMax')}
              onBlur={(e) => go({ areaMax: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-priceMin">Price from (₹)</label>
            <input
              id="f-priceMin"
              type="number"
              className="field py-2"
              placeholder="e.g. 5000000"
              defaultValue={value('priceMin')}
              onBlur={(e) => go({ priceMin: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-priceMax">Price up to (₹)</label>
            <input
              id="f-priceMax"
              type="number"
              className="field py-2"
              placeholder="e.g. 15000000"
              defaultValue={value('priceMax')}
              onBlur={(e) => go({ priceMax: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-verified">Verified</label>
            <select id="f-verified" className="field py-2" value={value('verified')} onChange={(e) => go({ verified: e.target.value })}>
              <option value="">Any</option>
              <option value="true">HN Verified only</option>
              <option value="false">Not yet verified</option>
            </select>
          </div>

          {team.length > 0 && (
            <div>
              <label className="label" htmlFor="f-assigned">Assigned to</label>
              <select id="f-assigned" className="field py-2" value={value('assigned')} onChange={(e) => go({ assigned: e.target.value })}>
                <option value="">Anyone</option>
                {team.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          )}

          <p className="self-end text-xs text-[var(--muted)] lg:col-span-2">
            Price matches a listing price or the owner&apos;s expectation. Area matches built-up, carpet or plot.
          </p>
        </div>
      )}

      {message && (
        <p className="rounded-lg border border-[var(--danger)] bg-[#fdeaea] p-3 text-sm text-[var(--danger)]">{message}</p>
      )}

      {/* Table */}
      <div className="plate overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b">
              {canDelete && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className="h-4 w-4 rounded"
                    checked={rows.length > 0 && selected.length === rows.length}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                  />
                </th>
              )}
              {['Property', 'Code', 'Type', 'Locality', 'Area', 'Price', 'Assigned to', 'Verified', ''].map((head) => (
                <th key={head} className="table-head px-4 py-3 text-left font-semibold">{head}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 10 : 9} className="px-4 py-12 text-center text-[var(--muted)]">
                  {term ? `Nothing matches “${term}”.` : 'No properties yet.'}
                </td>
              </tr>
            )}

            {rows.map((row) => {
              const photo = row.media?.[0];
              const size = row.builtUpArea ?? row.plotArea ?? row.carpetArea;
              const listing = row.listings?.[0];
              const price = listing?.price ?? (canSeePrivate ? row.ownerExpectation : null);

              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b last:border-0 transition hover:bg-[var(--paper)] ${
                    selected.includes(row.id) ? 'bg-[var(--brand-soft)]' : ''
                  }`}
                  onClick={() => router.push(`/crm/properties/${row.id}`)}
                >
                  {canDelete && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.code}`}
                        className="h-4 w-4 rounded"
                        checked={selected.includes(row.id)}
                        onChange={(e) =>
                          setSelected((current) => (e.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))
                        }
                      />
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="photo h-12 w-16 shrink-0 rounded-lg">
                        <Photo src={photo?.thumbUrl ?? photo?.url} fallback="No photo" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[var(--navy)]">{row.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {listing ? (
                            <>
                              <span className="mono text-[11px] text-[var(--muted)]">{listing.publicId}</span>
                              <span className={`badge ${statusTone(listing.status)}`}>{label(listing.status)}</span>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">Not listed</span>
                          )}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3"><span className="mono text-xs">{row.code}</span></td>
                  <td className="px-4 py-3">{row.category?.name ?? '—'}</td>
                  <td className="px-4 py-3">{row.location?.name ?? '—'}</td>
                  <td className="px-4 py-3">{size ? area(size, row.areaUnit) : '—'}</td>
                  <td className="px-4 py-3 font-semibold">{price ? inr(price) : '—'}</td>
                  <td className="px-4 py-3">{row.assignedTo?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {row.isVerified
                      ? <span className="badge badge-verified">✓ Verified</span>
                      : <span className="badge">Not yet</span>}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {listing && (
                        <button
                          type="button"
                          aria-pressed={!!listing.isHotDeal}
                          title={listing.isHotDeal ? 'Remove from Hot Deals' : 'Mark as a Hot Deal'}
                          disabled={working === listing.id}
                          onClick={() => toggleHotDeal(listing.id, !listing.isHotDeal)}
                          className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            listing.isHotDeal
                              ? 'border-[#e8590c] bg-[#fff4e6] text-[#c2410c]'
                              : 'border-[var(--line)] text-[var(--muted)] hover:border-[#e8590c] hover:text-[#c2410c]'
                          }`}
                        >
                          🔥
                        </button>
                      )}

                      {listing && (
                        <select
                          aria-label="Change status"
                          className="field w-[150px] py-1.5 text-xs"
                          value=""
                          disabled={working === listing.id}
                          onChange={(e) => {
                            const action = e.target.value;
                            if (!action) return;
                            const labels: Record<string, string> = {
                              sold: 'Mark as sold',
                              rented: 'Mark as rented out',
                              'off-market': 'Take off-market',
                              hold: 'Put on hold',
                              available: 'Put back on the market',
                            };
                            setStatus(listing.id, action, labels[action]);
                            e.target.value = '';
                          }}
                        >
                          <option value="">Mark as…</option>
                          {listing.listingType === 'SALE'
                            ? <option value="sold">Sold</option>
                            : <option value="rented">Rented out</option>}
                          <option value="off-market">Off-market</option>
                          <option value="hold">On hold</option>
                          <option value="available">Available again</option>
                        </select>
                      )}

                      <Link
                        href={`/crm/properties/${row.id}`}
                        className="text-sm font-semibold text-[var(--brand)] hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
