'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { toOptions, COLLABORATION_STATUSES } from '@/lib/constants';

export default function CollaborationsPage() {
  return (
    <ResourceManager
      resource="collaborations"
      permission="consultant"
      title="Collaborations"
      description="Requests from partner firms. Approving one shares the listing; anything beyond that must be ticked explicitly."
      columns={[
        { key: 'code', label: 'Code', type: 'mono' },
        { key: 'consultant.firmName', label: 'Firm' },
        { key: 'listing.publicId', label: 'Listing', type: 'mono' },
        { key: 'clientBrief', label: 'Brief' },
        { key: 'status', label: 'Status', type: 'badge' },
        { key: 'createdAt', label: 'Received', type: 'date' },
      ]}
      filters={[{ name: 'status', label: 'Status', options: toOptions(COLLABORATION_STATUSES) }]}
      fields={[
        { name: 'consultantId', label: 'Firm', type: 'lookup', lookup: 'consultants', required: true, half: true },
        { name: 'listingId', label: 'Listing', type: 'lookup', lookup: 'listings', half: true },
        { name: 'status', label: 'Decision', type: 'select', options: toOptions(COLLABORATION_STATUSES), half: true },
        {
          name: 'sharedFields',
          label: 'Extra fields shared with this partner',
          type: 'multiselect',
          options: [
            { value: 'ownerExpectation', label: 'Owner expectation' },
            { value: 'minimumPrice', label: 'Minimum price' },
            { value: 'addressLine', label: 'Exact address' },
            { value: 'commission', label: 'Commission terms' },
          ],
          hint: 'Nothing here reaches the partner unless you tick it.',
        },
        { name: 'clientBrief', label: 'Partner brief', type: 'textarea' },
        { name: 'responseNote', label: 'Our response', type: 'textarea' },
      ]}
      emptyMessage="No collaboration requests."
    />
  );
}
