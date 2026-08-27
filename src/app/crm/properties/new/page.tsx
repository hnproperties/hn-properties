'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  toOptions, AREA_UNITS, FACINGS, FURNISHINGS, MOTIVATIONS, SOURCE_TYPES,
  AMENITY_OPTIONS, BUSINESS_SUITABILITY, LISTING_TYPES, VISIBILITIES,
  FIELD_TYPES, ownerTypeFor,
} from '@/lib/constants';
import { useCan } from '@/components/crm/CrmShell';
import PhotoUploader from '@/components/crm/PhotoUploader';
import LocationPicker from '@/components/LocationPicker';
import { inr } from '@/lib/format';
import { site } from '@/lib/constants';

type Option = {
  value: string;
  label: string;
  /** Category lookups carry these so the Details step can adapt to the type. */
  segment?: string;
  hasBedrooms?: boolean;
  hasFurnishing?: boolean;
  hasFrontage?: boolean;
  isLand?: boolean;
};

const STEPS = [
  'Purpose', 'Basics', 'Location', 'Details', 'Financials', 'Owner',
  'Photos', 'Documents', 'Visibility', 'Verification', 'Publish',
];

/**
 * Sale, rent and lease need different questions further along — a deposit and
 * lock-in matter for a lease and not for a sale — so the wizard asks this first
 * and branches on the answer rather than showing every field to everyone.
 */
/** Index of each step, so inserting one never breaks the comparisons below. */
const S = {
  PURPOSE: 0, BASICS: 1, LOCATION: 2, DETAILS: 3, FINANCIALS: 4, OWNER: 5,
  PHOTOS: 6, DOCUMENTS: 7, VISIBILITY: 8, VERIFICATION: 9, PUBLISH: 10,
} as const;

const PURPOSES: { value: string; title: string; body: string }[] = [
  { value: 'SALE', title: 'Sell', body: 'Owner wants to sell the property outright.' },
  { value: 'RENT', title: 'Rent', body: 'Residential or short commercial tenancy, rent paid monthly.' },
  { value: 'LEASE', title: 'Lease', body: 'Longer commercial lease with deposit, lock-in and escalation.' },
];

/**
 * Defined at module scope on purpose. A component declared inside the wizard would
 * be a brand-new component type on every render, so React would unmount and remount
 * each input on every keystroke — which drops the cursor after each character.
 */
function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? '' : 'sm:col-span-2'}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/**
 * Creates a real Property, then a real Listing, then optional documents.
 * Draft-saveable: step 1 already writes the property, so nothing is lost if the
 * browser closes halfway through.
 */
