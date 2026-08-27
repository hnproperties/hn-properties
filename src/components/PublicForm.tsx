'use client';

import { useRef, useState } from 'react';
import Combobox from './Combobox';
import LocationPicker from './LocationPicker';
import { inrFull } from '@/lib/format';
import { play } from '@/lib/sound';

/** Indian money units. The form stores plain rupees; this is only how it is entered. */
const MONEY_UNITS = [
  { value: '1000', label: 'Thousand' },
  { value: '100000', label: 'Lakh' },
  { value: '10000000', label: 'Crore' },
];

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'tel' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'photos' | 'combobox' | 'money' | 'location';
  /** Starting unit for a money field: '1000', '100000' or '10000000'. */
  moneyUnit?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  half?: boolean;
  /** Starts a new titled section above this field. */
  section?: string;
  /**
   * Show this field only when another field holds one of these values — bedrooms
   * make no sense on a plot, so they simply do not appear. Declared as data rather
   * than a function, because this config is built on the server.
   */
  visibleFor?: string[];
  visibleWhen?: string;
};

type Props = {
  endpoint: string;
  fields: Field[];
  hidden?: Record<string, string | undefined>;
  submitLabel: string;
  successTitle: string;
  successBody: string;
};

/** Photo picker for public forms. Uploads go to the rate-limited public endpoint. */
function PhotoField({ urls, onChange }: { urls: string[]; onChange: (next: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: string[] = [];

    for (const file of Array.from(files).slice(0, 15)) {
      try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/public/uploads', { method: 'POST', body });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Upload failed');
        added.push(payload.data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    if (added.length) onChange([...urls, ...added].slice(0, 15));
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  return (
    <div>
      <div
        className="rounded-2xl border border-dashed p-6 text-center transition hover:border-[var(--brand)]"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          upload(event.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(event) => upload(event.target.files)}
        />
        {/*
          A second input carrying `capture`, rather than adding the attribute to
          the one above: `capture` forces the camera and removes the choice of
          picking an existing photo, so the two need separate buttons. The camera
          button only shows on small screens, since desktop browsers ignore
          `capture` and would just open the same file dialog twice.
        */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => upload(event.target.files)}
        />
        <p className="text-[var(--muted)]">{busy ? 'Uploading…' : 'Drag photographs here, or'}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
            Choose photographs
          </button>
          <button
            type="button"
            className="btn btn-ghost sm:hidden"
            disabled={busy}
            onClick={() => cameraInput.current?.click()}
          >
            📷 Take a photo
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Up to 15 photographs, 8 MB each. Good photographs do more for a property than anything else on this form.
        </p>
      </div>

      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

      {urls.length > 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {urls.map((url, index) => (
            <li key={url} className="group relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photograph ${index + 1}`} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white transition sm:opacity-0 sm:group-hover:opacity-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One form component behind every public submission: enquiry, site visit, owner
 * submission, requirement, contact. Includes the honeypot the API expects.
 */
export default function PublicForm({ endpoint, fields, hidden, submitLabel, successTitle, successBody }: Props) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reference, setReference] = useState<string | null>(null);
  // Money fields are entered as an amount plus a unit; the form submits plain rupees.
  const [money, setMoney] = useState<Record<string, { amount: string; unit: string }>>({});

  const set = (name: string, value: any) => {
    setValues((v) => ({ ...v, [name]: value }));
    // Clear a field's error as soon as the person edits it.
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...hidden, ...values }),
      });
      const payload = await response.json();
      if (!response.ok) {
        // The API returns which fields failed; show them where they are, not just a banner.
        if (payload.details && typeof payload.details === 'object') {
          setFieldErrors(payload.details);
          const first = Object.keys(payload.details)[0];
          const element = document.getElementById(`f-${first}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element?.focus({ preventScroll: true });
        }
        play('error');
        throw new Error(payload.error ?? 'Something went wrong');
      }
      setReference(payload.data?.reference ?? null);
      setState('done');
      play('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="glass-card animate-rise p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ok-soft)] text-2xl text-[var(--ok)]">✓</div>
        <p className="display mt-4 text-2xl text-[var(--navy)]">{successTitle}</p>
        <p className="mt-2 text-[var(--muted)]">{successBody}</p>
        {reference && <p className="mono mt-4 text-sm">Reference: {reference}</p>}
      </div>
    );
  }

  /*
   * Group the fields by section before rendering. Putting a heading inside the
   * two-column grid pushed every following field out of alignment, which is what
   * made the form look scattered — each section gets its own grid instead.
   */
  const isVisible = (field: Field) => {
    if (!field.visibleFor) return true;
    const against = values[field.visibleWhen ?? 'categorySlug'];
    return !!against && field.visibleFor.includes(String(against));
  };

  const groups: { title?: string; items: Field[] }[] = [];
  for (const field of fields) {
    if (field.section || groups.length === 0) groups.push({ title: field.section, items: [] });
    groups[groups.length - 1].items.push(field);
  }
  // Drop any section left with nothing to show for the chosen property type.
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter(isVisible) }))
    .filter((group) => group.items.length > 0);

  function renderField(field: Field) {
    const value = values[field.name] ?? '';
    const set_ = (next: any) => set(field.name, next);
    const fieldError = fieldErrors[field.name]?.[0];
    const inputClass = `field${fieldError ? ' border-[var(--danger)] ring-2 ring-[var(--danger)]/20' : ''}`;

    return (
      <div key={field.name} className={field.half ? '' : 'sm:col-span-2'}>
        {field.type !== 'location' && (
          <label className="label" htmlFor={`f-${field.name}`}>
            {field.label}
            {field.required && <span className="text-[var(--danger)]"> *</span>}
          </label>
        )}

        {field.type === 'location' ? (
          <LocationPicker
            value={value}
            onChange={set_}
            label={field.label}
            localities={fields.find((f) => f.type === 'combobox')?.options ?? []}
          />
        ) : field.type === 'photos' ? (
          <PhotoField urls={values[field.name] ?? []} onChange={set_} />
        ) : field.type === 'textarea' ? (
          <textarea
            id={`f-${field.name}`}
            className={`${inputClass} min-h-[110px]`}
            required={field.required}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => set_(e.target.value)}
          />
        ) : field.type === 'checkbox' ? (
          <label className="flex h-[52px] items-center gap-2.5 rounded-lg border bg-white px-4">
            <input
              type="checkbox"
              className="h-5 w-5 rounded"
              checked={!!values[field.name]}
              onChange={(e) => set_(e.target.checked)}
            />
            <span className="text-[var(--ink-soft)]">{field.hint ?? 'Yes'}</span>
          </label>
        ) : field.type === 'money' ? (
          (() => {
            const part = money[field.name] ?? { amount: '', unit: field.moneyUnit ?? '100000' };
            const rupees = part.amount ? Number(part.amount) * Number(part.unit) : null;

            const apply = (next: { amount?: string; unit?: string }) => {
              const merged = { ...part, ...next };
              setMoney((current) => ({ ...current, [field.name]: merged }));
              set_(merged.amount ? String(Number(merged.amount) * Number(merged.unit)) : '');
            };

            return (
              <>
                <div className="flex gap-2">
                  <input
                    id={`f-${field.name}`}
                    type="text"
                    inputMode="decimal"
                    className={`${inputClass} min-w-0 flex-1`}
                    placeholder="e.g. 35"
                    value={part.amount}
                    onChange={(e) => apply({ amount: e.target.value.replace(/[^\d.]/g, '') })}
                  />
                  <select
                    className="field w-[104px] shrink-0 sm:w-[130px]"
                    aria-label="Unit"
                    value={part.unit}
                    onChange={(e) => apply({ unit: e.target.value })}
                  >
                    {MONEY_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                    ))}
                  </select>
                </div>
                {rupees ? (
                  <p className="mt-1.5 text-sm font-medium text-[var(--brand)]">= {inrFull(rupees)}</p>
                ) : null}
              </>
            );
          })()
        ) : field.type === 'combobox' ? (
          <Combobox
            id={`f-${field.name}`}
            options={field.options ?? []}
            value={value}
            onChange={set_}
            placeholder={field.placeholder}
            className={inputClass}
            required={field.required}
          />
        ) : field.type === 'select' ? (
          <select
            id={`f-${field.name}`}
            className={inputClass}
            required={field.required}
            value={value}
            onChange={(e) => set_(e.target.value)}
          >
            <option value="">Select</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <input
            id={`f-${field.name}`}
            // Numbers are entered as text with a numeric keypad: no spinner arrows,
            // and the scroll wheel cannot change what has been typed.
            type={field.type === 'number' ? 'text' : field.type ?? 'text'}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            className={inputClass}
            required={field.required}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) =>
              set_(field.type === 'number' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)
            }
          />
        )}

        {fieldError && <p className="mt-1.5 text-sm font-medium text-[var(--danger)]">{fieldError}</p>}

        {field.hint && field.type !== 'checkbox' && !fieldError && (
          <p className="mt-1.5 text-sm text-[var(--muted)]">{field.hint}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-card relative p-6 sm:p-8">
      <div className="space-y-8">
        {visibleGroups.map((group, index) => (
          <section key={group.title ?? index}>
            {group.title && (
              <h3 className="eyebrow mb-4 border-b pb-3 text-[var(--brand)]">{group.title}</h3>
            )}
            <div className="grid items-start gap-x-6 gap-y-5 sm:grid-cols-2">
              {group.items.map(renderField)}
            </div>
          </section>
        ))}
      </div>

      {/* Honeypot — hidden from people, filled by bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" value={values.website ?? ''} onChange={(e) => set('website', e.target.value)} />
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-[var(--danger)] bg-[#fdeaea] p-4">
          <p className="font-semibold text-[var(--danger)]">{error}</p>
          {Object.keys(fieldErrors).length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-[var(--danger)]">
              {Object.entries(fieldErrors).map(([name, messages]) => {
                const match = fields.find((f) => f.name === name);
                return (
                  <li key={name}>
                    <span className="font-medium">{match?.label ?? name}</span>: {messages[0]}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6">
        <button type="submit" className="btn btn-primary px-8" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : submitLabel}
        </button>
        <p className="text-sm text-[var(--muted)]">
          Only the fields marked <span className="text-[var(--danger)]">*</span> are required. We use your details
          only to respond to this enquiry.
        </p>
      </div>
    </form>
  );
}
