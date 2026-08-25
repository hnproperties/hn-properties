import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma, plain } from '@/lib/prisma';
import { inr } from '@/lib/format';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function Bars({ title, rows }: { title: string; rows: { key: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="plate p-5">
      <h2 className="display text-lg">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 && <li className="text-sm text-[var(--muted)]">No data yet.</li>}
        {rows.map((row) => (
          <li key={row.key} className="text-sm">
            <div className="flex justify-between">
              <span>{label(row.key)}</span>
              <span className="mono text-xs">{row.value}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-[var(--paper)]">
              <div className="h-1.5 rounded bg-[var(--brand)]" style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!can(user, 'report.view')) redirect('/crm');

  const [byStatus, byType, leadsBySource, leadsByStatus, visits, deals, commission, segments] = await Promise.all([
    prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.listing.groupBy({ by: ['listingType'], _count: { _all: true }, _avg: { price: true } }),
    prisma.lead.groupBy({ by: ['sourceType'], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.siteVisit.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.deal.groupBy({ by: ['stage'], _count: { _all: true }, _sum: { agreedPrice: true } }),
    can(user, 'deal.commission.view')
      ? prisma.commission.aggregate({ _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
    prisma.propertyCategory.findMany({ select: { segment: true, _count: { select: { properties: true } } } }),
  ]);

  const data = plain({ byStatus, byType, leadsBySource, leadsByStatus, visits, deals, commission, segments });

  const totalLeads = data.leadsByStatus.reduce((sum: number, row: any) => sum + row._count._all, 0);
  const won = data.leadsByStatus.find((row: any) => row.status === 'CLOSED_WON')?._count._all ?? 0;
  const conversion = totalLeads ? Math.round((won / totalLeads) * 100) : 0;

  const segmentTotals = data.segments.reduce((acc: Record<string, number>, row: any) => {
    acc[row.segment] = (acc[row.segment] ?? 0) + row._count.properties;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-2xl">Reports</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Aggregates only. No contact details leave this screen.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total leads', String(totalLeads)],
          ['Closed won', String(won)],
          ['Lead conversion', `${conversion}%`],
          ['Commission booked', can(user, 'deal.commission.view') ? inr(Number(data.commission._sum.amount ?? 0)) : 'Restricted'],
        ].map(([title, value]) => (
          <div key={title} className="plate p-4">
            <p className="display text-2xl">{value}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{title}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Inventory by status" rows={data.byStatus.map((r: any) => ({ key: r.status, value: r._count._all }))} />
        <Bars title="Leads by source" rows={data.leadsBySource.map((r: any) => ({ key: r.sourceType, value: r._count._all }))} />
        <Bars title="Leads by stage" rows={data.leadsByStatus.map((r: any) => ({ key: r.status, value: r._count._all }))} />
        <Bars title="Site visits" rows={data.visits.map((r: any) => ({ key: r.status, value: r._count._all }))} />
        <Bars title="Deals by stage" rows={data.deals.map((r: any) => ({ key: r.stage, value: r._count._all }))} />
        <Bars title="Properties by segment" rows={Object.entries(segmentTotals).map(([key, value]) => ({ key, value: value as number }))} />
      </div>

      <section className="plate p-5">
        <h2 className="display text-lg">Sale vs rent</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.byType.map((row: any) => (
            <li key={row.listingType} className="flex justify-between border-b pb-1.5">
              <span>{label(row.listingType)}</span>
              <span>{row._count._all} listings · average {inr(Number(row._avg.price ?? 0))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
