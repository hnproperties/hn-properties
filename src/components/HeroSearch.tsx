'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Combobox from './Combobox';

type Option = { value: string; label: string };

/**
 * Property types as buyers describe them, each mapped to the category slugs behind
 * it, plus the fields that actually make sense for that type. Nobody should be asked
 * how many bedrooms a godown has.
 */
type FieldKey = 'bedrooms' | 'plotArea' | 'area' | 'floor' | 'rooms';

const PROPERTY_TYPES: { label: string; slugs: string; fields: FieldKey[] }[] = [
  { label: 'Flat / Apartment', slugs: 'flat,apartment', fields: ['bedrooms'] },
  { label: 'House / Villa', slugs: 'house,villa,bungalow,duplex', fields: ['bedrooms', 'plotArea'] },
  { label: 'Builder Floor', slugs: 'builder-floor', fields: ['bedrooms', 'plotArea'] },
  { label: 'Farmhouse', slugs: 'farmhouse', fields: ['bedrooms', 'plotArea'] },
  { label: 'Residential Plot', slugs: 'residential-plot', fields: ['plotArea'] },
  { label: 'Commercial Shop / Showroom', slugs: 'shop,showroom', fields: ['floor', 'area'] },
  { label: 'Office Space', slugs: 'office', fields: ['floor', 'area'] },
  { label: 'Commercial Building', slugs: 'commercial-building', fields: ['plotArea'] },
  { label: 'Warehouse', slugs: 'warehouse', fields: ['plotArea'] },
  { label: 'Godown', slugs: 'godown', fields: ['plotArea'] },
  { label: 'Hotel', slugs: 'hotel', fields: ['rooms', 'plotArea'] },
  { label: 'Restaurant', slugs: 'restaurant', fields: ['plotArea'] },
  { label: 'Institutional Property', slugs: 'institutional-property', fields: ['plotArea'] },
  { label: 'Commercial Plot', slugs: 'commercial-plot', fields: ['plotArea'] },
  { label: 'Agricultural Land', slugs: 'agricultural-land', fields: ['plotArea'] },
  { label: 'Farmland', slugs: 'farmland', fields: ['plotArea'] },
  { label: 'Industrial Land', slugs: 'industrial-land', fields: ['plotArea'] },
  { label: 'Development Land', slugs: 'development-land', fields: ['plotArea'] },
  { label: 'Open Yard', slugs: 'open-yard', fields: ['plotArea'] },
];

const SALE_BUDGETS: Option[] = [
  { value: '0-2000000', label: 'Up to ₹20 L' },
  { value: '2000000-5000000', label: '₹20 L – ₹50 L' },
  { value: '5000000-10000000', label: '₹50 L – ₹1 Cr' },
  { value: '10000000-20000000', label: '₹1 Cr – ₹2 Cr' },
  { value: '20000000-50000000', label: '₹2 Cr – ₹5 Cr' },
  { value: '50000000-', label: 'Above ₹5 Cr' },
];

const RENT_BUDGETS: Option[] = [
  { value: '0-5000', label: 'Up to ₹5,000' },
  { value: '5000-10000', label: '₹5,000 – ₹10,000' },
  { value: '10000-25000', label: '₹10,000 – ₹25,000' },
  { value: '25000-50000', label: '₹25,000 – ₹50,000' },
  { value: '50000-100000', label: '₹50,000 – ₹1 L' },
  { value: '100000-', label: 'Above ₹1 L' },
];

const AREA_BANDS: Option[] = [
  { value: '0-1000', label: 'Up to 1,000 Sq.Ft' },
  { value: '1000-2500', label: '1,000 – 2,500 Sq.Ft' },
  { value: '2500-5000', label: '2,500 – 5,000 Sq.Ft' },
  { value: '5000-10000', label: '5,000 – 10,000 Sq.Ft' },
  { value: '10000-', label: 'Above 10,000 Sq.Ft' },
];

const FLOORS: Option[] = [
  { value: '0-0', label: 'Ground floor' },
  { value: '1-3', label: '1st – 3rd floor' },
  { value: '4-7', label: '4th – 7th floor' },
  { value: '8-', label: '8th floor and above' },
];

// value is "min-max"; an open max means "and above".
const BEDROOMS: Option[] = [
  { value: '1-1', label: '1 BHK' },
  { value: '2-2', label: '2 BHK' },
  { value: '3-3', label: '3 BHK' },
  { value: '4-4', label: '4 BHK' },
  { value: '5-', label: '5 BHK or more' },
];

const ROOMS: Option[] = [
  { value: '-5', label: 'Up to 5 rooms' },
  { value: '-10', label: 'Up to 10 rooms' },
  { value: '-20', label: 'Up to 20 rooms' },
  { value: '-50', label: 'Up to 50 rooms' },
  { value: '50-', label: '50 rooms or more' },
];