export default function PropertyWizard() {
  const router = useRouter();
  const can = useCan();

  const [step, setStep] = useState(0);
  const [lookups, setLookups] = useState<Record<string, Option[]>>({});
  const [form, setForm] = useState<Record<string, any>>({ areaUnit: 'SQFT', motivation: 'NORMAL', sourceType: 'DIRECT_OWNER' });
  const [listing, setListing] = useState<Record<string, any>>({ listingType: 'SALE', visibility: 'PRIVATE', isNegotiable: true });
  const [photos, setPhotos] = useState<string[]>([]);
  const [documents, setDocuments] = useState<{ kind: string; title: string; storageKey: string }[]>([]);
  const [verification, setVerification] = useState<Record<string, boolean>>({});
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [newOwner, setNewOwner] = useState<{ name: string; phone: string; whatsapp?: string; email?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create an owner without leaving the wizard, then select it. Refreshes the
   * owners lookup so the new record appears in the dropdown rather than the
   * selection pointing at something the list does not contain.
   */
  async function createOwner() {
    if (!newOwner) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOwner.name.trim(),
          phone: newOwner.phone.trim(),
          whatsapp: newOwner.whatsapp?.trim() || undefined,
          email: newOwner.email?.trim() || undefined,
          sourceType: form.sourceType,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not create that owner');

      const created = payload.data ?? payload;
      const refreshed = await fetch('/api/lookups?name=owners').then((r) => r.json()).catch(() => null);
      if (refreshed) setLookups((current) => ({ ...current, owners: refreshed.data ?? refreshed }));

      set('ownerId', created.id);
      setNewOwner(null);
    } catch (problem: any) {
      setError(problem.message ?? 'Could not create that owner');
    } finally {
      setBusy(false);
    }
  }

  const set = (name: string, value: any) => setForm((current) => ({ ...current, [name]: value }));
  const setL = (name: string, value: any) => setListing((current) => ({ ...current, [name]: value }));

  useEffect(() => {
    for (const name of ['categories', 'locations', 'owners', 'users']) {
      fetch(`/api/lookups?name=${name}`)
        .then((r) => r.json())
        .then((payload) => setLookups((current) => ({ ...current, [name]: payload.data ?? [] })))
        .catch(() => undefined);
    }
  }, []);

  /** Duplicate check before the property is written, per the brief. */
  async function checkDuplicates() {
    const search = new URLSearchParams();
    if (form.locationId) search.set('locationId', form.locationId);
    if (form.categoryId) search.set('categoryId', form.categoryId);
    if (form.plotArea || form.builtUpArea) search.set('area', String(form.plotArea ?? form.builtUpArea));
    try {
      const response = await fetch(`/api/properties/duplicates?${search.toString()}`);
      const payload = await response.json();
      setDuplicates(payload.data ?? []);
    } catch {
      setDuplicates([]);
    }
  }

  async function saveProperty() {
    setBusy(true);
    setError(null);
    try {
      // Hotel figures have no columns of their own — a hotel is rare enough that
      // adding six is not worth it — so they are folded into the private notes
      // and stripped from the payload the API would otherwise reject.
      const { acRooms, nonAcRooms, banquetHalls, banquetCapacity, hotelParking, hasRestaurant, ...rest } = form;
      const hotelLines = [
        acRooms && `AC rooms: ${acRooms}`,
        nonAcRooms && `Non-AC rooms: ${nonAcRooms}`,
        banquetHalls && `Banquet halls: ${banquetHalls}`,
        banquetCapacity && `Banquet capacity: ${banquetCapacity}`,
        hotelParking && `Parking spaces: ${hotelParking}`,
        hasRestaurant && 'On-site restaurant: yes',
      ].filter(Boolean);

      const privateNote = [rest.privateNote, hotelLines.length ? hotelLines.join('\n') : null]
        .filter(Boolean)
        .join('\n');

      const body = {
        ...rest,
        // A title is the one thing the record cannot exist without, so fall back
        // to something recognisable rather than blocking the save.
        title: (rest.title ?? '').trim() || `Untitled property — ${new Date().toLocaleDateString('en-IN')}`,
        privateNote: privateNote || undefined,
        media: photos.map((url, index) => ({ url, isCover: index === 0, sortOrder: index })),
      };
      const response = await fetch(propertyId ? `/api/properties/${propertyId}` : '/api/properties', {
        method: propertyId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the property');
      setPropertyId(payload.data.id);
      return payload.data.id as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function saveListing(status: string) {
    const id = propertyId ?? (await saveProperty());
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...listing,
        propertyId: id,
        status,
        // Falls back through the internal title to a placeholder, so a listing is
        // never blocked purely for want of a public headline.
        publicTitle:
          (listing.publicTitle || form.title || '').trim() ||
          `Property in ${site.city}`,
      };
      const response = await fetch(listingId ? `/api/listings/${listingId}` : '/api/listings', {
        method: listingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the listing');
      setListingId(payload.data.id);
      setPublicId(payload.data.publicId);
      return payload.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function saveDocuments(id: string) {
    for (const document of documents) {
      if (!document.title || !document.storageKey) continue;
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...document, propertyId: id }),
      }).catch(() => undefined);
    }
  }

  async function next() {
    try {
      if (step === S.BASICS) await checkDuplicates();
      if (step === S.FINANCIALS) await saveProperty();
      if (step === S.DOCUMENTS && propertyId) await saveDocuments(propertyId);
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    } catch {
      /* the error is already on screen */
    }
  }

  async function finish(status: 'DRAFT' | 'PUBLISHED' | 'COMING_SOON') {
    try {
      await saveProperty();
      const saved = await saveListing(status);
      if (propertyId && Object.values(verification).some(Boolean)) {
        // Verification is recorded against the property, not the listing.
        await fetch(`/api/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privateNotes: [form.privateNotes, 'Verification checklist completed at entry.'].filter(Boolean).join('\n') }),
        }).catch(() => undefined);
      }
      router.push(`/crm/properties/${saved.propertyId ?? propertyId}`);
      router.refresh();
    } catch {
      /* the error is already on screen */
    }
  }

  const options = (name: string) => lookups[name] ?? [];

  /**
   * Which detail fields make sense for the chosen category. Before a category is
   * picked everything shows, so nothing is hidden from someone who skipped the
   * field. Bedrooms on a warehouse and frontage on a flat were only ever noise.
   */
  const category = options('categories').find((c) => c.value === form.categoryId);

  /**
   * Ask exactly what the public sell and rent forms ask for this property type,
   * using the same FIELD_TYPES rules rather than a second set that could drift
   * out of step with them. Before a category is chosen everything shows.
   */
  const ownerType = ownerTypeFor(category?.label?.split(' · ')[0]);
  const applies = (list: string[]) => !ownerType || list.includes(ownerType);
  const shows = {
    plotArea: applies(FIELD_TYPES.plotArea),
    builtUpArea: applies(FIELD_TYPES.builtUpArea),
    superBuiltArea: applies(FIELD_TYPES.superBuiltArea),
    carpetArea: applies(FIELD_TYPES.carpetArea),
    constructionYear: applies(FIELD_TYPES.constructionYear),
    bedrooms: applies(FIELD_TYPES.bedrooms),
    floors: applies(FIELD_TYPES.floors),
    parking: applies(FIELD_TYPES.parking),
    furnishing: applies(FIELD_TYPES.furnishing),
    hotel: applies(FIELD_TYPES.hotelRooms) && !!ownerType,
  };
  return (
    <div>
      <header>
        <h1 className="display text-2xl">Add a property</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ten steps. The property is saved after step four, so you can stop and come back.
        </p>
      </header>

      {/* Progress */}
      <ol className="mt-6 flex flex-wrap gap-1.5">
        {STEPS.map((name, index) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => index <= step && setStep(index)}
              className={`rounded-[3px] border px-2.5 py-1 text-xs ${
                index === step
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                  : index < step
                    ? 'text-[var(--ink-soft)]'
                    : 'text-[var(--muted)] opacity-60'
              }`}
            >
              <span className="mono">{index + 1}</span> {name}
            </button>
          </li>
        ))}
      </ol>

      <div className="plate mt-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {step === S.PURPOSE && (
            <div className="sm:col-span-2">
              <p className="text-[var(--ink-soft)]">
                What is the owner doing with this property? The rest of the form adapts to your answer.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {PURPOSES.map((purpose) => {
                  const active = listing.listingType === purpose.value;
                  return (
                    <button
                      key={purpose.value}
                      type="button"
                      onClick={() => setL('listingType', purpose.value)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-sm'
                          : 'border-[var(--line)] hover:border-[var(--brand)]'
                      }`}
                    >
                      <span className="display block text-lg text-[var(--navy)]">{purpose.title}</span>
                      <span className="mt-1 block text-sm text-[var(--muted)]">{purpose.body}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === S.BASICS && (
            <>
              <Field label="Internal title">
                <input className="field" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="3BHK flat in Napier Town" />
              </Field>
              <Field label="Category" half>
                <select className="field" value={form.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">Select</option>
                  {options('categories').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Source" half>
                <select className="field" value={form.sourceType ?? ''} onChange={(e) => set('sourceType', e.target.value)}>
                  {toOptions(SOURCE_TYPES).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Description">
                <textarea className="field min-h-[90px]" value={form.summary ?? ''} onChange={(e) => set('summary', e.target.value)} />
              </Field>
            </>
          )}

          {step === S.LOCATION && (
            <>
              <Field label="Locality" half>
                <select className="field" value={form.locationId ?? ''} onChange={(e) => set('locationId', e.target.value)}>
                  <option value="">Select</option>
                  {options('locations').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Colony" half><input className="field" value={form.colony ?? ''} onChange={(e) => set('colony', e.target.value)} /></Field>
              <Field label="Landmark" half><input className="field" value={form.landmark ?? ''} onChange={(e) => set('landmark', e.target.value)} /></Field>
              <Field label="Road" half><input className="field" value={form.road ?? ''} onChange={(e) => set('road', e.target.value)} /></Field>
              <Field label="Ward" half><input className="field" value={form.ward ?? ''} onChange={(e) => set('ward', e.target.value)} /></Field>
              <Field label="PIN code" half><input className="field" value={form.pincode ?? ''} onChange={(e) => set('pincode', e.target.value)} /></Field>
              <Field label="Exact address (private, never published)">
                <input className="field" value={form.addressLine ?? ''} onChange={(e) => set('addressLine', e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <LocationPicker
                  label="Location on the map (private)"
                  value={
                    form.mapLink ??
                    (form.latitude && form.longitude ? `${form.latitude},${form.longitude}` : '')
                  }
                  onChange={(next) => {
                    set('mapLink', next);
                    // Keep the coordinate columns in step, so reports and the map link agree.
                    const match = next.match(/(-?\d{1,3}\.\d+)[, ]+(-?\d{1,3}\.\d+)/);
                    set('latitude', match ? match[1] : '');
                    set('longitude', match ? match[2] : '');
                  }}
                />
              </div>
            </>
          )}

          {step === S.DETAILS && (
            <>
              {shows.plotArea && (<Field label="Plot area" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.plotArea ?? ''} onChange={(e) => set('plotArea', e.target.value)} /></Field>)}
              {shows.builtUpArea && (<Field label="Built-up area" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.builtUpArea ?? ''} onChange={(e) => set('builtUpArea', e.target.value)} /></Field>)}
              {shows.carpetArea && (<Field label="Carpet area" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.carpetArea ?? ''} onChange={(e) => set('carpetArea', e.target.value)} /></Field>)}
              <Field label="Area unit" half>
                <select className="field" value={form.areaUnit} onChange={(e) => set('areaUnit', e.target.value)}>
                  {toOptions(AREA_UNITS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              {shows.bedrooms && (<Field label="Bedrooms" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.bedrooms ?? ''} onChange={(e) => set('bedrooms', e.target.value)} /></Field>)}
              {shows.bedrooms && (<Field label="Bathrooms" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.bathrooms ?? ''} onChange={(e) => set('bathrooms', e.target.value)} /></Field>)}
              {shows.parking && (<Field label="Covered parking" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.parkingCovered ?? ''} onChange={(e) => set('parkingCovered', e.target.value)} /></Field>)}
              {shows.furnishing && (<Field label="Furnishing" half>
                <select className="field" value={form.furnishing ?? ''} onChange={(e) => set('furnishing', e.target.value)}>
                  <option value="">Not set</option>
                  {toOptions(FURNISHINGS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>)}
              <Field label="Facing" half>
                <select className="field" value={form.facing ?? ''} onChange={(e) => set('facing', e.target.value)}>
                  <option value="">Not set</option>
                  {toOptions(FACINGS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              {shows.plotArea && (<Field label="Frontage (ft)" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.frontageFeet ?? ''} onChange={(e) => set('frontageFeet', e.target.value)} /></Field>)}
              <Field label="Road width (ft)" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.roadWidthFeet ?? ''} onChange={(e) => set('roadWidthFeet', e.target.value)} /></Field>
              {shows.constructionYear && (<Field label="Year built" half><input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.constructionYear ?? ''} onChange={(e) => set('constructionYear', e.target.value)} /></Field>)}
              {category && (
                <p className="text-sm text-[var(--muted)] sm:col-span-2">
                  Showing the fields that apply to {category.label.split(' · ')[0]}. Change the category on the
                  Basics step to see a different set.
                </p>
              )}
              {shows.superBuiltArea && (
                <Field label="Super built-up area" half>
                  <input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.superBuiltArea ?? ''} onChange={(e) => set('superBuiltArea', e.target.value)} />
                </Field>
              )}
              {shows.floors && (
                <Field label="Floor number" half>
                  <input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.floorNumber ?? ''} onChange={(e) => set('floorNumber', e.target.value)} />
                </Field>
              )}
              {shows.floors && (
                <Field label="Total floors" half>
                  <input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.totalFloors ?? ''} onChange={(e) => set('totalFloors', e.target.value)} />
                </Field>
              )}
              {shows.hotel && (
                <div className="sm:col-span-2">
                  <p className="label">Hotel configuration</p>
                  <p className="text-sm text-[var(--muted)]">
                    Rooms and facilities are recorded in the private notes below, since a hotel does not fit the
                    bedroom fields used for homes.
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className="label">AC rooms</span>
                      <input type="number" className="field" value={form.acRooms ?? ''} onChange={(e) => set('acRooms', e.target.value)} /></label>
                    <label className="block"><span className="label">Non-AC rooms</span>
                      <input type="number" className="field" value={form.nonAcRooms ?? ''} onChange={(e) => set('nonAcRooms', e.target.value)} /></label>
                    <label className="block"><span className="label">Banquet halls</span>
                      <input type="number" className="field" value={form.banquetHalls ?? ''} onChange={(e) => set('banquetHalls', e.target.value)} /></label>
                    <label className="block"><span className="label">Banquet capacity</span>
                      <input type="number" className="field" value={form.banquetCapacity ?? ''} onChange={(e) => set('banquetCapacity', e.target.value)} /></label>
                    <label className="block"><span className="label">Parking spaces</span>
                      <input type="number" className="field" value={form.hotelParking ?? ''} onChange={(e) => set('hotelParking', e.target.value)} /></label>
                    <label className="flex items-center gap-2 pt-6 text-sm">
                      <input type="checkbox" checked={!!form.hasRestaurant} onChange={(e) => set('hasRestaurant', e.target.checked)} />
                      On-site restaurant
                    </label>
                  </div>
                </div>
              )}
              <Field label="Features">
                <div className="flex flex-wrap gap-2 rounded-[3px] border p-2">
                  {AMENITY_OPTIONS.map((amenity) => {
                    const list: string[] = form.amenities ?? [];
                    return (
                      <label key={amenity} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={list.includes(amenity)}
                          onChange={(e) => set('amenities', e.target.checked ? [...list, amenity] : list.filter((a) => a !== amenity))}
                        />
                        {amenity}
                      </label>
                    );
                  })}
                </div>
              </Field>
              <Field label="Suitable for (commercial)">
                <div className="flex flex-wrap gap-2 rounded-[3px] border p-2">
                  {BUSINESS_SUITABILITY.map((use) => {
                    const list: string[] = form.suitableFor ?? [];
                    return (
                      <label key={use} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={list.includes(use)}
                          onChange={(e) => set('suitableFor', e.target.checked ? [...list, use] : list.filter((u) => u !== use))}
                        />
                        {use}
                      </label>
                    );
                  })}
                </div>
              </Field>
            </>
          )}

          {step === S.FINANCIALS && (
            <>
              <Field label="Asking price / monthly rent (₹)" half>
                <input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={listing.price ?? ''} onChange={(e) => setL('price', e.target.value)} />
              </Field>
              <Field label="Security deposit (₹)" half>
                <input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={listing.securityDeposit ?? ''} onChange={(e) => setL('securityDeposit', e.target.value)} />
              </Field>
              <Field label="Owner expectation (₹) — private" half>
                <input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.ownerExpectation ?? ''} onChange={(e) => set('ownerExpectation', e.target.value)} />
              </Field>
              <Field label="Minimum acceptable (₹) — private" half>
                <input type="number" onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.minimumPrice ?? ''} onChange={(e) => set('minimumPrice', e.target.value)} />
              </Field>
              <Field label="Owner motivation — private" half>
                <select className="field" value={form.motivation} onChange={(e) => set('motivation', e.target.value)}>
                  {toOptions(MOTIVATIONS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Internal score (0-100) — private" half>
                <input type="number" min={0} max={100} onWheel={(e) => (e.target as HTMLInputElement).blur()} className="field" value={form.internalScore ?? ''} onChange={(e) => set('internalScore', e.target.value)} />
              </Field>
              <Field label="Negotiation notes — private">
                <textarea className="field" value={form.negotiationNote ?? ''} onChange={(e) => set('negotiationNote', e.target.value)} />
              </Field>
              {listing.price && form.minimumPrice && Number(form.minimumPrice) > Number(listing.price) && (
                <p className="text-sm text-[var(--danger)] sm:col-span-2">
                  The minimum ({inr(form.minimumPrice)}) is above the asking price ({inr(listing.price)}). Check the figures.
                </p>
              )}
            </>
          )}

          {step === S.OWNER && (
            <>
              <Field label="Owner record" half>
                <div className="flex gap-2">
                  <select className="field min-w-0 flex-1" value={form.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value)}>
                    <option value="">Not linked yet</option>
                    {options('owners').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button type="button" className="btn btn-ghost shrink-0" onClick={() => setNewOwner({ name: '', phone: '' })}>
                    + New
                  </button>
                </div>
              </Field>
              {newOwner && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2,#f7f9fc)] p-4 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[var(--navy)]">New owner</p>
                    <button type="button" className="btn btn-ghost" onClick={() => setNewOwner(null)}>Cancel</button>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Name and mobile are enough to create the record; the rest can be filled in on the Owners
                    screen later.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="label">Name</span>
                      <input className="field" value={newOwner.name} onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="label">Mobile</span>
                      <input className="field" inputMode="tel" value={newOwner.phone} onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="label">WhatsApp (optional)</span>
                      <input className="field" inputMode="tel" value={newOwner.whatsapp ?? ''} onChange={(e) => setNewOwner({ ...newOwner, whatsapp: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="label">Email (optional)</span>
                      <input className="field" value={newOwner.email ?? ''} onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })} />
                    </label>
                  </div>
                  <button type="button" className="btn btn-primary mt-3" disabled={busy || !newOwner.name.trim() || !newOwner.phone.trim()} onClick={createOwner}>
                    {busy ? 'Saving…' : 'Create and link owner'}
                  </button>
                </div>
              )}

              <Field label="Assigned to" half>
                <select className="field" value={form.assignedToId ?? ''} onChange={(e) => set('assignedToId', e.target.value)}>
                  <option value="">Me</option>
                  {options('users').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Source detail" half>
                <input className="field" value={form.sourceDetail ?? ''} onChange={(e) => set('sourceDetail', e.target.value)} />
              </Field>
              <Field label="Private notes">
                <textarea className="field" value={form.privateNotes ?? ''} onChange={(e) => set('privateNotes', e.target.value)} />
              </Field>
              <p className="text-xs text-[var(--muted)] sm:col-span-2">
                Owners are managed on their own screen so one owner can hold several properties. Add the owner there first if they are not in this list.
              </p>
            </>
          )}

          {step === S.PHOTOS && <PhotoUploader urls={photos} onChange={setPhotos} />}

          {step === S.DOCUMENTS && (
            <>
              <div className="sm:col-span-2 space-y-3">
                {documents.map((document, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-3">
                    <select
                      className="field"
                      value={document.kind}
                      onChange={(e) => setDocuments((list) => list.map((d, i) => (i === index ? { ...d, kind: e.target.value } : d)))}
                    >
                      {['REGISTRY', 'SALE_DEED', 'KHASRA', 'B1', 'DIVERSION', 'TAX_RECEIPT', 'NOC', 'MAP', 'BUILDING_PERMISSION', 'OTHER'].map((kind) => (
                        <option key={kind} value={kind}>{kind.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <input
                      className="field"
                      placeholder="Title"
                      value={document.title}
                      onChange={(e) => setDocuments((list) => list.map((d, i) => (i === index ? { ...d, title: e.target.value } : d)))}
                    />
                    <input
                      className="field"
                      placeholder="Storage key or URL"
                      value={document.storageKey}
                      onChange={(e) => setDocuments((list) => list.map((d, i) => (i === index ? { ...d, storageKey: e.target.value } : d)))}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDocuments((list) => [...list, { kind: 'REGISTRY', title: '', storageKey: '' }])}
                >
                  Add a document
                </button>
                <p className="text-xs text-[var(--muted)]">
                  Documents are private. They are served only through an authorised route that logs every access.
                </p>
              </div>
            </>
          )}

          {step === S.VISIBILITY && (
            <>
              <Field label="List as" half>
                <select className="field" value={listing.listingType} onChange={(e) => setL('listingType', e.target.value)}>
                  {toOptions(LISTING_TYPES).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Visibility" half>
                <select className="field" value={listing.visibility} onChange={(e) => setL('visibility', e.target.value)}>
                  {toOptions(VISIBILITIES).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Public title">
                <input className="field" value={listing.publicTitle ?? form.title ?? ''} onChange={(e) => setL('publicTitle', e.target.value)} />
              </Field>
              <Field label="Public description">
                <textarea className="field min-h-[100px]" value={listing.publicDescription ?? form.summary ?? ''} onChange={(e) => setL('publicDescription', e.target.value)} />
              </Field>
              <Field label="Public locality (shown instead of the exact one)" half>
                <select className="field" value={listing.publicLocationId ?? ''} onChange={(e) => setL('publicLocationId', e.target.value)}>
                  <option value="">Same as the property</option>
                  {options('locations').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Price on request" half>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!listing.isPriceOnRequest} onChange={(e) => setL('isPriceOnRequest', e.target.checked)} />
                  Hide the figure publicly
                </label>
              </Field>
            </>
          )}

          {step === S.VERIFICATION && (
            <div className="sm:col-span-2 space-y-3">
              <p className="text-sm text-[var(--muted)]">
                HN Verified is our own check, not a title guarantee. Tick only what has actually been done.
              </p>
              {[
                ['ownerIdSeen', 'Owner identity seen'],
                ['siteVisited', 'Property visited by our team'],
                ['docsReceived', 'Ownership documents received'],
                ['photosOurs', 'Photographs taken by us'],
                ['availability', 'Availability confirmed with the owner'],
              ].map(([key, text]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!verification[key]}
                    onChange={(e) => setVerification((current) => ({ ...current, [key]: e.target.checked }))}
                  />
                  {text}
                </label>
              ))}
              {!can('property.verify') && (
                <p className="text-xs text-[var(--muted)]">
                  Your role cannot mark a property verified — a manager will complete this step.
                </p>
              )}
            </div>
          )}

          {step === S.PUBLISH && (
            <div className="sm:col-span-2 space-y-4">
              <div>
                <p className="eyebrow">Summary</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[
                    ['Title', form.title],
                    ['Price', listing.price ? inr(listing.price) : '—'],
                    ['List as', listing.listingType],
                    ['Visibility', listing.visibility],
                    ['Photos', String(photos.length)],
                    ['Documents', String(documents.length)],
                  ].map(([key, value]) => (
                    <div key={key as string} className="flex justify-between border-b pb-1.5 text-sm">
                      <dt className="text-[var(--muted)]">{key}</dt>
                      <dd className="font-medium">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => finish('DRAFT')}>Save as draft</button>
                {can('property.publish') && (
                  <>
                    <button type="button" className="btn btn-brass" disabled={busy} onClick={() => finish('COMING_SOON')}>Save as coming soon</button>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => finish('PUBLISHED')}>Publish now</button>
                  </>
                )}
              </div>
              {publicId && <p className="mono text-sm">Public ID: {publicId}</p>}
            </div>
          )}
        </div>

        {duplicates.length > 0 && step === S.LOCATION && (
          <div className="mt-5 rounded border border-[var(--brass)] bg-[var(--brass-soft)] p-4">
            <p className="text-sm font-medium">Possible duplicates already on file</p>
            <ul className="mt-2 space-y-1 text-sm">
              {duplicates.slice(0, 5).map((duplicate) => (
                <li key={duplicate.id} className="mono text-xs">
                  {duplicate.code} — {duplicate.title} ({duplicate.location?.name})
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--muted)]">Continue if this is genuinely a different property.</p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <button type="button" className="btn btn-ghost" disabled={step === S.PURPOSE} onClick={() => setStep((s) => s - 1)}>Back</button>
          <p className="mono text-xs text-[var(--muted)]">Step {step + 1} of {STEPS.length}</p>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={next}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}
