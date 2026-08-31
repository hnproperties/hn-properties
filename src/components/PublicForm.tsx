'use client';

import { useEffect, useRef, useState } from 'react';
import { compressImage } from '@/lib/compress-image';
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
  /**
   * Show a read-back of the answers before sending.
   *
   * Only worth it where a mistake is expensive and hard to undo — a property that
   * goes live under the wrong category has to be corrected by phone afterwards.
   * A quick enquiry does not need it, and a confirmation step on a two-field form
   * is friction with nothing to catch.
   */
  reviewBeforeSend?: boolean;
  /**
   * Show one section at a time on a phone.
   *
   * A listing form is five or six sections long, which on a phone is a very long
   * scroll with no sense of progress — people give up in the middle without knowing
   * how much was left. Desktop keeps the single page, where the whole form is
   * visible at once and stepping through it would only add clicks.
   */
  stepOnMobile?: boolean;
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

    for (const original of Array.from(files).slice(0, 15)) {
      try {
        // Shrink before uploading: camera photos are several megabytes, which is
        // slow on mobile data and pointless for a listing photograph.
        const file = await compressImage(original);
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
export default function PublicForm({ endpoint, fields, hidden, submitLabel, successTitle, successBody, reviewBeforeSend, stepOnMobile }: Props) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reference, setReference] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  /*
   * Whether we are actually on a phone, in JavaScript rather than CSS.
   *
   * Stepping cannot be done by hiding sections with CSS. A `required` field inside
   * a display:none section still blocks the form, but the browser cannot focus it
   * to report the error — so pressing Next did nothing at all, silently, which is
   * exactly the bug this replaces. Unmounting the other sections is the fix, and
   * that needs a real breakpoint check.
   *
   * Starts false so the server and the first client render agree; the effect
   * corrects it immediately after mount.
   */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
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

    /*
     * First press opens the review, second one sends.
     *
     * Deliberately after the browser's own validation, which has already run by the
     * time submit fires — so the summary never shows a half-filled form, and the
     * required-field messages still appear where the fields are.
     */
    /*
     * On a phone, submit means "next" until the last section. Runs after the
     * browser's validation, so an incomplete step stops here with its own error
     * rather than moving on and failing later.
     */
    if (stepping && !onLastStep) {
      setStep(current + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (reviewBeforeSend && !reviewing) {
      setReviewing(true);
      /*
       * Scroll to the summary, not the top of the page.
       *
       * Sending them to the very top means landing back on the page heading and
       * the four "how it works" steps, with the thing they just asked to see
       * somewhere below the fold. The panel renders on this same tick, so the
       * scroll waits a frame for it to exist.
       */
      requestAnimationFrame(() => {
        reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

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
      setReviewing(false);
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

  /*
   * Sections not on the current step are removed from the page, not hidden.
   *
   * Nothing is lost by doing so: every field is controlled, and the payload is
   * built from `values` in state rather than from the DOM. Hiding them instead
   * leaves their required fields in the document, where they block submission
   * without being focusable — the browser refuses and reports nothing.
   */
  const stepping = !!stepOnMobile && narrow && !reviewing;
  const steps = stepping ? visibleGroups.length : 0;
  const current = Math.min(step, Math.max(0, steps - 1));
  const onLastStep = !stepping || current >= steps - 1;

  function renderField(field: Field) {
    const value = values[field.name] ?? '';
    const set_ = (next: any) => set(field.name, next);
    const fieldError = fieldErrors[field.name]?.[0];
    const inputClass = `field${fieldError ? ' border-[var(--danger)] ring-2 ring-[var(--danger)]/20' : ''}`;

    return (
      <div key={field.name} className={field.half ? '' : 'sm:col-span-2'}>
        {field.type !== 'location' && (
          // Bumped on a phone only, and scoped here rather than in the .label
          // class — that class is shared with 41 places in the CRM, where the
          // labels sit in dense tables and forms that do not want the extra size.
          <label className="label text-[15px] sm:text-sm" htmlFor={`f-${field.name}`}>
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
            <span className="text-[15px] text-[var(--ink-soft)] sm:text-sm">{field.hint ?? 'Yes'}</span>
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
            // Jabalpur has more localities than we have on file, and an owner in one
            // we do not know about should not be stuck. The locality itself is
            // created on submission and stays hidden until HN approves it.
            allowNew
            newLabel={(typed) => `Add "${typed}" as a new locality`}
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
        {stepping && steps > 1 && (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[var(--brand)]">
                Step {current + 1} of {steps}
              </span>
              <span className="text-[var(--muted)]">{visibleGroups[current]?.title}</span>
            </div>
            {/* A bar rather than dots: six dots on a narrow screen are too small to
                read as progress, and this also works when a property type adds or
                removes a section. */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
                style={{ width: `${((current + 1) / steps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {visibleGroups.map((group, index) => (
          stepping && index !== current ? null : (
          <section key={group.title ?? index}>
            {group.title && (
              <h3 className="eyebrow mb-4 border-b pb-3 text-base text-[var(--brand)] sm:text-sm">{group.title}</h3>
            )}
            <div className="grid items-start gap-x-6 gap-y-5 sm:grid-cols-2">
              {group.items.map(renderField)}
            </div>
          </section>
          )
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

      {reviewing && (
        <div ref={reviewRef} className="mt-8 scroll-mt-24 rounded-2xl border-2 border-[var(--brand)] bg-[var(--brand-soft)] p-5 sm:p-6">
          <h3 className="display text-lg text-[var(--navy)]">Please check before sending</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            This is what we will list. A wrong property type has to be corrected by phone once it is live,
            so it is worth a quick look.
          </p>

          <dl className="mt-4 divide-y divide-black/5 rounded-xl bg-white/70">
            {fields
              .filter((field) => {
                if (field.name === 'website') return false; // honeypot
                const value = values[field.name];
                if (value === undefined || value === null || value === '') return false;
                if (Array.isArray(value) && !value.length) return false;
                return visibleGroups.some((group) => group.items.some((item) => item.name === field.name));
              })
              .map((field) => {
                const raw = values[field.name];

                /*
                 * Show what they picked, not what gets posted. A category reads as
                 * an id in the payload, and "cmf3x9…" tells nobody they chose Flat
                 * when they meant House — which is the entire mistake this is here
                 * to catch.
                 */
                let shown: string;
                if (Array.isArray(raw)) {
                  shown = field.type === 'photos' ? `${raw.length} photo${raw.length === 1 ? '' : 's'}` : raw.join(', ');
                } else if (field.type === 'checkbox') {
                  shown = raw ? 'Yes' : 'No';
                } else if (field.options?.length) {
                  shown = field.options.find((option) => option.value === String(raw))?.label ?? String(raw);
                } else if (field.type === 'money') {
                  shown = `₹${Number(raw).toLocaleString('en-IN')}`;
                } else {
                  shown = String(raw);
                }

                return (
                  <div key={field.name} className="flex gap-4 px-4 py-2.5 text-sm">
                    <dt className="w-2/5 flex-none text-[var(--muted)]">{field.label}</dt>
                    <dd className="min-w-0 flex-1 font-medium">{shown}</dd>
                  </div>
                );
              })}
          </dl>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
        {reviewing && (
          <button
            type="button"
            className="btn btn-ghost px-6"
            disabled={state === 'sending'}
            onClick={() => setReviewing(false)}
          >
            Go back and edit
          </button>
        )}

        {/*
          Back and Next only exist on a phone, and only while stepping. Back is a
          plain button so it never submits; Next is type="submit" on purpose, which
          is what makes the browser run its own required-field checks before letting
          someone move on — a step that silently allowed empty required fields would
          only fail at the end, with no clue which section was at fault.
        */}
        {stepping && current > 0 && (
          <button
            type="button"
            className="btn btn-ghost px-6"
            onClick={() => {
              setStep(current - 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Back
          </button>
        )}

        {stepping && !onLastStep && (
          <button type="submit" className="btn btn-primary flex-1 px-8">
            Next
          </button>
        )}

        <button
          type="submit"
          className={`btn btn-primary px-8 ${stepping && !onLastStep ? 'hidden' : ''}`}
          disabled={state === 'sending'}
        >
          {state === 'sending' ? 'Sending…' : reviewing ? 'Confirm and send' : reviewBeforeSend ? 'Review your details' : submitLabel}
        </button>
        <p className="text-sm text-[var(--muted)]">
          Only the fields marked <span className="text-[var(--danger)]">*</span> are required. We use your details
          only to respond to this enquiry.
        </p>
      </div>
    </form>
  );
}
