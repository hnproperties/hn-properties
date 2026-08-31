'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { matchScore } from '@/lib/fuzzy';

type Option = { value: string; label: string };

type Props = {
  id?: string;
  options: Option[];
  /** The visible text. Free text is allowed — the list is a shortcut, not a cage. */
  value: string;
  onChange: (label: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  onEnter?: () => void;
  /**
   * Offer to keep what was typed when it matches nothing in the list.
   *
   * On for the locality field, where the list is the localities we happen to know
   * about rather than every one that exists. Off for search, where offering to
   * "add" a locality nobody has property in would promise a result that cannot exist.
   */
  allowNew?: boolean;
  /** Wording for that option, e.g. 'Add "Tagore Nagar" as a new locality'. */
  newLabel?: (typed: string) => string;
};

/**
 * Type-to-filter dropdown. The browser's native datalist looked out of place and
 * became unwieldy past a hundred entries, so this renders its own list: filtered as
 * you type, navigable with the arrow keys, and closed by Escape or a click outside.
 */
export default function Combobox({ id, options, value, onChange, placeholder, className, required, onEnter, allowNew, newLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const term = value.trim();
    if (!term) return options;

    // Forgiving: "katnga" still finds Katanga, and near misses rank below exact ones.
    return options
      .map((option) => ({ option, score: matchScore(term, option.label) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.option);
  }, [options, value]);

  /*
   * Whether to offer keeping what was typed.
   *
   * Only when nothing in the list matches it exactly. The fuzzy search is
   * deliberately forgiving — "Tagore Nagar" still returns thirty-odd localities
   * because they all end in "Nagar" — so a non-empty result list is no evidence
   * that what someone typed actually exists. Comparing the exact text is.
   */
  const typed = value.trim();
  const exact = options.some((option) => option.label.toLowerCase() === typed.toLowerCase());
  const offerNew = !!allowNew && typed.length >= 3 && !exact;

  // The create row sits first, so Enter takes it rather than an unrelated
  // suggestion — typing a new locality and pressing Enter used to silently
  // replace it with whatever happened to be at the top of the list.
  const rows: ({ kind: 'new' } | { kind: 'option'; option: Option })[] = [
    ...(offerNew ? [{ kind: 'new' as const }] : []),
    ...filtered.map((option) => ({ kind: 'option' as const, option })),
  ];

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function choose(option: Option) {
    onChange(option.label);
    setOpen(false);
  }

  /** Keeps the typed text as-is. The locality itself is created on submission. */
  function keepTyped() {
    onChange(typed);
    setOpen(false);
  }

  function pick(index: number) {
    const row = rows[index];
    if (!row) return;
    if (row.kind === 'new') keepTyped();
    else choose(row.option);
  }

  return (
    <div ref={wrapper} className="relative">
      <input
        id={id}
        type="text"
        className={className ?? 'field'}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, rows.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            if (open && rows[highlight]) {
              e.preventDefault();
              pick(highlight);
            } else {
              onEnter?.();
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />

      <button
        type="button"
        aria-label="Show list"
        tabIndex={-1}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      >
        ⌄
      </button>

      {open && rows.length > 0 && (
        <ul className="absolute z-[200] mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-white py-1 shadow-2xl">
          <li className="px-4 py-1.5 text-xs text-[var(--muted)]">
            {offerNew
              ? 'Not in the list? Keep what you typed.'
              : `${filtered.length} ${filtered.length === 1 ? 'locality' : 'localities'}${typed ? ' matching' : ' — type to filter'}`}
          </li>

          {offerNew && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={keepTyped}
                onMouseEnter={() => setHighlight(0)}
                className={`flex w-full items-center gap-2 border-b px-4 py-2.5 text-left text-sm font-semibold ${
                  highlight === 0 ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : 'text-[var(--brand)]'
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">+</span>
                <span className="min-w-0 truncate">
                  {newLabel ? newLabel(typed) : `Add "${typed}"`}
                </span>
              </button>
            </li>
          )}

          {filtered.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setHighlight(index + (offerNew ? 1 : 0))}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  index + (offerNew ? 1 : 0) === highlight ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : 'text-[var(--ink-soft)]'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && value.trim() && filtered.length === 0 && (
        <div className="absolute z-[200] mt-1 w-full rounded-lg border bg-white px-4 py-3 text-sm text-[var(--muted)] shadow-2xl">
          No match — we will search for “{value.trim()}” as a keyword.
        </div>
      )}
    </div>
  );
}
