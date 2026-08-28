'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import ScheduleActions from '@/components/crm/ScheduleActions';
import { dateTime } from '@/lib/format';

export default function FollowUpsPage() {
  return (
    <ResourceManager
      resource="follow-ups"
      permission="lead"
      title="Follow-ups"
      description="Everything you owe someone a call about. Overdue items also appear on your desk."
      columns={[
        { key: 'dueAt', label: 'Due', type: 'datetime' },
        { key: 'listing.publicId', label: 'Property', type: 'mono' },
        { key: 'lead.name', label: 'Lead' },
        { key: 'client.name', label: 'Client' },
        { key: 'owner.name', label: 'Owner' },
        { key: 'note', label: 'Note' },
        { key: 'assignedTo.name', label: 'Assigned to' },
      ]}
      filters={[{ name: 'isDone', label: 'State', options: [{ value: 'false', label: 'Open' }, { value: 'true', label: 'Done' }] }]}
      fields={[
        { name: 'dueAt', label: 'Due at', type: 'datetime', required: true, half: true },
        {
          name: 'listingId',
          label: 'Property',
          type: 'search',
          lookup: 'listings',
          half: true,
          hint: 'Type a code like HNP-S-JBP-000023',
          // Picking the property fills in its owner, so there is no need to search
          // for someone the property already knows about.
          autofill: { ownerId: 'ownerId' },
        },
        { name: 'assignedToId', label: 'Assigned to', type: 'lookup', lookup: 'users', half: true },
        // Searchable: these lists grow past the point where scrolling a dropdown
        // is workable, and staff usually know a name or code to type.
        { name: 'leadId', label: 'Lead', type: 'search', lookup: 'leads', half: true, hint: 'Type a lead name or phone' },
        { name: 'clientId', label: 'Client', type: 'search', lookup: 'clients', half: true, hint: 'Type a client name' },
        { name: 'ownerId', label: 'Owner', type: 'search', lookup: 'owners', half: true, hint: 'Type an owner name' },
        { name: 'isDone', label: 'Completed', type: 'checkbox', hint: 'Mark as done', half: true },
        { name: 'note', label: 'Note' },
      ]}
      rowActions={(row) => {
        const who = row.lead?.name ?? row.client?.name ?? row.owner?.name ?? 'the contact';
        const property = row.listing?.publicId ? `${row.listing.publicId} — ${row.listing.publicTitle}` : null;
        const when = row.dueAt ? dateTime(row.dueAt) : 'the agreed time';
        return (
          <span className="mr-3 inline-flex align-middle">
            <ScheduleActions
              title={property ? `Follow up — ${row.listing.publicId}` : `Follow up with ${who}`}
              at={row.dueAt}
              phone={row.assignedTo?.phone}
              details={row.note ?? undefined}
              message={
                `Follow-up reminder\n\nPlease call ${who} by ${when}.` +
                (property ? `\n\nProperty: ${property}` : '') +
                (row.note ? `\n\nNote: ${row.note}` : '') +
                `\n\n— HN Properties`
              }
            />
          </span>
        );
      }}
      emptyMessage="No follow-ups scheduled."
    />
  );
}
