'use client';

import Link from 'next/link';
import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, REQUIREMENT_STATUSES, LISTING_TYPES, AREA_UNITS } from '@/lib/constants';

/**
 * Property Demand is the Requirements screen filtered to the ones published on
 * the website. Same records, same table — this view exists so there is an obvious
 * place to see and manage what the public shelf is currently showing, without
 * anyone having to remember which requirements were ticked public.
 */

/**
 * A requirement can name several property types at once, so a field shows when
 * *any* chosen type calls for it — asking about bedrooms is right if the client
 * would consider a flat, even if they would also consider a plot. With nothing
 * chosen yet everything shows, so no question is hidden before the answer exists.
 */
const anyCategory = (form: Record<string, any>, lookups: Record<string, any[]>, flag: string) => {
  const ids: string[] = Array.isArray(form.categoryIds) ? form.categoryIds : [];
  if (!ids.length) return true;
  const categories = lookups.categories ?? [];
  return ids.some((id) => categories.find((c) => c.value === id)?.[flag]);
};

export default function PropertyDemandPage() {
  return (
    <div className="space-y-4">
      <ResourceManager
        resource="requirements"
        permission="requirement"
        title="🥇 Property Demand"
        description="Demand published on the website, where owners and other agents can see it and come forward. Add one here and it appears publicly — never include the client's name or number."
        fixedFilters={{ isPublic: 'true' }}
        columns={[
          { key: 'code', label: 'Code', type: 'mono' },
          { key: 'listingType', label: 'For', type: 'badge' },
          { key: 'budgetMax', label: 'Budget up to', type: 'money' },
          { key: 'bedroomsMin', label: 'Beds' },
          { key: 'publicNote', label: 'Public note' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: '_count.matches', label: 'Matches' },
        ]}
        filters={[
          { name: 'status', label: 'Status', options: toOptions(REQUIREMENT_STATUSES) },
          { name: 'listingType', label: 'For', options: toOptions(LISTING_TYPES) },
        ]}
        fields={[
          { name: 'clientId', label: 'Client', type: 'search', lookup: 'clients', required: true, half: true, allowCreate: true, hint: 'Kept private — never shown on the website' },
          { name: 'listingType', label: 'Buy or rent', type: 'select', options: toOptions(LISTING_TYPES), half: true },
          { name: 'categoryIds', label: 'Property types', type: 'multisearch', lookup: 'categories', hint: 'Type a property type' },
          { name: 'locationIds', label: 'Preferred localities', type: 'multisearch', lookup: 'locations', hint: 'Type a locality — add it if missing' },
          { name: 'budgetMin', label: 'Budget from (₹)', type: 'number', half: true },
          { name: 'budgetMax', label: 'Budget up to (₹)', type: 'number', half: true },
          { name: 'areaMin', label: 'Area from', type: 'number', half: true },
          { name: 'areaMax', label: 'Area up to', type: 'number', half: true },
          { name: 'areaUnit', label: 'Area unit', type: 'select', options: toOptions(AREA_UNITS), half: true },
          { name: 'bedroomsMin', label: 'Minimum bedrooms', type: 'number', half: true, showIf: (f, l) => anyCategory(f, l, 'hasBedrooms') },
          { name: 'purpose', label: 'Purpose', half: true, hint: 'Shown publicly, e.g. "Corporate guest house"' },
          { name: 'timeline', label: 'Timeline', half: true, hint: 'Shown publicly, e.g. "Within 3 months"' },
          { name: 'status', label: 'Status', type: 'select', options: toOptions(REQUIREMENT_STATUSES), half: true },
          { name: 'isPublic', label: 'Publish on the website', type: 'checkbox', hint: 'Untick to remove it from the public page', half: true },
          { name: 'publicNote', label: 'Public note', type: 'textarea', hint: 'What visitors read. Never include the client\'s name or contact details.' },
        ]}
        emptyMessage="Nothing published yet. Add demand here, or tick “Publish on the website” on any requirement."
      />
      <p className="text-xs text-[var(--muted)]">
        Only requirements with status OPEN, MATCHING or SHARED reach the website — a CLOSED one stays hidden even
        while ticked. Everything else lives on the{' '}
        <Link href="/crm/requirements" className="link-underline">requirements screen</Link>, and the public view is{' '}
        <Link href="/wanted" className="link-underline">Property Demand</Link>.
      </p>
    </div>
  );
}
