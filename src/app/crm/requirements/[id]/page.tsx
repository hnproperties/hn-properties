import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { matchesForRequirement } from '@/lib/matching';
import { inr, area, shortDate } from '@/lib/format';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function RequirementDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!can(user, 'requirement.view') && !can(user, 'requirement.view.all')) redirect('/crm');

  const requirement = await prisma.requirement.findFirst({
    where: {
      id: params.id,
      ...(can(user, 'requirement.view.all') ? {} : { OR: [{ assignedToId: user.id }, { client: { assignedToId: user.id } }] }),
    },
    include: {
      client: true,
      categories: { include: { category: true } },
      locations: { include: { location: true } },
      leads: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!requirement) notFound();

  const matches = await matchesForRequirement(params.id, 20);
  const listings = matches.length
    ? await prisma.listing.findMany({
        where: { id: { in: matches.map((m) => m.listingId) } },
        include: {
          property: {
            select: {
              title: true, bedrooms: true, builtUpArea: true, plotArea: true, areaUnit: true,
              category: { select: { name: true } }, location: { select: { name: true } },
            },
          },
        },
      })
    : [];
  const byId = new Map(listings.map((l) => [l.id, l]));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-xs text-[var(--muted)]">{requirement.code}</p>
          <h1 className="display mt-1 text-2xl">{requirement.client.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {label(requirement.listingType)} · {label(requirement.status)} · {requirement.client.code}
            {can(user, 'client.view') && requirement.client.phone && (
              <span className="mono"> · {requirement.client.phone}</span>
            )}
          </p>
        </div>
        <Link href="/crm/requirements" className="btn btn-ghost">All requirements</Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <section className="plate h-fit p-5">
          <h2 className="display text-lg">The brief</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ['Budget', `${inr(requirement.budgetMin as any)} – ${inr(requirement.budgetMax as any)}`],
              ['Area', requirement.areaMin || requirement.areaMax ? `${requirement.areaMin ?? '—'} – ${requirement.areaMax ?? '—'} ${requirement.areaUnit}` : '—'],
              ['Bedrooms', requirement.bedroomsMin ? `${requirement.bedroomsMin}+` : '—'],
              ['Purpose', requirement.purpose ?? '—'],
              ['Timeline', requirement.timeline ?? '—'],
              ['Property types', requirement.categories.map((c) => c.category.name).join(', ') || 'Any'],
              ['Localities', requirement.locations.map((l) => l.location.name).join(', ') || 'Anywhere'],
            ].map(([key, value]) => (
              <div key={key as string} className="flex justify-between gap-4 border-b pb-1.5">
                <dt className="text-[var(--muted)]">{key}</dt>
                <dd className="text-right font-medium">{value as string}</dd>
              </div>
            ))}
          </dl>
          {requirement.notes && <p className="mt-3 whitespace-pre-line text-sm">{requirement.notes}</p>}
          <p className="mt-4 text-xs text-[var(--muted)]">Created {shortDate(requirement.createdAt)}</p>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="display text-lg">Matching properties</h2>
            <span className="mono text-sm">{matches.length} matches</span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Scored on budget, locality, area and configuration. Weights are set in Settings.
          </p>

          <ul className="mt-4 space-y-2">
            {matches.length === 0 && (
              <li className="plate p-8 text-center text-sm text-[var(--muted)]">
                Nothing in inventory fits this brief yet. It will appear here as soon as something does.
              </li>
            )}
            {matches.map((match) => {
              const listing = byId.get(match.listingId);
              if (!listing) return null;
              const size = listing.property.builtUpArea ?? listing.property.plotArea;
              return (
                <li key={match.listingId} className="plate flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{listing.publicTitle}</p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      <span className="mono text-xs">{listing.publicId}</span>
                      {' · '}{listing.property.location?.name}
                      {' · '}{listing.property.category?.name}
                      {size ? ` · ${area(size as any, listing.property.areaUnit)}` : ''}
                      {listing.property.bedrooms ? ` · ${listing.property.bedrooms} BHK` : ''}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{match.reasons.join(' · ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="display text-lg">{inr(listing.price as any)}</p>
                    <span className="badge badge-verified mt-1">{match.score}% match</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
