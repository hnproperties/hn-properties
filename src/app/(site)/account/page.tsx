import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { currentOwner } from '@/lib/owner-session';
import { inr, shortDate } from '@/lib/format';
import OwnerListingCard from '@/components/account/OwnerListingCard';
import AccountHeader from '@/components/account/AccountHeader';
import NotificationsToggle from '@/components/NotificationsToggle';

export const metadata: Metadata = {
  title: 'Your listed properties',
  robots: { index: false, follow: false },
};

// Always fresh: an owner who just submitted expects to see it here immediately.
export const dynamic = 'force-dynamic';

/**
 * What an owner sees after signing in.
 *
 * Shows only the properties belonging to the owner record their account is linked
 * to — the scoping is in the query itself rather than filtered afterwards, so there
 * is no path where another owner's property could reach the page.
 *
 * Note what is deliberately absent: no internal notes, no assigned agent, no
 * minimum price, no owner expectation, no lead or enquiry data. An owner sees their
 * own listing as the public sees it, plus its progress with us. Everything the desk
 * records about a property stays on the desk.
 */
export default async function AccountPage() {
  const account = await currentOwner();
  if (!account) redirect('/sign-in?next=/account');

  const properties = account.ownerId
    ? await prisma.property.findMany({
        where: { ownerId: account.ownerId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          title: true,
          colony: true,
          createdAt: true,
          isArchived: true,
          category: { select: { name: true } },
          location: { select: { name: true } },
          listings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true, listingType: true, price: true, publicId: true, slug: true },
          },
          statusRequests: {
            where: { state: 'PENDING' },
            select: { id: true, requested: true, createdAt: true },
            take: 1,
          },
        },
      })
    : [];

  return (
    <div className="wrap py-10">
      <AccountHeader name={account.name} email={account.email} photoUrl={account.photoUrl} />

      <div className="mt-4">
        <NotificationsToggle audience="OWNER" />
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl">Your listed properties</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {properties.length
              ? 'Tell us when one is sold or rented out and we will confirm it with you before taking it off the site.'
              : 'Properties you list with us will appear here.'}
          </p>
        </div>
        <Link href="/post" className="btn btn-primary">
          Post another property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="plate mt-6 p-10 text-center">
          <p className="text-[var(--muted)]">You have not listed a property with us yet.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/sell" className="btn btn-primary">Sell a property</Link>
            <Link href="/give-on-rent" className="btn btn-ghost">Give on rent</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {properties.map((property) => {
            const listing = property.listings[0] ?? null;
            const pending = property.statusRequests[0] ?? null;
            return (
              <OwnerListingCard
                key={property.id}
                propertyId={property.id}
                code={property.code}
                title={property.title}
                where={[property.colony, property.location?.name].filter(Boolean).join(', ')}
                category={property.category?.name ?? null}
                submitted={shortDate(property.createdAt)}
                status={listing?.status ?? 'DRAFT'}
                intent={listing?.listingType ?? null}
                price={listing?.price ? inr(Number(listing.price)) : null}
                publicHref={
                  listing && listing.status === 'PUBLISHED' ? `/property/${listing.slug ?? listing.publicId}` : null
                }
                pendingRequest={pending ? { requested: pending.requested } : null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
