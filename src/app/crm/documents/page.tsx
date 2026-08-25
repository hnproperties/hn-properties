'use client';

import { useEffect, useState } from 'react';
import { dateTime } from '@/lib/format';
import { label } from '@/lib/constants';

export default function DocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/documents')
      .then((r) => r.json())
      .then((payload) => {
        setRows(payload.data?.rows ?? []);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div>
      <h1 className="display text-2xl">Documents</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Private files stored outside the website. Opening one is logged against your name — the storage path is never sent to the browser.
      </p>

      <div className="plate mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b">
              {['Property', 'Kind', 'Title', 'Uploaded by', 'When', ''].map((head) => (
                <th key={head} className="table-head px-4 py-2.5 text-left font-normal">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">Loading…</td></tr>}
            {state === 'error' && <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--danger)]">You do not have access to documents.</td></tr>}
            {state === 'ready' && !rows.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">No documents uploaded yet.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-4 py-2.5"><span className="mono text-xs">{row.property?.code}</span></td>
                <td className="px-4 py-2.5"><span className="badge">{label(row.kind)}</span></td>
                <td className="px-4 py-2.5">{row.title}</td>
                <td className="px-4 py-2.5">{row.uploadedBy?.name ?? '—'}</td>
                <td className="px-4 py-2.5">{dateTime(row.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <a href={`/api/documents/${row.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--brand)] hover:underline">
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
