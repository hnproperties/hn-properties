'use client';

import { useState } from 'react';

/**
 * Creates a client without leaving the form you are already filling in.
 *
 * A requirement cannot exist without a client, so hitting a name that is not on
 * the list used to mean abandoning the form, going to Clients, adding them, and
 * starting again. Name and mobile are all the API insists on; everything else
 * can be filled in on the Clients screen later.
 */
export default function InlineClient({
  onCreated,
}: {
  onCreated: (option: { value: string; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', email: '' });

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost mt-2" onClick={() => setOpen(true)}>
        + New client
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-[var(--line)] p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[var(--navy)]">New client</p>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Mobile</span>
          <input className="field" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">WhatsApp (optional)</span>
          <input className="field" inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Email (optional)</span>
          <input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

      <button
        type="button"
        className="btn btn-primary mt-3"
        disabled={busy || !form.name.trim() || !form.phone.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch('/api/clients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: form.name.trim(),
                phone: form.phone.trim(),
                whatsapp: form.whatsapp.trim() || undefined,
                email: form.email.trim() || undefined,
              }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error ?? 'Could not create that client');
            const made = payload.data ?? payload;
            onCreated({ value: made.id, label: `${made.name} · ${made.phone ?? ''}`.trim() });
            setOpen(false);
            setForm({ name: '', phone: '', whatsapp: '', email: '' });
          } catch (problem: any) {
            setError(problem.message ?? 'Could not create that client');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saving…' : 'Create and select'}
      </button>
    </div>
  );
}
