import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma, plain } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import ReviewCard from '@/components/crm/ReviewCard';
import { mapHref, mapEmbed } from '@/lib/geo';

export const dynamic = 'force-dynamic';

/**
 * The queue for property submissions that came in from the website. Nothing an owner
 * submits reaches the public site until someone approves it here.
 */
export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!can(user, 'property.view') && !can(user, 'property.view.all')) redirect('/crm');

  const listings = await prisma.listing.findMany({
    where: { status: { in: ['SUBMITTED', 'UNDER_VERIFICATION', 'DRAFT'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      property: {
        include: {
          category: { select: { name: true } },
          location: { select: { name: true } },
          owner: { select: { name: true, phone: true, email: true } },
          media: { orderBy: { sortOrder: 'asc' } },
          verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  const rows = plain(listings) as any[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl">Review queue</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Properties submitted through the website, waiting on you. Check the details, run the
            verification checklist if you have visited, then publish or reject.
          </p>
        </div>
        <Link href="/crm/listings" className="btn btn-ghost">All listings</Link>
      </header>

      {rows.length === 0 && (
        <div className="plate p-12 text-center">
          <p className="display text-lg">Nothing waiting for review</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Submissions from the Sell and Give on Rent forms land here automatically.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {rows.map((listing) => (
          <ReviewCard
            key={listing.id}
            listing={listing}
            canPublish={can(user, 'property.publish')}
            canVerify={can(user, 'property.verify')}
            canSeeOwner={can(user, 'owner.contact.view')}
            canSeeAddress={can(user, 'property.address.view')}
            mapUrl={mapHref(listing.property ?? {})}
            mapEmbedUrl={mapEmbed(listing.property ?? {})}
          />
        ))}
      </div>
    </div>
  );
}
