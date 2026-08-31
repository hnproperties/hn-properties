'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Accept or decline an owner's request.
 *
 * Accepting is the action that actually changes the website — it sets the listing
 * to SOLD or RENTED, and the public queries only ever show PUBLISHED, so the
 * listing drops off the site as a consequence rather than through a separate step.
 * The confirmation says so plainly, because "accept" on its own does not convey
 * that something goes live-facing.
 */
export default function OwnerRequestActions({
  requestId,
  requested,
  hasListing,
}: {
  requestId: string;
  requested: string;
  hasListing: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wording = requested === 'RENTED' ? 'rented out' : 'sold';

  async function resolve(state: 'ACCEPTED' | 'DECLINED') {
    if (
      state === 'ACCEPTED' &&
      !confirm(`Mark this property as ${wording}? It will be taken off the website immediately.`)
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    const response = await fetch(`/api/crm/owner-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });

    setBusy(false);
    if (response.ok) {
      router.refresh();
    } else {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Could not update that. Please try again.');
    }
  }

  return (
    <div className="mt-5 border-t pt-4">
      {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary py-2 text-sm" disabled={busy} onClick={() => resolve('ACCEPTED')}>
          {busy ? 'Working…' : `Confirm ${wording}`}
        </button>
        <button type="button" className="btn btn-ghost py-2 text-sm" disabled={busy} onClick={() => resolve('DECLINED')}>
          Not sold — dismiss
        </button>
      </div>
      {!hasListing && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          This property has no listing yet, so confirming only records the request.
        </p>
      )}
    </div>
  );
}
