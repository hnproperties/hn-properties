'use client';

import { useEffect, useState } from 'react';

const GROUPS: { title: string; note?: string; keys: [string, string, 'text' | 'number'][] }[] = [
  {
    title: 'Company',
    keys: [
      ['company.name', 'Company name', 'text'],
      ['company.tagline', 'Tagline', 'text'],
      ['company.phone', 'Phone', 'text'],
      ['company.whatsapp', 'WhatsApp', 'text'],
      ['company.email', 'Email', 'text'],
      ['company.address', 'Address', 'text'],
    ],
  },
  {
    title: 'Commission defaults',
    note: 'Used to pre-fill deals. Each deal can still be set individually.',
    keys: [
      ['commission.default.sale', 'Sale commission (%)', 'number'],
      ['commission.default.rent', 'Rental commission (% of one month)', 'number'],
    ],
  },
  {
    title: 'Listings',
    keys: [
      ['listing.default.expiryDays', 'Default expiry (days)', 'number'],
      ['listing.recheckDays', 'Availability re-check every (days)', 'number'],
    ],
  },
  {
    title: 'Matching engine',
    note: 'Weights should add up to about 100. Headroom is how far over budget a property can be and still match.',
    keys: [
      ['match.weight.budget', 'Budget weight', 'number'],
      ['match.weight.location', 'Location weight', 'number'],
      ['match.weight.area', 'Area weight', 'number'],
      ['match.weight.config', 'Configuration weight', 'number'],
      ['match.budgetHeadroomPct', 'Budget headroom (%)', 'number'],
    ],
  },
  { title: 'SEO', keys: [['seo.titleSuffix', 'Title suffix', 'text']] },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, any>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((payload) => {
        setValues(payload.data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  async function save() {
    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (response.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (state === 'loading') return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  if (state === 'error') return <p className="text-sm text-[var(--danger)]">Your role cannot change settings.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="display text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          These take effect immediately across the website and the CRM. Categories, localities and roles are managed on their own screens.
        </p>
      </header>

      {GROUPS.map((group) => (
        <section key={group.title} className="plate p-5">
          <h2 className="display text-lg">{group.title}</h2>
          {group.note && <p className="mt-1 text-xs text-[var(--muted)]">{group.note}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {group.keys.map(([key, label, type]) => (
              <div key={key}>
                <label className="label" htmlFor={key}>{label}</label>
                <input
                  id={key}
                  type={type}
                  className="field"
                  value={values[key] ?? ''}
                  onChange={(e) => setValues({ ...values, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="plate p-5">
        <h2 className="display text-lg">Verification criteria</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          What HN Verified means. Shown on the website — keep it accurate and conservative.
        </p>
        <textarea
          className="field mt-3 min-h-[120px]"
          value={(values['verify.criteria'] ?? []).join('\n')}
          onChange={(e) => setValues({ ...values, 'verify.criteria': e.target.value.split('\n').filter(Boolean) })}
        />
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save}>Save settings</button>
        {saved && <span className="text-sm text-[var(--ok)]">Saved.</span>}
      </div>
    </div>
  );
}
