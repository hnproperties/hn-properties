'use client';

import { useMemo, useState } from 'react';

type Option = { value: string; label: string };

/**
 * A lookup you can type into.
 *
 * The plain select was fine when a list held a dozen rows, but picking a listing
 * out of hundreds by scrolling is unworkable — and staff usually arrive holding a
 * reference code rather than a title. This filters as you type and matches on any
 * part of the label, so "000023" or "adarsh" both find HNP-S-JBP-000023.
 *
 * Deliberately built on a plain input and a list of buttons rather than a custom
 * dropdown widget: it keeps keyboard and screen-reader behaviour predictable and
 * works the same on a phone.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Type a code or name…',
  id,
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options.slice(0, 12);
    return options.filter((o) => o.label.toLowerCase().includes(term)).slice(0, 12);
  }, [options, query]);

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2">
        <span className="field flex min-w-0 flex-1 items-center truncate">{selected.label}</span>
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          onClick={() => {
            onChange('');
            setQuery('');
            setOpen(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        id={id}
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
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--muted)]">Nothing matches “{query}”.</p>
          ) : (
            matches.map((option) => (
              <button
                key={option.value}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--brand-soft)]"
                onClick={() => {
                  onChange(option.value);
                  setQuery('');
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          )}
          <button
            type="button"
            className="block w-full border-t px-3 py-2 text-left text-xs text-[var(--muted)] hover:bg-[var(--brand-soft)]"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
