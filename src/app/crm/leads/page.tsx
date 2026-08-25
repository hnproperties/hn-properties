'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { useCan } from '@/components/crm/CrmShell';
import { toOptions, LEAD_STATUSES, PRIORITIES, SOURCE_TYPES } from '@/lib/constants';

export default function LeadsPage() {
  const can = useCan();

  return (
    <div className="space-y-5">
      <ResourceManager
          resource="leads"
          permission="lead"
          title="Leads"
          columns={[
            { key: 'code', label: 'Code', type: 'mono' },
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone', type: 'mono' },
            { key: 'listing.publicId', label: 'Listing', type: 'mono' },
            { key: 'status', label: 'Status', type: 'badge' },
            { key: 'priority', label: 'Priority', type: 'badge' },
            { key: 'assignedTo.name', label: 'Assigned to' },
            { key: 'createdAt', label: 'Received', type: 'date' },
          ]}
          filters={[
            { name: 'status', label: 'Status', options: toOptions(LEAD_STATUSES) },
            { name: 'priority', label: 'Priority', options: toOptions(PRIORITIES) },
            { name: 'sourceType', label: 'Source', options: toOptions(SOURCE_TYPES) },
          ]}
          fields={[
            { name: 'name', label: 'Name', required: true, half: true },
            { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
            { name: 'whatsapp', label: 'WhatsApp', half: true },
            { name: 'email', label: 'Email', type: 'email', half: true },
            { name: 'status', label: 'Status', type: 'select', options: toOptions(LEAD_STATUSES), half: true },
            { name: 'priority', label: 'Priority', type: 'select', options: toOptions(PRIORITIES), half: true },
            { name: 'sourceType', label: 'Source', type: 'select', options: toOptions(SOURCE_TYPES), half: true },
            { name: 'sourceDetail', label: 'Source detail', half: true },
            { name: 'listingId', label: 'Interested in', type: 'lookup', lookup: 'listings', half: true },
            { name: 'clientId', label: 'Client record', type: 'lookup', lookup: 'clients', half: true },
            { name: 'requirementId', label: 'Requirement', type: 'lookup', lookup: 'requirements', half: true },
            { name: 'assignedToId', label: 'Assigned to', type: 'lookup', lookup: 'users', half: true },
            { name: 'lastContactAt', label: 'Last contacted', type: 'date', half: true },
            { name: 'lostReason', label: 'If lost, why', half: true },
            { name: 'message', label: 'Their message', type: 'textarea' },
            { name: 'notes', label: 'Internal notes', type: 'textarea' },
          ]}
          emptyMessage="No leads yet."
      />
    </div>
  );
}
