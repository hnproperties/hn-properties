'use client';

import Link from 'next/link';
import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, LISTING_TYPES } from '@/lib/constants';

/**
 * Hot Deals is the Listings screen with the hot-deal filter applied, so there is
 * one place a listing lives and no second copy of it to keep in step. Ticking
 * "Hot Deal" here or on the Listings screen is the same edit to the same row.
 */
export default function HotDealsPage() {
  return (
    <div className="space-y-4">
      <ResourceManager
        resource="listings"
        permission="property"
        title="🔥 Hot Deals"
        description="Listings currently on the public Hot Deals page. Tick Hot Deal on any listing to add it here; add a short pitch line to explain why it is a deal."
        fixedFilters={{ isHotDeal: 'true' }}
        columns={[
          { key: 'publicId', label: 'Public ID', type: 'mono' },
          { key: 'publicTitle', label: 'Title' },
          { key: 'listingType', label: 'For', type: 'badge' },
          { key: 'price', label: 'Price', type: 'money' },
          { key: 'hotDealNote', label: 'Pitch' },
          { key: 'hotDealUntil', label: 'Ends', type: 'date' },
          { key: 'status', label: 'Status', type: 'badge' },
          { key: 'visibility', label: 'Visibility', type: 'badge' },
        ]}
        filters={[{ name: 'listingType', label: 'For', options: toOptions(LISTING_TYPES) }]}
        fields={[
          { name: 'isHotDeal', label: '🔥 Hot Deal', type: 'checkbox', hint: 'Untick to remove it from the public Hot Deals page', half: true },
          { name: 'hotDealUntil', label: 'Hot deal ends on', type: 'date', hint: 'Optional — it drops off by itself', half: true },
          { name: 'hotDealNote', label: 'Hot deal pitch', hint: 'One short line, e.g. "Below circle rate — owner relocating"' },
        ]}
        emptyMessage="No hot deals yet. Open any listing, tick Hot Deal, and it appears here and on the website."
      />
      <p className="text-xs text-[var(--muted)]">
        A listing only reaches the public page if it is also PUBLISHED and PUBLIC — ticking Hot Deal on a draft
        changes nothing outward. Check both on the{' '}
        <Link href="/crm/listings" className="link-underline">listings screen</Link>. Hot deals with an end date
        disappear from the website on their own once it passes.
      </p>
    </div>
  );
}
