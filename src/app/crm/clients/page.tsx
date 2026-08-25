'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, CLIENT_KINDS, RECORD_STATUSES, FINANCING_STATUSES, SOURCE_TYPES } from '@/lib/constants';

export default function ClientsPage() {
  return (
    <ResourceManager
      resource="clients"
      permission="client"
      title="Clients"
      description="Buyers, tenants and investors. Requirements and visit history hang off these records."
      columns={[
        { key: 'code', label: 'Code', type: 'mono' },
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone', type: 'mono' },
        { key: 'kind', label: 'Type', type: 'badge' },
        { key: 'budgetMax', label: 'Budget', type: 'money' },
        { key: '_count.requirements', label: 'Requirements' },
        { key: 'status', label: 'Status', type: 'badge' },
      ]}
      filters={[
        { name: 'kind', label: 'Type', options: toOptions(CLIENT_KINDS) },
        { name: 'status', label: 'Status', options: toOptions(RECORD_STATUSES) },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, half: true },
        { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
        { name: 'whatsapp', label: 'WhatsApp', half: true },
        { name: 'email', label: 'Email', type: 'email', half: true },
        { name: 'kind', label: 'Client type', type: 'select', options: toOptions(CLIENT_KINDS), half: true },
        { name: 'financing', label: 'Financing', type: 'select', options: toOptions(FINANCING_STATUSES), half: true },
        { name: 'budgetMin', label: 'Budget from (₹)', type: 'number', half: true },
        { name: 'budgetMax', label: 'Budget up to (₹)', type: 'number', half: true },
        { name: 'purpose', label: 'Purpose', half: true },
        { name: 'timeline', label: 'Timeline', half: true },
        { name: 'sourceType', label: 'Source', type: 'select', options: toOptions(SOURCE_TYPES), half: true },
        { name: 'assignedToId', label: 'Assigned to', type: 'lookup', lookup: 'users', half: true },
        { name: 'status', label: 'Status', type: 'select', options: toOptions(RECORD_STATUSES), half: true },
        { name: 'lastContactAt', label: 'Last contacted', type: 'date', half: true },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyMessage="No clients yet."
    />
  );
}
