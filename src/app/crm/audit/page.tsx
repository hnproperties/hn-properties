'use client';

import { useEffect, useState } from 'react';
import { dateTime } from '@/lib/format';

export default function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setState('loading');
    const params = new URLSearchParams({ page: String(page), perPage: '50' });
    if (action) params.set('action', action);
    fetch(`/api/audit?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((payload) => {
        setRows(payload.data.rows);
        setTotal(payload.data.total);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [page, action]);

  return (
    <div>
      <h1 className="display text-2xl">Audit log</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Append-only. Sign-ins, record changes, price and status changes, document access, permission changes and exports.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="w-[240px]">
          <label className="label" htmlFor="action">Filter by action</label>
          <input
            id="action"
            className="field"
            placeholder="e.g. document.accessed"
            defaultValue={action}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setAction((e.target as HTMLInputElement).value);
              }
            }}
          />
        </div>
        <p className="mono pb-2 text-xs text-[var(--muted)]">{total} entries</p>
      </div>

      <div className="plate mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b">
              {['When', 'Who', 'Action', 'Record', 'Detail'].map((head) => (
                <th key={head} className="table-head px-4 py-2.5 text-left font-normal">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">Loading…</td></tr>}
            {state === 'error' && <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--danger)]">Your role cannot read the audit log.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-xs">{dateTime(row.createdAt)}</td>
                <td className="px-4 py-2">{row.user?.name ?? 'System'}</td>
                <td className="px-4 py-2"><span className="mono text-xs">{row.action}</span></td>
                <td className="px-4 py-2"><span className="mono text-xs">{row.entityCode ?? row.entityType ?? '—'}</span></td>
                <td className="px-4 py-2 text-[var(--muted)]">{row.summary ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span className="mono text-xs text-[var(--muted)]">Page {page}</span>
        <button type="button" className="btn btn-ghost" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
