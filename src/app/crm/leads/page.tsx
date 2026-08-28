'use client';

import ResourceManager from '@/components/crm/ResourceManager';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCan } from '@/components/crm/CrmShell';
import Link from 'next/link';
import { openWhatsApp } from '@/components/crm/ScheduleActions';
import { toOptions, LEAD_STATUSES, PRIORITIES, SOURCE_TYPES } from '@/lib/constants';

export default function LeadsPage() {
  const can = useCan();

  const router = useRouter();

  // Opening this screen counts as having seen the new leads, so the desk tile and
  // the sidebar badge clear. router.refresh() re-runs the server components that
  // hold those counts, so the badge goes immediately rather than waiting for the
  // next poll. If the call fails the badge simply stays lit — the safe direction.
  useEffect(() => {
    fetch('/api/leads/mark-viewed', { method: 'POST' })
      .then(() => {
        router.refresh();
        window.dispatchEvent(new Event('crm:recount'));
      })
      .catch(() => {});
  }, [router]);

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
            { key: 'listing.publicId', label: 'Listing', type: 'property' },
            { key: 'status', label: 'Status', type: 'badge' },
            { key: 'priority', label: 'Priority', type: 'badge' },
            { key: 'assignedTo.name', label: 'Assigned to' },
            { key: 'createdAt', label: 'Received', type: 'date' },
          ]}
          rowActions={(row) => (
            <span className="mr-3 inline-flex gap-2 align-middle">
              {/* Prefilled links rather than inline forms: the follow-up and visit
                  screens already validate and save these properly, so this just
                  carries the lead across instead of duplicating those forms. */}
              <Link
                href={`/crm/follow-ups?new=1&leadId=${row.id}${row.listing?.id ? `&listingId=${row.listing.id}` : ''}`}
                className="btn btn-ghost"
              >
                + Follow-up
              </Link>
              <Link
                href={`/crm/site-visits?new=1&leadId=${row.id}${row.listing?.id ? `&listingId=${row.listing.id}` : ''}`}
                className="btn btn-ghost"
              >
                + Visit
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  openWhatsApp({
                    phone: row.whatsapp ?? row.phone,
                    message: `Hello ${row.name ?? ''}, this is HN Properties following up on your enquiry.`,
                  })
                }
              >
                💬
              </button>
            </span>
          )}
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
            { name: 'listingId', label: 'Interested in', type: 'search', lookup: 'listings', half: true, hint: 'Type a code like HNP-S-JBP-000023' },
            { name: 'clientId', label: 'Client record', type: 'search', lookup: 'clients', half: true },
            { name: 'requirementId', label: 'Requirement', type: 'search', lookup: 'requirements', half: true },
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
