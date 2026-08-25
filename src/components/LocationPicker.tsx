'use client';

import { useEffect, useRef, useState } from 'react';
import GoogleLocationPicker from './GoogleLocationPicker';
import { fuzzySearch } from '@/lib/fuzzy';

type Props = {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  /** Your own localities, searched before anything external. */
  localities?: { value: string; label: string }[];
};

/**
 * Location picker for the owner forms.
 *
 * Opens a map in a panel on the same page: search for a place by name, or drag the
 * pin to the exact spot. The map is OpenStreetMap through Leaflet, loaded from a CDN
 * only when the panel is opened — Google's own embed cannot accept a dragged pin
 * without a paid API key, and this needs neither key nor billing account.
 *
 * The value stored is "lat,lng", which the CRM turns into a Google Maps link.
 */
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Jabalpur, so the map opens somewhere useful rather than mid-ocean.
const DEFAULT_CENTRE: [number, number] = [23.1815, 79.9864];

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const existing = (window as any).L;
    if (existing) return resolve(existing);

    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error('map failed to load'));
    document.body.appendChild(script);
  });
}

export default function LocationPicker({ value, onChange, label = 'Property location (optional)', localities = [] }: Props) {
  const [open, setOpen] = useState(false);
  // Google is used when a key is configured; the free map covers everyone else.
  const [useGoogle, setUseGoogle] = useState(Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY));
  const [googleProblem, setGoogleProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  // Matches from the wider geocoder, shown when our own tables have nothing.
  const [wider, setWider] = useState<{ name: string; latitude: number; longitude: number }[]>([]);
  // Suggestions come from the database — curated localities plus imported
  // landmarks — so a hospital or mall is findable, not just a colony name.
  const [suggestions, setSuggestions] = useState<
    { id: string; name: string; kind: string; latitude: number | null; longitude: number | null }[]
  >([]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/public/places?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((payload) => setSuggestions(payload.data ?? []))
        .catch(() => {
          // Offline or the route is unavailable: fall back to the list we were given.
          setSuggestions(
            fuzzySearch(term, localities, (l) => l.label, 5).map((l) => ({
              id: l.value,
              name: l.label,
              kind: 'locality',
              latitude: null,
              longitude: null,
            })),
          );
        });
    }, 180);

    return () => clearTimeout(timer);
  }, [search, localities]);

  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);

  const coordinates = value.match(/(-?\d{1,3}\.\d+)[, ]+(-?\d{1,3}\.\d+)/);
  const chosen: [number, number] | null = coordinates
    ? [Number(coordinates[1]), Number(coordinates[2])]
    : null;

  // Build the map when the panel opens.
  useEffect(() => {
    if (useGoogle || !open || !container.current || map.current) return;

    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !container.current) return;

        const centre = chosen ?? DEFAULT_CENTRE;
        const instance = L.map(container.current).setView(centre, chosen ? 16 : 13);

        /*
         * MapTiler's street style is clearer than the default OpenStreetMap raster —
         * better label spacing and contrast at the zoom levels people use here. It
         * is optional: without a key the plain OSM tiles are used, which work fine.
         */
        const maptiler = process.env.NEXT_PUBLIC_MAPTILER_KEY;

        if (maptiler) {
          L.tileLayer(
            `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptiler}`,
            {
              maxZoom: 20,
              tileSize: 512,
              zoomOffset: -1,
              attribution: '© MapTiler © OpenStreetMap contributors',
            },
          ).addTo(instance);
        } else {
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
          }).addTo(instance);
        }

        const pin = L.marker(centre, { draggable: true }).addTo(instance);
        pin.on('dragend', () => {
          const { lat, lng } = pin.getLatLng();
          onChange(`${lat.toFixed(6)},${lng.toFixed(6)}`);
        });

        // Tapping the map moves the pin — easier than dragging on a phone.
        instance.on('click', (event: any) => {
          pin.setLatLng(event.latlng);
          onChange(`${event.latlng.lat.toFixed(6)},${event.latlng.lng.toFixed(6)}`);
        });

        map.current = instance;
        marker.current = pin;

        // The panel animates open; the map needs its size after that settles.
        setTimeout(() => instance.invalidateSize(), 200);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tear the map down when the panel closes, so reopening rebuilds cleanly.
  useEffect(() => {
    if (open) return;
    map.current?.remove?.();
    map.current = null;
    marker.current = null;
  }, [open]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage('This browser cannot share a location — use the map instead.');
      return;
    }
    setBusy(true);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setBusy(false);
        setMessage('Location captured.');
        if (map.current && marker.current) {
          marker.current.setLatLng([latitude, longitude]);
          map.current.setView([latitude, longitude], 17);
        }
      },
      (error) => {
        setBusy(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was declined — pick the spot on the map instead.'
            : 'Could not read your location — pick the spot on the map instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  /**
   * Wider search, for anything not in our own tables.
   *
   * Photon is a geocoder built for autocomplete: it tolerates misspellings and
   * partial words, where the plain Nominatim search matched literally. No key, no
   * account. Results are biased towards Jabalpur but not restricted to it.
   */
  async function findPlace(term = search) {
    if (!term.trim()) return;

    setSearching(true);
    setMessage(null);
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&lat=23.1815&lon=79.9864&limit=6&lang=en`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const payload = await response.json();

      const found = (payload.features ?? [])
        .map((feature: any) => {
          const [longitude, latitude] = feature.geometry?.coordinates ?? [];
          const properties = feature.properties ?? {};
          const parts = [properties.name, properties.district ?? properties.city, properties.state].filter(Boolean);
          return { name: parts.join(', '), latitude, longitude };
        })
        .filter((place: any) => place.latitude && place.longitude);

      if (!found.length) {
        setMessage('Not found by name — drag the pin to the spot instead.');
        setWider([]);
        return;
      }

      setWider(found);
      moveTo(found[0].latitude, found[0].longitude);
    } catch {
      setMessage('Search is unavailable — drag the pin instead.');
    } finally {
      setSearching(false);
    }
  }

  /** Puts the pin somewhere and centres the map on it. */
  function moveTo(latitude: number, longitude: number) {
    onChange(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
    if (map.current && marker.current) {
      marker.current.setLatLng([latitude, longitude]);
      map.current.setView([latitude, longitude], 16);
    }
  }

  return (
    <div>
      <span className="label">{label}</span>

      <div className="rounded-xl border p-4">
        <p className="text-sm text-[var(--muted)]">Helps our team find the property. Never shown on the website.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary py-2.5 text-sm" onClick={() => setOpen((v) => !v)}>
            🗺️ {open ? 'Close map' : 'Pick on map'}
          </button>

          <button type="button" className="btn btn-ghost py-2.5 text-sm" disabled={busy} onClick={useCurrentLocation}>
            {busy ? 'Getting location…' : '📍 Use my current location'}
          </button>

          {value && (
            <button
              type="button"
              className="btn btn-ghost py-2.5 text-sm text-[var(--danger)]"
              onClick={() => {
                onChange('');
                setMessage(null);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {open && (
          <div className="mt-3">
            {/* Not a <form>: this sits inside the page's own form, and nesting them
                is invalid HTML — the browser would submit the outer one instead. */}
            <div className={`flex gap-2 ${useGoogle ? 'hidden' : ''}`}>
              <input
                className="field py-2"
                placeholder="Search a locality or landmark"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault(); // Enter must search, not submit the property form
                  e.stopPropagation();
                  findPlace();
                }}
              />
              <button
                type="button"
                className="btn btn-ghost py-2 text-sm"
                disabled={searching}
                onClick={() => findPlace()}
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>

            {wider.length > 0 && suggestions.length === 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {wider.map((place) => (
                  <button
                    key={`${place.name}-${place.latitude}`}
                    type="button"
                    className="rounded-full border px-3 py-1 text-sm transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    onClick={() => moveTo(place.latitude, place.longitude)}
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    className="rounded-full border px-3 py-1 text-sm transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    onClick={() => {
                      setSearch(place.name);

                      // Known coordinates go straight to the pin; otherwise search by name.
                      if (place.latitude && place.longitude) {
                        onChange(`${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`);
                        if (map.current && marker.current) {
                          marker.current.setLatLng([place.latitude, place.longitude]);
                          map.current.setView([place.latitude, place.longitude], 16);
                        }
                        setMessage(null);
                      } else {
                        findPlace(place.name);
                      }
                    }}
                  >
                    {place.name}
                    {place.kind === 'landmark' && <span className="ml-1 text-xs text-[var(--muted)]">· landmark</span>}
                  </button>
                ))}
              </div>
            )}

            {failed ? (
              <p className="mt-3 rounded-lg bg-[var(--paper)] p-3 text-sm text-[var(--muted)]">
                The map could not load. Use <span className="font-medium">Use my current location</span>, or paste a
                Google Maps link below.
              </p>
            ) : useGoogle ? (
              <GoogleLocationPicker
                value={value}
                onChange={onChange}
                onUnavailable={(reason) => {
                  setGoogleProblem(reason);
                  setUseGoogle(false);
                }}
              />
            ) : (
              <>
                <div ref={container} className="mt-3 h-[300px] w-full overflow-hidden rounded-lg border" />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Tap the map or drag the pin to the exact spot. Search covers the main localities.
                </p>

                {/* Only shown while developing: says why Google was not used. */}
                {googleProblem && process.env.NODE_ENV !== 'production' && (
                  <p className="mt-2 rounded-lg bg-[#fef6e7] px-3 py-2 text-xs text-[#a5690a]">
                    {googleProblem === 'no-key'
                      ? 'Google Maps key not found at runtime. Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is in .env (not .env.example) and restart the dev server.'
                      : googleProblem === 'auth'
                        ? 'Google refused the key. Usually billing is not enabled on the project, or the website restriction does not include http://localhost:3000/*'
                        : googleProblem === 'timeout'
                          ? 'Google Maps did not respond. Check the connection, and whether an ad blocker is blocking maps.googleapis.com'
                          : 'Google Maps script could not load — often an ad blocker, or Maps JavaScript API not enabled on the project. The browser console has the exact error.'}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {(failed || (value && !chosen)) && (
          <input
            className="field mt-3 py-2"
            placeholder="Or paste a Google Maps link"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {message && <p className="mt-3 text-sm font-medium text-[var(--brand)]">{message}</p>}

        {chosen && !open && (
          <p className="mono mt-3 rounded-lg bg-[var(--paper)] px-3 py-2 text-xs text-[var(--muted)]">
            📍 {chosen[0].toFixed(6)}, {chosen[1].toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
