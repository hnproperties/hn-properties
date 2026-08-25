'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { play } from '@/lib/sound';

/**
 * The everyday state changes on a listing: the deal completed, the tenant moved in,
 * or a rental has come free again.
 *
 * Nothing is deleted — sold and rented keep the record, its photographs and its
 * public ID, and simply take it off the website. Bringing a rental back is one
 * click, months later, with no re-entry.
 */
export default function ListingStatusActions({
  listingId,
  listingType,
  status,
  canPublish,
}: {
  listingId: string;
  listingType: string;
  status: string;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const live = status === 'PUBLISHED' || status === 'COMING_SOON';
  const closed = status === 'SOLD' || status === 'RENTED';

  async function apply(action: string, confirmation: string) {
    if (!confirm(confirmation)) return;
    setBusy(true);
    setMessage(null);

    const response = await fetch(`/api/listings/${listingId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      play('error');
      setMessage(payload.error ?? 'Could not change that');
      return;
    }

    play('success');
    router.refresh();
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {live && listingType === 'SALE' && (
          <button
            type="button"
            className="btn btn-ghost py-2 text-sm"
            disabled={busy}
            onClick={() => apply('sold', 'Mark this as sold? It comes off the website but stays in the CRM.')}
          >
            ✅ Mark sold
          </button>
        )}

        {live && listingType !== 'SALE' && (
          <button
            type="button"
            className="btn btn-ghost py-2 text-sm"
            disabled={busy}
            onClick={() => apply('rented', 'Mark this as rented out? It comes off the website but stays in the CRM.')}
          >
            ✅ Mark rented out
          </button>
        )}

        {live && (
          <button
            type="button"
            className="btn btn-ghost py-2 text-sm"
            disabled={busy}
            onClick={() => apply('off-market', 'Take this off the market for now?')}
          >
            Take off-market
          </button>
        )}

        {!live && canPublish && (
          <button
            type="button"
            className="btn btn-primary py-2 text-sm"
            disabled={busy}
            onClick={() => apply('available', 'Put this back on the website as available?')}
          >
            ↩︎ Available again
          </button>
        )}
      </div>

      {closed && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Off the website. The record, photographs and public ID are kept — press
          <span className="font-medium"> Available again</span> if it comes back.
        </p>
      )}

      {message && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{message}</p>}
    </div>
  );
}
