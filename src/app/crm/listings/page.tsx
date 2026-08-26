'use client';

import Link from 'next/link';
import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, LISTING_STATUSES, VISIBILITIES, LISTING_TYPES } from '@/lib/constants';

export default function ListingsPage() {
  return (
    <div className="space-y-4">
      <ResourceManager
        resource="listings"
        permission="property"
        title="Listings"
        description="What the market sees. Search by public ID (HNP-S-JBP-000004) or title. Tick rows to delete several at once."
        columns={[
          { key: 'publicId', label: 'Public ID', type: 'mono' },
          { key: 'publicTitle', label: 'Title' },
          { key: 'listingType', label: 'For', type: 'badge' },
          { key: 'price', label: 'Price', type: 'money' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'visibility', label: 'Visibility', type: 'badge' },
          { key: 'isHotDeal', label: '🔥', type: 'bool' },
          { key: '_count.leads', label: 'Leads' },
          { key: 'viewCount', label: 'Views' },
        ]}
        filters={[
          { name: 'status', label: 'Status', options: toOptions(LISTING_STATUSES) },
          { name: 'visibility', label: 'Visibility', options: toOptions(VISIBILITIES) },
          { name: 'listingType', label: 'For', options: toOptions(LISTING_TYPES) },
          { name: 'isHotDeal', label: 'Hot deal', options: [{ value: 'true', label: '🔥 Hot deals only' }] },
        ]}
        fields={[
          { name: 'propertyId', label: 'Property', type: 'lookup', lookup: 'properties', required: true, half: true },
          { name: 'listingType', label: 'Sale or rent', type: 'select', options: toOptions(LISTING_TYPES), required: true, half: true },
          { name: 'publicTitle', label: 'Public title', required: true },
          { name: 'publicDescription', label: 'Public description', type: 'textarea' },
          { name: 'publicLocationId', label: 'Public locality', type: 'lookup', lookup: 'locations', half: true, hint: 'Shown publicly instead of the exact locality if you prefer' },
          { name: 'price', label: 'Price / monthly rent (₹)', type: 'number', half: true },
          { name: 'isPriceOnRequest', label: 'Price on request', type: 'checkbox', hint: 'Hide the figure publicly', half: true },
          { name: 'isNegotiable', label: 'Negotiable', type: 'checkbox', hint: 'Show as negotiable', half: true },
          { name: 'securityDeposit', label: 'Security deposit (₹)', type: 'number', half: true },
          { name: 'maintenance', label: 'Maintenance (₹)', type: 'number', half: true },
          { name: 'leaseMonths', label: 'Lease months', type: 'number', half: true },
          { name: 'lockInMonths', label: 'Lock-in months', type: 'number', half: true },
          { name: 'escalationPct', label: 'Escalation %', type: 'number', half: true },
          { name: 'status', label: 'Status', type: 'select', options: toOptions(LISTING_STATUSES), half: true },
          { name: 'visibility', label: 'Visibility', type: 'select', options: toOptions(VISIBILITIES), half: true },
          { name: 'isFeatured', label: 'Featured', type: 'checkbox', hint: 'Show on the home page', half: true },
          { name: 'isHotDeal', label: '🔥 Hot Deal', type: 'checkbox', hint: 'Show on the Hot Deals page with a badge', half: true },
          { name: 'hotDealNote', label: 'Hot deal pitch', hint: 'One short line, e.g. "Below circle rate — owner relocating"', half: true },
          { name: 'hotDealUntil', label: 'Hot deal ends on', type: 'date', hint: 'Optional — it drops off the shelf by itself', half: true },
          { name: 'assignedToId', label: 'Assigned to', type: 'lookup', lookup: 'users', half: true },
          { name: 'expiresAt', label: 'Expires on', type: 'date', half: true },
          { name: 'nextCheckAt', label: 'Next availability check', type: 'date', half: true },
          { name: 'seoTitle', label: 'SEO title', half: true },
          { name: 'seoDescription', label: 'SEO description', half: true },
        ]}
        emptyMessage="No listings yet. Add a property first, then list it."
      />
      <p className="text-xs text-[var(--muted)]">
        Owner submissions arrive with a PENDING id and are decided in the{' '}
        <Link href="/crm/review" className="link-underline">review queue</Link>, where publishing mints the permanent
        public ID. Publishing and verification are gated permissions — the server rejects those statuses from a role
        that lacks them, whatever this form allows.
      </p>
    </div>
  );
}
