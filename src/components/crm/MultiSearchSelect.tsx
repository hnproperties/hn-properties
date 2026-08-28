'use client';

import { useMemo, useState } from 'react';

type Option = { value: string; label: string };

/**
 * Searchable multi-select.
 *
 * The checkbox grid it replaces worked when there were a dozen localities; with
 * several hundred it became a wall you had to scroll past to reach the rest of
 * the form. This keeps the picked items visible as removable chips and hides the
 * rest behind a search box.
 *
 * `onCreate` adds an inline "add this one" affordance — used for localities,
 * where the list can never be complete and staff should not have to stop and ask
 * an admin to add a colony before recording a property in it.
 */
export default function MultiSearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  onCreate,
  createLabel = 'Add',
}: {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  onCreate?: (name: string) => Promise<Option | null>;
  createLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const picked = useMemo(
    () => value.map((id) => options.find((o) => o.value === id)).filter(Boolean) as Option[],
    [options, value],
  );

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    const unpicked = options.filter((o) => !value.includes(o.value));
    if (!term) return unpicked.slice(0, 12);
    return unpicked.filter((o) => o.label.toLowerCase().includes(term)).slice(0, 12);
  }, [options, value, query]);

  const term = query.trim();
  const exactExists = options.some((o) => o.label.toLowerCase() === term.toLowerCase());

  async function create() {
    if (!onCreate || !term) return;
    setCreating(true);
    try {
      const made = await onCreate(term);
      if (made) {
        onChange([...value, made.value]);
        setQuery('');
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {picked.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {picked.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1 text-sm text-[var(--brand)]"
            >
              {option.label}
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                className="text-base leading-none"
                onClick={() => onChange(value.filter((id) => id !== option.value))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          className="field"
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />

        {open && (
          <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-lg">
            {matches.map((option) => (
              <button
                key={option.value}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--brand-soft)]"
                onClick={() => {
                  onChange([...value, option.value]);
                  setQuery('');
                }}
              >
                {option.label}
              </button>
            ))}

            {matches.length === 0 && !onCreate && (
              <p className="px-3 py-2 text-sm text-[var(--muted)]">Nothing matches “{query}”.</p>
            )}

            {onCreate && term && !exactExists && (
              <button
                type="button"
                disabled={creating}
                className="block w-full border-t px-3 py-2 text-left text-sm font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)] disabled:opacity-50"
                onClick={create}
              >
                {creating ? 'Adding…' : `${createLabel} “${term}”`}
              </button>
            )}

            <button
              type="button"
              className="block w-full border-t px-3 py-2 text-left text-xs text-[var(--muted)] hover:bg-[var(--brand-soft)]"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
