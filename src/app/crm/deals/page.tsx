'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, DEAL_STAGES, LISTING_TYPES } from '@/lib/constants';

export default function DealsPage() {
  return (
    <ResourceManager
      resource="deals"
      permission="deal"
      title="Deals"
      description="Negotiation through to registration. Commission is visible only to roles that carry that permission."
      columns={[
        { key: 'code', label: 'Code', type: 'mono' },
        { key: 'listing.publicId', label: 'Listing', type: 'mono' },
        { key: 'buyer.name', label: 'Buyer' },
        { key: 'seller.name', label: 'Seller' },
        { key: 'askingPrice', label: 'Asking', type: 'money' },
        { key: 'agreedPrice', label: 'Agreed', type: 'money' },
        { key: 'stage', label: 'Stage', type: 'badge' },
      ]}
      filters={[
        { name: 'stage', label: 'Stage', options: toOptions(DEAL_STAGES) },
        { name: 'dealType', label: 'Type', options: toOptions(LISTING_TYPES) },
      ]}
      fields={[
        { name: 'listingId', label: 'Listing', type: 'lookup', lookup: 'listings', required: true, half: true },
        { name: 'dealType', label: 'Deal type', type: 'select', options: toOptions(LISTING_TYPES), half: true },
        { name: 'buyerId', label: 'Buyer / tenant', type: 'lookup', lookup: 'clients', half: true },
        { name: 'sellerId', label: 'Seller / landlord', type: 'lookup', lookup: 'owners', half: true },
        { name: 'leadId', label: 'Lead', type: 'lookup', lookup: 'leads', half: true },
        { name: 'agentId', label: 'Agent', type: 'lookup', lookup: 'users', half: true },
        { name: 'consultantId', label: 'Partner consultant', type: 'lookup', lookup: 'consultants', half: true },
        { name: 'stage', label: 'Stage', type: 'select', options: toOptions(DEAL_STAGES), half: true },
        { name: 'askingPrice', label: 'Asking price (₹)', type: 'number', half: true },
        { name: 'agreedPrice', label: 'Agreed price (₹)', type: 'number', half: true },
        { name: 'tokenAmount', label: 'Token (₹)', type: 'number', half: true },
        { name: 'monthlyRent', label: 'Monthly rent (₹)', type: 'number', half: true },
        { name: 'deposit', label: 'Deposit (₹)', type: 'number', half: true },
        { name: 'leaseMonths', label: 'Lease months', type: 'number', half: true },
        { name: 'lockInMonths', label: 'Lock-in months', type: 'number', half: true },
        { name: 'escalationPct', label: 'Escalation %', type: 'number', half: true },
        { name: 'agreementDate', label: 'Agreement date', type: 'date', half: true },
        { name: 'registrationDate', label: 'Registration date', type: 'date', half: true },
        { name: 'lostReason', label: 'If lost, why', half: true },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyMessage="No deals in progress."
    />
  );
}
