import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';
import { dateTime } from '@/lib/format';
import OwnerRequestActions from '@/components/crm/OwnerRequestActions';

export const metadata: Metadata = { title: 'Owner requests' };
export const dynamic = 'force-dynamic';

/**
 * Owners telling us a property is sold or rented out.
 *
 * These arrived as notifications only, which meant they were easy to miss and
 * impossible to work through — a notification is a nudge, not a queue. This is the
 * queue: what is outstanding, who said it, and when.
 *
 * Nothing here changes the website by itself. Accepting a request sets the listing
 * status, which is what unpublishes it — the owner asked, someone confirmed by
 * phone, and a person made the change.
 */
export default async function OwnerRequestsPage() {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.edit')) throw forbidden();

  const requests = await prisma.ownerStatusRequest.findMany({
    orderBy: [{ state: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      requested: true,
      state: true,
      note: true,
      createdAt: true,
      resolvedAt: true,
      account: { select: { name: true, email: true, phone: true } },
      property: {
        select: {
          id: true,
          code: true,
          title: true,
          owner: { select: { name: true, phone: true } },
          listings: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true } },
        },
      },
    },
  });

  const pending = requests.filter((request) => request.state === 'PENDING');
  const settled = requests.filter((request) => request.state !== 'PENDING');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="display text-2xl">Owner requests</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Owners reporting a property as sold or rented out. Confirm with them by phone, then accept —
          that sets the listing status and takes it off the website.
        </p>
      </header>

      {pending.length === 0 ? (
        <div className="plate p-10 text-center text-[var(--muted)]">Nothing waiting.</div>
      ) : (
        <div className="space-y-3">
          {pending.map((request) => (
            <article key={request.id} className="plate p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    <Link href={`/crm/properties/${request.property.id}`} className="hover:underline">
                      {request.property.title}
                    </Link>
                  </p>
                  <p className="mono mt-0.5 text-xs text-[var(--muted)]">{request.property.code}</p>
                </div>
                <span className="badge">{request.requested === 'RENTED' ? 'Rented out' : 'Sold'}</span>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--muted)]">Reported by</dt>
                  <dd>{request.account.name ?? request.account.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Call</dt>
                  <dd>
                    {/* The owner record's number, which is the one we verified, rather
                        than whatever was typed into a profile. */}
                    {request.property.owner?.phone ? (
                      <a href={`tel:${request.property.owner.phone}`} className="text-[var(--brand)]">
                        {request.property.owner.phone}
                      </a>
                    ) : (
                      <span className="text-[var(--muted)]">No number on the owner record</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Reported</dt>
                  <dd>{dateTime(request.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Listing is</dt>
                  <dd>{request.property.listings[0]?.status ?? 'No listing'}</dd>
                </div>
              </dl>

              {request.note && <p className="mt-3 rounded-lg bg-[var(--paper)] p-3 text-sm">{request.note}</p>}

              <OwnerRequestActions
                requestId={request.id}
                requested={request.requested}
                hasListing={!!request.property.listings[0]}
              />
            </article>
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <section>
          <h2 className="display text-lg">Already handled</h2>
          <div className="plate mt-3 divide-y">
            {settled.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="mono text-xs text-[var(--muted)]">{request.property.code}</span>{' '}
                  {request.property.title}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {request.state === 'ACCEPTED' ? 'Accepted' : 'Declined'}
                  {request.resolvedAt ? ` · ${dateTime(request.resolvedAt)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
