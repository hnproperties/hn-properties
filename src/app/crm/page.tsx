import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDashboard } from '@/lib/dashboard';
import Photo from '@/components/Photo';
import { prisma, plain } from '@/lib/prisma';
import { PUBLIC_LISTING_WHERE } from '@/lib/visibility';
import { inr, area, relativeDue, dateTime, shortDate, coverFirst, type MediaItem } from '@/lib/format';
import { label, LEAD_BOARD_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** Colour carries urgency: red for overdue, amber for due, blue for scheduled. */
function Stat({
  value,
  title,
  href,
  icon,
  tone = 'blue',
  alert = false,
}: {
  value: number | string;
  title: string;
  href?: string;
  icon: string;
  tone?: 'red' | 'amber' | 'blue' | 'green' | 'violet';
  /** Draws attention to something waiting on a person, not just a number. */
  alert?: boolean;
}) {
  const tones = {
    red: 'bg-[#fdeaea] text-[#c1121f]',
    amber: 'bg-[#fef6e7] text-[#a5690a]',
    blue: 'bg-[#e8f4fa] text-[#106a94]',
    green: 'bg-[#e8f6ed] text-[#16a34a]',
    violet: 'bg-[#eae7fb] text-[#4c3fb0]',
  } as const;

  const body = (
    <div
      className={`plate relative flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] ${
        alert ? 'border-[var(--danger)] bg-[#fff5f5] ring-2 ring-[var(--danger)]/25' : ''
      }`}
    >
      {alert && (
        <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--danger)]" />
        </span>
      )}
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${tones[tone]}`}>{icon}</span>
      <span>
        <span className={`display block text-2xl leading-none ${alert ? 'text-[var(--danger)]' : 'text-[var(--navy)]'}`}>{value}</span>
        <span className="mt-1 block text-sm text-[var(--muted)]">{title}</span>
        {alert && <span className="mt-0.5 block text-xs font-semibold text-[var(--danger)]">Needs your review</span>}
      </span>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export default async function DeskPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const data = plain(await getDashboard(user));

  const [liveListings, pipeline] = await Promise.all([
    prisma.listing.findMany({
      where: PUBLIC_LISTING_WHERE,
      orderBy: { publishedAt: 'desc' },
      take: 4,
      select: {
        id: true, publicId: true, publicTitle: true, price: true, listingType: true, propertyId: true,
        property: {
          select: {
            bedrooms: true, builtUpArea: true, plotArea: true, areaUnit: true,
            location: { select: { name: true } },
            media: {
              where: { isPublic: true },
              take: 1,
              select: { url: true, thumbUrl: true, isCover: true, sortOrder: true },
            },
          },
        },
      },
    }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const listings = plain(liveListings) as any[];
  const counts = Object.fromEntries(pipeline.map((row) => [row.status, row._count._all]));

  return (
    <div className="space-y-6">
      {/* Today */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon="📋" value={data.leads.followUpsToday} title="Follow-ups due" href="/crm/follow-ups" tone="amber" />
        <Stat
          icon="📞"
          value={data.leads.followUpsOverdue}
          title="Overdue follow-ups"
          href="/crm/follow-ups"
          tone={data.leads.followUpsOverdue ? 'red' : 'green'}
          alert={data.leads.followUpsOverdue > 0}
        />
        <Stat icon="📅" value={data.operations.visitsToday} title="Site visits today" href="/crm/site-visits" tone="blue" />
        <Stat icon="🎯" value={data.leads.newLeads} title="New leads" href="/crm/leads" tone="green" />
        <Stat icon="🤝" value={data.operations.activeDeals} title="Active deals" href="/crm/deals" tone="violet" />
      </section>

      {/* Quick actions */}
      <section className="plate flex flex-wrap items-center gap-2 p-3">
        <span className="px-2 font-semibold text-[var(--navy)]">Quick actions</span>
        {[
          { href: '/crm/properties/new', label: '＋ Add Property' },
          { href: '/crm/leads', label: '＋ Add Lead' },
          { href: '/crm/clients', label: '＋ Add Client' },
          { href: '/crm/site-visits', label: '📅 Schedule Visit' },
          { href: '/crm/follow-ups', label: '📞 Add Follow-up' },
          { href: '/crm/review', label: '📋 Review Queue' },
        ].map((action) => (
          <Link key={action.href} href={action.href} className="btn btn-ghost py-2 text-sm">{action.label}</Link>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Today's tasks */}
        <section className="plate p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg text-[var(--navy)]">Today&apos;s tasks</h2>
            <Link href="/crm/follow-ups" className="text-sm font-semibold text-[var(--brand)]">View all</Link>
          </div>

          <ul className="mt-4 space-y-3">
            {data.dueFollowUps.length === 0 && (
              <li className="rounded-lg bg-[var(--paper)] p-4 text-center text-sm text-[var(--muted)]">Nothing due. Enjoy it.</li>
            )}
            {data.dueFollowUps.map((followUp: any) => {
              const overdue = new Date(followUp.dueAt) < new Date();
              return (
                <li key={followUp.id} className="flex items-start gap-3">
                  <span className={`badge shrink-0 ${overdue ? 'bg-[#fdeaea] text-[#c1121f]' : 'bg-[#fef6e7] text-[#a5690a]'}`}>
                    {overdue ? 'Overdue' : 'Due'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {followUp.note ?? 'Follow up'}
                    </span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {followUp.lead?.name ?? followUp.client?.name ?? followUp.owner?.name ?? '—'}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs ${overdue ? 'font-semibold text-[var(--danger)]' : 'text-[var(--muted)]'}`}>
                    {relativeDue(followUp.dueAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Latest leads */}
        <section className="plate p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg text-[var(--navy)]">Latest leads</h2>
            <Link href="/crm/leads" className="text-sm font-semibold text-[var(--brand)]">View all</Link>
          </div>

          <ul className="mt-4 space-y-3">
            {data.latestLeads.length === 0 && (
              <li className="rounded-lg bg-[var(--paper)] p-4 text-center text-sm text-[var(--muted)]">No leads yet.</li>
            )}
            {data.latestLeads.map((lead: any) => (
              <li key={lead.id} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-semibold text-[var(--brand)]">
                  {lead.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{lead.name}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {lead.listing?.publicTitle ?? label(lead.sourceType)}
                  </span>
                </span>
                <span className={`badge shrink-0 ${
                  lead.status === 'NEW' ? 'bg-[#e8f4fa] text-[#106a94]'
                    : lead.status === 'CLOSED_LOST' ? 'bg-[#fdeaea] text-[#c1121f]'
                    : lead.status === 'CLOSED_WON' ? 'bg-[#e8f6ed] text-[#16a34a]'
                    : ''
                }`}>
                  {label(lead.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Upcoming site visits */}
        <section className="plate p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg text-[var(--navy)]">Upcoming site visits</h2>
            <Link href="/crm/site-visits" className="text-sm font-semibold text-[var(--brand)]">View all</Link>
          </div>

          <ul className="mt-4 space-y-3">
            {data.nextVisits.length === 0 && (
              <li className="rounded-lg bg-[var(--paper)] p-4 text-center text-sm text-[var(--muted)]">No visits scheduled.</li>
            )}
            {data.nextVisits.map((visit: any) => (
              <li key={visit.id} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eae7fb] text-sm">📅</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{visit.listing?.publicTitle ?? 'Site visit'}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{visit.client?.name ?? 'Visitor'}</span>
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{dateTime(visit.scheduledAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Inventory numbers */}
      <section className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Stat icon="🏷️" value={data.properties.liveSale} title="Live · sale" href="/crm/listings?status=PUBLISHED" tone="blue" />
        <Stat icon="🔑" value={data.properties.liveRent} title="Live · rent" href="/crm/listings?status=PUBLISHED" tone="green" />
        <Stat icon="⏳" value={data.properties.comingSoon} title="Coming soon" href="/crm/listings?status=COMING_SOON" tone="amber" />
        <Stat icon="🔒" value={data.properties.offMarket} title="Off-market" href="/crm/listings?status=OFF_MARKET" tone="violet" />
        <Stat
          icon="📋"
          value={data.properties.pendingVerification}
          title="Waiting for review"
          href="/crm/review"
          tone={data.properties.pendingVerification ? 'red' : 'green'}
          alert={data.properties.pendingVerification > 0}
        />
        <Stat icon="⌛" value={data.properties.expiring} title="Expiring in 14 days" href="/crm/listings" tone="amber" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        {/* Live properties */}
        <section className="plate p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg text-[var(--navy)]">Live properties</h2>
            <Link href="/crm/properties" className="text-sm font-semibold text-[var(--brand)]">View all</Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {listings.length === 0 && <p className="text-sm text-[var(--muted)]">Nothing published yet.</p>}
            {listings.map((listing) => {
              const photo = coverFirst<MediaItem>(listing.property?.media)[0];
              const size = listing.property?.builtUpArea ?? listing.property?.plotArea;
              return (
                <Link key={listing.id} href={`/crm/properties/${listing.propertyId}`} className="group block overflow-hidden rounded-xl border">
                  <div className="photo aspect-[16/10]">
                    <Photo src={photo?.thumbUrl ?? photo?.url} fallback="No photograph" />
                    <span className={`badge absolute left-2 top-2 ${listing.listingType === 'SALE' ? 'bg-[#e8f6ed] text-[#16a34a]' : 'bg-[#e8f4fa] text-[#106a94]'}`}>
                      {listing.listingType === 'SALE' ? 'For sale' : 'For rent'}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-[var(--navy)]">{listing.publicTitle}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {listing.property?.location?.name}
                      {size ? ` · ${area(size, listing.property?.areaUnit)}` : ''}
                    </p>
                    <p className="display mt-1 text-base text-[var(--navy)]">{inr(listing.price)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Pipeline */}
        <section className="plate p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-lg text-[var(--navy)]">Sales pipeline</h2>
            <Link href="/crm/leads" className="text-sm font-semibold text-[var(--brand)]">Open board</Link>
          </div>

          <ul className="mt-4 space-y-2.5">
            {LEAD_BOARD_STATUSES.map((status) => {
              const count = counts[status] ?? 0;
              const max = Math.max(1, ...LEAD_BOARD_STATUSES.map((s) => counts[s] ?? 0));
              return (
                <li key={status}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--ink-soft)]">{label(status)}</span>
                    <span className="mono text-xs text-[var(--muted)]">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[var(--paper)]">
                    <div
                      className={`h-2 rounded-full ${status === 'CLOSED_WON' ? 'bg-[#16a34a]' : 'bg-[var(--brand)]'}`}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {data.money.brokerageReceived > 0 && (
            <p className="mt-4 border-t pt-3 text-sm text-[var(--muted)]">
              Brokerage received: <span className="font-semibold text-[var(--navy)]">{inr(data.money.brokerageReceived)}</span>
            </p>
          )}
        </section>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Figures reflect what your role is allowed to see · {shortDate(new Date())}
      </p>
    </div>
  );
}
