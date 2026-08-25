'use client';

import ResourceManager from '@/components/crm/ResourceManager';

export default function FollowUpsPage() {
  return (
    <ResourceManager
      resource="follow-ups"
      permission="lead"
      title="Follow-ups"
      description="Everything you owe someone a call about. Overdue items also appear on your desk."
      columns={[
        { key: 'dueAt', label: 'Due', type: 'datetime' },
        { key: 'lead.name', label: 'Lead' },
        { key: 'client.name', label: 'Client' },
        { key: 'owner.name', label: 'Owner' },
        { key: 'note', label: 'Note' },
        { key: 'assignedTo.name', label: 'Assigned to' },
      ]}
      filters={[{ name: 'isDone', label: 'State', options: [{ value: 'false', label: 'Open' }, { value: 'true', label: 'Done' }] }]}
      fields={[
        { name: 'dueAt', label: 'Due at', type: 'datetime', required: true, half: true },
        { name: 'assignedToId', label: 'Assigned to', type: 'lookup', lookup: 'users', half: true },
        { name: 'leadId', label: 'Lead', type: 'lookup', lookup: 'leads', half: true },
        { name: 'clientId', label: 'Client', type: 'lookup', lookup: 'clients', half: true },
        { name: 'ownerId', label: 'Owner', type: 'lookup', lookup: 'owners', half: true },
        { name: 'isDone', label: 'Completed', type: 'checkbox', hint: 'Mark as done', half: true },
        { name: 'note', label: 'Note' },
      ]}
      emptyMessage="No follow-ups scheduled."
    />
  );
}
