'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

type Facet = { value: string; label: string; count: number };

type Props = {
  categories: Facet[];
  locations: Facet[];
  segments: { value: string; count: number }[];
  /** Shown only on the combined /properties view, where sale and rent sit together. */
  showTypeFilter?: boolean;
};

const BUDGETS = [
  { value: '0-2000000', label: 'Up to ₹20 L' },
  { value: '2000000-5000000', label: '₹20 L – ₹50 L' },
  { value: '5000000-10000000', label: '₹50 L – ₹1 Cr' },
  { value: '10000000-20000000', label: '₹1 Cr – ₹2 Cr' },
  { value: '20000000-', label: 'Above ₹2 Cr' },
];

const RENT_BUDGETS = [
  { value: '0-10000', label: 'Up to ₹10,000' },
  { value: '10000-25000', label: '₹10,000 – ₹25,000' },
  { value: '25000-50000', label: '₹25,000 – ₹50,000' },
  { value: '50000-100000', label: '₹50,000 – ₹1 L' },
  { value: '100000-', label: 'Above ₹1 L' },
];

const SEGMENT_LABEL: Record<string, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  LAND: 'Land & plots',
};

function Section({ title, children, initiallyOpen = true }: { title: string; children: React.ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="border-b py-4 last:border-0">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <span className="font-semibold text-[var(--navy)]">{title}</span>
        <span className={`text-[var(--muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {open && <div className="mt-3 space-y-2.5">{children}</div>}
    </div>
  );
}

/** Sidebar filters. Every change is written to the URL, so results stay shareable. */
export default function BrowseFilters({ categories, locations, segments, showTypeFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const isRent = pathname.startsWith('/rent') || params.get('type') === 'RENT';
  const budgets = isRent ? RENT_BUDGETS : BUDGETS;

  function apply(next: Record<string, string>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    search.delete('page');
    router.push(`${pathname}?${search.toString()}`);
  }

  const current = (key: string) => params.get(key) ?? '';
  const budgetValue = `${params.get('min') ?? ''}-${params.get('max') ?? ''}`;
  const activeCount = ['category', 'segment', 'location', 'min', 'max', 'beds', 'verified', 'ready', 'type'].filter((k) => params.get(k)).length;

  const visibleCategories = showAllCategories ? categories : categories.slice(0, 6);
  const visibleLocations = showAllLocations ? locations : locations.slice(0, 6);

  return (
    <aside className="plate h-fit p-5 lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b pb-3">
        <p className="display text-lg text-[var(--navy)]">Filters</p>
        {activeCount > 0 && (
          <button type="button" className="text-sm font-semibold text-[var(--brand)] hover:underline" onClick={() => router.push(pathname)}>
            Clear all
          </button>
        )}
      </div>

      {showTypeFilter && (
        <Section title="Looking to">
          {[
            { value: '', label: 'Buy or rent' },
            { value: 'SALE', label: 'Buy' },
            { value: 'RENT', label: 'Rent' },
          ].map((option) => (
            <label key={option.label} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="type"
                className="h-4 w-4"
                checked={current('type') === option.value}
                onChange={() => apply({ type: option.value })}
              />
              <span className="text-[var(--ink-soft)]">{option.label}</span>
            </label>
          ))}
        </Section>
      )}

      {segments.length > 0 && (
        <Section title="Segment">
          {segments.map((segment) => (
            <label key={segment.value} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={current('segment') === segment.value}
                onChange={(e) => apply({ segment: e.target.checked ? segment.value : '', category: '' })}
              />
              <span className="flex-1 text-[var(--ink-soft)]">{SEGMENT_LABEL[segment.value] ?? segment.value}</span>
              <span className="text-sm text-[var(--muted)]">({segment.count})</span>
            </label>
          ))}
        </Section>
      )}

      <Section title="Property type">
        {visibleCategories.length === 0 && <p className="text-sm text-[var(--muted)]">Nothing listed yet.</p>}
        {visibleCategories.map((category) => (
          <label key={category.value} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={current('category') === category.value}
              onChange={(e) => apply({ category: e.target.checked ? category.value : '', segment: '' })}
            />
            <span className="flex-1 text-[var(--ink-soft)]">{category.label}</span>
            <span className="text-sm text-[var(--muted)]">({category.count})</span>
          </label>
        ))}
        {categories.length > 6 && (
          <button type="button" className="text-sm font-semibold text-[var(--brand)] hover:underline" onClick={() => setShowAllCategories((v) => !v)}>
            {showAllCategories ? 'Show fewer' : `Show ${categories.length - 6} more`}
          </button>
        )}
      </Section>

      <Section title="Locality">
        {visibleLocations.length === 0 && <p className="text-sm text-[var(--muted)]">Nothing listed yet.</p>}
        {visibleLocations.map((location) => (
          <label key={location.value} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={current('location') === location.value}
              onChange={(e) => apply({ location: e.target.checked ? location.value : '' })}
            />
            <span className="flex-1 text-[var(--ink-soft)]">{location.label}</span>
            <span className="text-sm text-[var(--muted)]">({location.count})</span>
          </label>
        ))}
        {locations.length > 6 && (
          <button type="button" className="text-sm font-semibold text-[var(--brand)] hover:underline" onClick={() => setShowAllLocations((v) => !v)}>
            {showAllLocations ? 'Show fewer' : `Show ${locations.length - 6} more`}
          </button>
        )}
      </Section>

      <Section title="Budget">
        {budgets.map((budget) => (
          <label key={budget.value} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="radio"
              name="budget"
              className="h-4 w-4"
              checked={budgetValue === budget.value}
              onChange={() => {
                const [min, max] = budget.value.split('-');
                apply({ min, max });
              }}
            />
            <span className="text-[var(--ink-soft)]">{budget.label}</span>
          </label>
        ))}
      </Section>

      <Section title="Bedrooms" initiallyOpen={false}>
        <div className="flex flex-wrap gap-2">
          {['1', '2', '3', '4', '5'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => apply({ beds: current('beds') === n ? '' : n })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                current('beds') === n ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]' : 'hover:border-[var(--brand)]'
              }`}
            >
              {n}+
            </button>
          ))}
        </div>
      </Section>

      <Section title="More" initiallyOpen={false}>
        {[
          ['verified', 'HN Verified only'],
          ['ready', 'Ready to move'],
          ['mainRoad', 'Main road'],
          ['corner', 'Corner property'],
          ['gated', 'Gated society'],
          ['parking', 'Covered parking'],
        ].map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={current(key) === 'true'}
              onChange={(e) => apply({ [key]: e.target.checked ? 'true' : '' })}
            />
            <span className="text-[var(--ink-soft)]">{label}</span>
          </label>
        ))}
      </Section>
    </aside>
  );
}
