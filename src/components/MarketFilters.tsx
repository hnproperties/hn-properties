'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

type Option = { value: string; label: string };
type Props = { categories: Option[]; locations: Option[]; showRentFields?: boolean };

export default function MarketFilters({ categories, locations, showRentFields }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const value = (key: string) => params.get(key) ?? '';

  function apply(next: Record<string, string>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val) search.set(key, val);
      else search.delete(key);
    }
    search.delete('page');
    router.push(`${pathname}?${search.toString()}`);
  }

  const clear = () => router.push(pathname);

  return (
    <div className="plate p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input
            id="q"
            className="field"
            placeholder="Locality, property ID, keyword"
            defaultValue={value('q')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply({ q: (e.target as HTMLInputElement).value });
            }}
          />
        </div>

        <div className="w-[160px]">
          <label className="label" htmlFor="category">Property type</label>
          <select id="category" className="field" value={value('category')} onChange={(e) => apply({ category: e.target.value })}>
            <option value="">Any</option>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="w-[160px]">
          <label className="label" htmlFor="location">Locality</label>
          <select id="location" className="field" value={value('location')} onChange={(e) => apply({ location: e.target.value })}>
            <option value="">Anywhere</option>
            {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <div className="w-[150px]">
          <label className="label" htmlFor="sort">Sort</label>
          <select id="sort" className="field" value={value('sort')} onChange={(e) => apply({ sort: e.target.value })}>
            <option value="">Featured first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="popular">Most viewed</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <button type="button" className="btn btn-ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Fewer filters' : 'More filters'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={clear}>Clear</button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="min">Budget from (₹)</label>
            <input id="min" className="field" inputMode="numeric" defaultValue={value('min')} onBlur={(e) => apply({ min: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="max">Budget up to (₹)</label>
            <input id="max" className="field" inputMode="numeric" defaultValue={value('max')} onBlur={(e) => apply({ max: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="areaMin">Minimum area</label>
            <input id="areaMin" className="field" inputMode="numeric" defaultValue={value('areaMin')} onBlur={(e) => apply({ areaMin: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="beds">Bedrooms</label>
            <select id="beds" className="field" value={value('beds')} onChange={(e) => apply({ beds: e.target.value })}>
              <option value="">Any</option>
              {['1', '2', '3', '4', '5'].map((n) => <option key={n} value={n}>{n}+</option>)}
            </select>
          </div>
          {showRentFields && (
            <div>
              <label className="label" htmlFor="furnishing">Furnishing</label>
              <select id="furnishing" className="field" value={value('furnishing')} onChange={(e) => apply({ furnishing: e.target.value })}>
                <option value="">Any</option>
                <option value="UNFURNISHED">Unfurnished</option>
                <option value="SEMI_FURNISHED">Semi-furnished</option>
                <option value="FURNISHED">Furnished</option>
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
            {[
              ['verified', 'HN Verified only'],
              ['ready', 'Ready to move'],
              ['mainRoad', 'Main road'],
              ['corner', 'Corner'],
              ['gated', 'Gated society'],
              ['parking', 'Covered parking'],
            ].map(([key, text]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value(key) === 'true'}
                  onChange={(e) => apply({ [key]: e.target.checked ? 'true' : '' })}
                />
                {text}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
