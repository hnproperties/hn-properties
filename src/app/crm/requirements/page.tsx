'use client';

import Link from 'next/link';
import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, REQUIREMENT_STATUSES, LISTING_TYPES, AREA_UNITS, FACINGS } from '@/lib/constants';

export default function RequirementsPage() {
  return (
    <div className="space-y-4">
      <ResourceManager
        resource="requirements"
        permission="requirement"
        title="Requirements"
        description="What our clients are looking for. Tick “Publish on the website” to show one under Wanted, where owners can respond."
        columns={[
          { key: 'code', label: 'Code', type: 'mono' },
          { key: 'client.name', label: 'Client' },
          { key: 'listingType', label: 'For', type: 'badge' },
          { key: 'budgetMax', label: 'Budget up to', type: 'money' },
          { key: 'bedroomsMin', label: 'Beds' },
          { key: '_count.matches', label: 'Matches' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'isPublic', label: 'On website' },
        ]}
        filters={[
          { name: 'status', label: 'Status', options: toOptions(REQUIREMENT_STATUSES) },
          { name: 'listingType', label: 'For', options: toOptions(LISTING_TYPES) },
        ]}
        fields={[
          { name: 'clientId', label: 'Client', type: 'lookup', lookup: 'clients', required: true, half: true },
          { name: 'listingType', label: 'Buy or rent', type: 'select', options: toOptions(LISTING_TYPES), half: true },
          { name: 'categoryIds', label: 'Property types', type: 'multisearch', lookup: 'categories', hint: 'Type a property type' },
          { name: 'locationIds', label: 'Preferred localities', type: 'multisearch', lookup: 'locations', hint: 'Type a locality — add it if missing' },
          { name: 'budgetMin', label: 'Budget from (₹)', type: 'number', half: true },
          { name: 'budgetMax', label: 'Budget up to (₹)', type: 'number', half: true },
          { name: 'areaMin', label: 'Area from', type: 'number', half: true },
          { name: 'areaMax', label: 'Area up to', type: 'number', half: true },
          { name: 'areaUnit', label: 'Area unit', type: 'select', options: toOptions(AREA_UNITS), half: true },
          { name: 'bedroomsMin', label: 'Minimum bedrooms', type: 'number', half: true },
          { name: 'bathroomsMin', label: 'Minimum bathrooms', type: 'number', half: true },
          { name: 'facing', label: 'Preferred facing', type: 'select', options: toOptions(FACINGS), half: true },
          { name: 'purpose', label: 'Purpose', half: true },
          { name: 'timeline', label: 'Timeline', half: true },
          { name: 'status', label: 'Status', type: 'select', options: toOptions(REQUIREMENT_STATUSES), half: true },
          { name: 'assignedToId', label: 'Assigned to', type: 'lookup', lookup: 'users', half: true },
          { name: 'notes', label: 'Internal notes', type: 'textarea' },
          {
            name: 'isPublic',
            label: 'Publish on the website',
            type: 'checkbox',
            hint: 'Show under Wanted so owners can come forward',
            half: true,
          },
          {
            name: 'publicNote',
            label: 'Public note',
            type: 'textarea',
            hint: 'What visitors see. Never include the client\'s name or contact details.',
          },
        ]}
        emptyMessage="No requirements recorded yet."
      />
      <p className="text-xs text-[var(--muted)]">
        Open a requirement from <Link href="/crm/requirements" className="link-underline">the list</Link> by its code to see ranked matches.
      </p>
    </div>
  );
}
