'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, RECORD_STATUSES, SOURCE_TYPES, CONTACT_METHODS } from '@/lib/constants';

export default function OwnersPage() {
  return (
    <ResourceManager
      resource="owners"
      permission="owner"
      title="Owners"
      description="One record per owner, however many properties they hold. Contact details appear only for roles that carry that permission."
      columns={[
        { key: 'code', label: 'Code', type: 'mono' },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone', type: 'mono' },
        { key: 'status', label: 'Status', type: 'badge' },
        { key: 'sourceType', label: 'Source', type: 'badge' },
        { key: '_count.properties', label: 'Properties' },
      ]}
      filters={[
        { name: 'status', label: 'Status', options: toOptions(RECORD_STATUSES) },
        { name: 'sourceType', label: 'Source', options: toOptions(SOURCE_TYPES) },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, half: true },
        { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
        { name: 'altPhone', label: 'Alternate number', half: true },
        { name: 'whatsapp', label: 'WhatsApp', half: true },
        { name: 'email', label: 'Email', type: 'email', half: true },
        { name: 'preferredVia', label: 'Preferred contact', type: 'select', options: toOptions(CONTACT_METHODS), half: true },
        { name: 'address', label: 'Address' },
        { name: 'sourceType', label: 'Source', type: 'select', options: toOptions(SOURCE_TYPES), half: true },
        { name: 'sourceDetail', label: 'Source detail', half: true },
        { name: 'status', label: 'Status', type: 'select', options: toOptions(RECORD_STATUSES), half: true },
        { name: 'assignedToId', label: 'Assigned to', type: 'lookup', lookup: 'users', half: true },
        { name: 'lastContactAt', label: 'Last contacted', type: 'date', half: true },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyMessage="No owners on file yet."
    />
  );
}
