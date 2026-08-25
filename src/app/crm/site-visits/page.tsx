'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, VISIT_STATUSES, INTEREST_LEVELS } from '@/lib/constants';

export default function SiteVisitsPage() {
  return (
    <ResourceManager
      resource="site-visits"
      permission="visit"
      title="Site visits"
      description="Requests from the website arrive as Requested. Confirm the time with the client and the owner before moving them on."
      columns={[
        { key: 'code', label: 'Code', type: 'mono' },
        { key: 'scheduledAt', label: 'When', type: 'datetime' },
        { key: 'listing.publicId', label: 'Listing', type: 'mono' },
        { key: 'client.name', label: 'Client' },
        { key: 'agent.name', label: 'Agent' },
        { key: 'status', label: 'Status', type: 'badge' },
        { key: 'interest', label: 'Interest', type: 'badge' },
      ]}
      filters={[{ name: 'status', label: 'Status', options: toOptions(VISIT_STATUSES) }]}
      fields={[
        { name: 'listingId', label: 'Listing', type: 'lookup', lookup: 'listings', required: true, half: true },
        { name: 'scheduledAt', label: 'Date and time', type: 'datetime', required: true, half: true },
        { name: 'clientId', label: 'Client', type: 'lookup', lookup: 'clients', half: true },
        { name: 'leadId', label: 'Lead', type: 'lookup', lookup: 'leads', half: true },
        { name: 'agentId', label: 'Agent', type: 'lookup', lookup: 'users', half: true },
        { name: 'status', label: 'Status', type: 'select', options: toOptions(VISIT_STATUSES), half: true },
        { name: 'ownerAvailable', label: 'Owner available', type: 'checkbox', hint: 'Owner will be present', half: true },
        { name: 'interest', label: 'Interest level', type: 'select', options: toOptions(INTEREST_LEVELS), half: true },
        { name: 'followUpAt', label: 'Follow up on', type: 'date', half: true },
        { name: 'feedback', label: 'Feedback after the visit', type: 'textarea' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyMessage="No site visits scheduled."
    />
  );
}
