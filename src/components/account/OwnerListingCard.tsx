'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * One of an owner's properties, with the way to tell us it is no longer available.
 *
 * The two buttons raise a request; they do not change the listing. That is
 * deliberate and worth being plain about in the interface too, because an owner who
 * taps "Mark as sold" and sees nothing change on the website would reasonably think
 * it failed. So the card says what will happen: we confirm with them first, then
 * take it down.
 */

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'With us',
  SUBMITTED: 'Received',
  UNDER_VERIFICATION: 'Being checked',
  VERIFIED: 'Verified',
  PUBLISHED: 'Live on the website',
  ON_HOLD: 'On hold',
  SOLD: 'Sold',
  RENTED: 'Rented out',
  EXPIRED: 'Expired',
  REJECTED: 'Not listed',
  OFF_MARKET: 'Off the market',
  COMING_SOON: 'Coming soon',
};

export default function OwnerListingCard({
  propertyId,
  code,
  title,
  where,
  category,
  submitted,
  status,
  intent,
  price,
  publicHref,
  pendingRequest,
}: {
  propertyId: string;
  code: string;
  title: string;
  where: string;
  category: string | null;
  submitted: string;
  status: string;
  intent: string | null;
  price: string | null;
  publicHref: string | null;
  pendingRequest: { requested: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(!!pendingRequest);

  // A property let out is "rented out"; one on the market to buy is "sold". The
  // wording follows what the owner listed it for, not our internal vocabulary.
  const isRental = intent === 'RENT' || intent === 'LEASE';
  const action = isRental ? 'Rented out' : 'Sold';
  const closed = status === 'SOLD' || status === 'RENTED';

  async function request() {
    if (!confirm(`Tell HN Properties this property is ${action.toLowerCase()}? We will call you to confirm before removing it from the website.`)) return;
    setBusy(true);
    setError(null);

    const response = await fetch('/api/account/status-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, requested: isRental ? 'RENTED' : 'SOLD' }),
    });

    setBusy(false);
    if (response.ok) {
      setSent(true);
      router.refresh();
    } else {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Could not send that just now. Please call us instead.');
    }
  }

  return (
    <article className="plate flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{title}</h2>
          {where && <p className="mt-0.5 text-sm text-[var(--muted)]">{where}</p>}
        </div>
        <span className="mono flex-none text-xs text-[var(--muted)]">{code}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-[var(--muted)]">Status</dt>
          <dd className="font-medium">{STATUS_LABEL[status] ?? status}</dd>
        </div>
        {price && (
          <div>
            <dt className="text-xs text-[var(--muted)]">Listed at</dt>
            <dd className="font-medium">{price}</dd>
          </div>
        )}
        {category && (
          <div>
            <dt className="text-xs text-[var(--muted)]">Type</dt>
            <dd className="font-medium">{category}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-[var(--muted)]">Submitted</dt>
          <dd className="font-medium">{submitted}</dd>
        </div>
      </dl>

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
        {publicHref && (
          <Link href={publicHref} className="btn btn-ghost py-2 text-sm">
            View on website
          </Link>
        )}

        {closed ? (
          <span className="badge">{STATUS_LABEL[status]}</span>
        ) : sent ? (
          <span className="text-sm text-[var(--muted)]">
            We have your message — we will call to confirm.
          </span>
        ) : (
          <button type="button" className="btn btn-ghost py-2 text-sm" disabled={busy} onClick={request}>
            {busy ? 'Sending…' : `Mark as ${action.toLowerCase()}`}
          </button>
        )}
      </div>
    </article>
  );
}