/**
 * Defined at module scope, not inside the component. A component declared inside
 * would be a new type on every render, so React would remount the location input
 * on each keystroke and drop the cursor.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[140px] flex-1">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

export default function HeroSearch({ locations }: { categories?: Option[]; locations: Option[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<'buy' | 'rent'>('buy');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [rooms, setRooms] = useState('');
  const [areaBand, setAreaBand] = useState('');
  const [floor, setFloor] = useState('');

  const selected = PROPERTY_TYPES.find((t) => t.slugs === type);
  const fields = selected?.fields ?? [];
  const budgets = mode === 'rent' ? RENT_BUDGETS : SALE_BUDGETS;

  function search() {
    const params = new URLSearchParams();
    if (type) params.set('category', type);

    if (location) {
      const match = locations.find((l) => l.label.toLowerCase() === location.trim().toLowerCase());
      if (match) params.set('location', match.value);
      else params.set('q', location.trim());
    }

    if (budget) {
      const [min, max] = budget.split('-');
      if (min) params.set('min', min);
      if (max) params.set('max', max);
    }

    // Hotels ask for rooms; the underlying field is the same one bedrooms use.
    const range = fields.includes('rooms') ? rooms : fields.includes('bedrooms') ? bedrooms : '';
    if (range) {
      const [min, max] = range.split('-');
      if (min) params.set('beds', min);
      if (max) params.set('bedsMax', max);
    }

    if ((fields.includes('plotArea') || fields.includes('area')) && areaBand) {
      const [min, max] = areaBand.split('-');
      if (min) params.set('areaMin', min);
      if (max) params.set('areaMax', max);
    }

    if (fields.includes('floor') && floor) {
      const [min, max] = floor.split('-');
      params.set('floorMin', min);
      if (max) params.set('floorMax', max);
    }

    router.push(`/${mode === 'buy' ? 'buy' : 'rent'}?${params.toString()}`);
  }

  return (
    // Deliberately no overflow-hidden on this card: it would clip the locality
    // dropdown. The tab strip rounds its own top corners instead.
    <div className="glass-card relative z-30">
      <div className="flex overflow-hidden rounded-t-2xl border-b">
        {(['buy', 'rent'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setBudget('');
            }}
            className={`flex-1 px-2 py-4 text-center text-base font-semibold transition lg:flex-none lg:px-7 lg:text-left ${
              mode === option
                ? 'border-b-2 border-[var(--brand)] text-[var(--brand)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {option === 'buy' ? '🏠 Buy Property' : '🔑 Rent Property'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 lg:flex lg:flex-wrap lg:items-end">
        <Field label="Property Type">
          <select
            className="field"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setBedrooms('');
              setRooms('');
              setAreaBand('');
              setFloor('');
            }}
          >
            <option value="">Select type</option>
            {PROPERTY_TYPES.map((option) => (
              <option key={option.slugs} value={option.slugs}>{option.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Location">
          <Combobox
            id="hs-location"
            options={locations}
            value={location}
            onChange={setLocation}
            placeholder="Type or pick a locality"
            onEnter={search}
          />
        </Field>

        {fields.includes('bedrooms') && (
          <Field label="Bedrooms">
            <select className="field" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
              <option value="">Any</option>
              {BEDROOMS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        )}

        {fields.includes('rooms') && (
          <Field label="No. of Rooms">
            <select className="field" value={rooms} onChange={(e) => setRooms(e.target.value)}>
              <option value="">Any</option>
              {ROOMS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        )}

        {fields.includes('floor') && (
          <Field label="Floor">
            <select className="field" value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="">Any</option>
              {FLOORS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        )}

        {(fields.includes('plotArea') || fields.includes('area')) && (
          <Field label={fields.includes('plotArea') ? 'Plot Area' : 'Area'}>
            <select className="field" value={areaBand} onChange={(e) => setAreaBand(e.target.value)}>
              <option value="">Any</option>
              {AREA_BANDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        )}

        <Field label={mode === 'rent' ? 'Monthly Budget' : 'Budget'}>
          <select className="field" value={budget} onChange={(e) => setBudget(e.target.value)}>
            <option value="">Select budget</option>
            {budgets.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>

        <div className="flex items-end max-lg:mt-1">
          <button type="button" className="btn btn-navy w-full px-10 lg:w-auto" onClick={search}>
            🔍 Search
          </button>
        </div>
      </div>

      {/* Anyone handed a reference over WhatsApp arrives knowing the code and
          nothing else, so give them a direct route rather than making them work
          through the filters above. Phones only — the desktop header has its own
          search button. */}
      <form action="/search" className="flex gap-2 border-t px-4 py-3 lg:hidden">
        <input
          type="search"
          name="q"
          placeholder="Have a code? e.g. HNP-S-JBP-000023"
          aria-label="Search by property code"
          className="field min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-ghost shrink-0">
          Go
        </button>
      </form>
    </div>
  );
}
