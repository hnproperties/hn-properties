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

/**
 * Plot area bands, in square feet.
 *
 * Ranges rather than a slider: a slider needs two precise numbers from someone who
 * is browsing, and most people looking for land think in rough sizes — "about a
 * thousand feet" — not in exact bounds.
 */
const PLOT_AREAS = [
  { value: '0-500', label: 'Up to 500 sq.ft' },
  { value: '500-1000', label: '500 – 1,000 sq.ft' },
  { value: '1000-1500', label: '1,000 – 1,500 sq.ft' },
  { value: '1500-2500', label: '1,500 – 2,500 sq.ft' },
  { value: '2500-5000', label: '2,500 – 5,000 sq.ft' },
  { value: '5000-10000', label: '5,000 – 10,000 sq.ft' },
  { value: '10000-', label: 'Above 10,000 sq.ft' },
];

/**
 * Property types where plot area is a thing buyers filter on.
 *
 * Left off flats and apartments deliberately: those are bought on carpet or
 * built-up area, and a plot-area filter there would either match nothing or match
 * the whole building's footprint. Offering a filter that cannot work is worse than
 * not offering it.
 */
const PLOT_AREA_SLUGS = [
  // Slugs, not names. Note "housevilla" and "commercial-shopshowroom": slugify
  // strips the slash without putting a hyphen in its place, so these are not the
  // hyphenated forms you would expect from reading the category names.
  'housevilla', 'farmhouse', 'residential-plot',
  'commercial-shopshowroom', 'office-space', 'commercial-building',
  'warehouse', 'godown', 'hotel', 'restaurant',
  'institutional-property', 'commercial-plot',
  'agricultural-land', 'farmland', 'industrial-land',
  'development-land', 'open-yard',
];

/**
 * Large-acreage land, in acres rather than square feet — farmland and
 * agricultural/industrial/development land are bought by the acre, often many
 * acres, and the square-foot bands above (built for a house plot or a shop) would
 * either all read "above 10,000 sq.ft" or just not match how anyone thinks about
 * this kind of size. Values are still in square feet underneath (1 acre = 43,560
 * sq.ft) so the area filter itself needs no change — only the bands shown differ.
 */
const PLOT_AREAS_LARGE_LAND = [
  { value: '0-43560', label: 'Up to 1 acre' },
  { value: '43560-130680', label: '1 – 3 acres' },
  { value: '130680-217800', label: '3 – 5 acres' },
  { value: '217800-435600', label: '5 – 10 acres' },
  { value: '435600-1089000', label: '10 – 25 acres' },
  { value: '1089000-', label: 'Above 25 acres' },
];

/**
 * Matched against a category's display label, not its slug. The slug a category
 * ends up with has drifted across a few different places in this codebase (see
 * the note on PLOT_AREA_SLUGS below, where a couple of merged categories ended up
 * with slugs nobody would guess) — the label is what's actually shown to people
 * and is far less likely to silently stop matching after a rename.
 */
function labelHas(category: Facet | undefined, keywords: string[]): boolean {
  if (!category) return false;
  const label = category.label.toLowerCase();
  return keywords.some((k) => label.includes(k));
}

const BEDROOM_KEYWORDS = ['flat', 'apartment', 'house', 'villa', 'builder floor', 'farmhouse'];
const LARGE_LAND_KEYWORDS = ['farmland', 'agricultural land', 'industrial land', 'development land', 'open yard'];

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
  const plotAreaValue = `${params.get('areaMin') ?? ''}-${params.get('areaMax') ?? ''}`;

  /*
   * Whether plot area is worth offering.
   *
   * With a type chosen, show it only if that type is one where plot area is how
   * people compare. With nothing chosen, show it whenever any listed type would
   * qualify — hiding it until a type is picked would leave someone browsing land
   * with no way to narrow by size, which is the main thing they care about.
   */
  const chosenCategory = current('category');
  const chosenCategoryFacet = categories.find((category) => category.value === chosenCategory);
  const showPlotArea = chosenCategory
    ? PLOT_AREA_SLUGS.includes(chosenCategory)
    : categories.some((category) => PLOT_AREA_SLUGS.includes(category.value));

  // Bedrooms means nothing for a commercial plot, a godown, a warehouse — asking
  // doesn't just look odd, it would filter a plot search against a field no plot
  // listing has any value in, which it should never do.
  const showBedrooms = chosenCategory
    ? labelHas(chosenCategoryFacet, BEDROOM_KEYWORDS)
    : categories.some((category) => labelHas(category, BEDROOM_KEYWORDS));

  // Only matters once a specific land type is picked — with nothing chosen there
  // is no one category to key the band set off, so default to the sq.ft bands.
  const plotAreaBands = chosenCategory && labelHas(chosenCategoryFacet, LARGE_LAND_KEYWORDS) ? PLOT_AREAS_LARGE_LAND : PLOT_AREAS;
  const activeCount = ['category', 'segment', 'location', 'min', 'max', 'areaMin', 'areaMax', 'beds', 'verified', 'ready', 'type'].filter((k) => params.get(k)).length;

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
              onChange={(e) => {
                const picked = e.target.checked ? category.value : '';
                // Switching category can take away a filter that was showing —
                // clear it rather than leaving it applied invisibly. Plot area is
                // cleared too because the bands themselves differ (sq.ft vs
                // acres); a leftover numeric range from the other scale wouldn't
                // match any visible option and would otherwise keep filtering
                // silently.
                const stillHasBedrooms = picked && labelHas(category, BEDROOM_KEYWORDS);
                const stillHasSameAreaScale = picked && labelHas(category, LARGE_LAND_KEYWORDS) === labelHas(chosenCategoryFacet, LARGE_LAND_KEYWORDS);
                apply({
                  category: picked,
                  segment: '',
                  ...(stillHasBedrooms ? {} : { beds: '' }),
                  ...(stillHasSameAreaScale ? {} : { areaMin: '', areaMax: '' }),
                });
              }}
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

      {/*
        Plot area, after Locality — you pick where before you pick how big.
        Shown only when the chosen property type is one where plot area means
        something, or when nothing is chosen yet and it might still apply.
      */}
      {showPlotArea && (
        <Section title="Plot area">
          {plotAreaBands.map((band) => (
            <label key={band.value} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="plotArea"
                className="h-4 w-4"
                checked={plotAreaValue === band.value}
                onChange={() => {
                  const [areaMin, areaMax] = band.value.split('-');
                  apply({ areaMin, areaMax });
                }}
              />
              <span className="text-[var(--ink-soft)]">{band.label}</span>
            </label>
          ))}
        </Section>
      )}

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

      {showBedrooms && (
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
      )}

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
