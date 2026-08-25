'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, CONSULTANT_STATUSES } from '@/lib/constants';

export default function ConsultantsPage() {
  return (
    <ResourceManager
      resource="consultants"
      permission="consultant"
      title="Consultants"
      description="Partner firms we collaborate with. Only firms marked Approved can reach partner inventory."
      columns={[
        { key: 'code', label: 'Code', type: 'mono' },
        { key: 'firmName', label: 'Firm' },
        { key: 'contactName', label: 'Contact' },
        { key: 'phone', label: 'Phone', type: 'mono' },
        { key: 'city', label: 'City' },
        { key: 'status', label: 'Status', type: 'badge' },
        { key: '_count.collaborations', label: 'Requests' },
      ]}
      filters={[{ name: 'status', label: 'Status', options: toOptions(CONSULTANT_STATUSES) }]}
      fields={[
        { name: 'firmName', label: 'Firm name', required: true, half: true },
        { name: 'contactName', label: 'Contact person', required: true, half: true },
        { name: 'phone', label: 'Phone', type: 'tel', required: true, half: true },
        { name: 'whatsapp', label: 'WhatsApp', half: true },
        { name: 'email', label: 'Email', type: 'email', half: true },
        { name: 'city', label: 'City', half: true },
        { name: 'status', label: 'Status', type: 'select', options: toOptions(CONSULTANT_STATUSES), half: true },
        { name: 'commissionPct', label: 'Agreed share %', type: 'number', half: true },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyMessage="No partner firms yet."
    />
  );
}
