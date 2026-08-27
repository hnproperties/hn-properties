'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * Google Maps location picker.
 *
 * Uses the Places autocomplete element, which is Google's current widget — the
 * older `places.Autocomplete` is closed to projects created after March 2025, so
 * building on it would have failed on a new key. Autocomplete tolerates typos and
 * partial names ("Katnga" finds Katanga), which the OpenStreetMap fallback does not.
 *
 * Renders nothing unless NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set; the caller falls
 * back to the free map in that case.
 */

const JABALPUR = { lat: 23.1815, lng: 79.9864 };

let loading: Promise<any> | null = null;

function loadGoogleMaps(key: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('server'));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    // Google calls this when the key is rejected — a wrong key, or billing not enabled.
    (window as any).gm_authFailure = () => reject(new Error('auth'));

    /*
     * `loading=async` requires a callback: Google's bootstrap resolves through it
     * rather than through the script's own load event. Without one the loader can
     * fail before anything is initialised, which looks like a network error.
     */
    const callbackName = '__hnGoogleMapsReady';
    (window as any)[callbackName] = () => resolve((window as any).google);

    const params = new URLSearchParams({
      key,
      libraries: 'places,marker',
      v: 'weekly',
      language: 'en',
      region: 'IN',
      loading: 'async',
      callback: callbackName,
    });

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('load'));
    document.head.appendChild(script);

    // If neither the callback nor an error arrives, say so rather than hanging.
    setTimeout(() => reject(new Error('timeout')), 12000);
  });

  // A failed attempt must not poison later ones.
  loading.catch(() => {
    loading = null;
  });

  return loading;
}

export default function GoogleLocationPicker({
  value,
  onChange,
  onUnavailable,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Called if the key is missing or refused, so the caller can fall back. */
  onUnavailable: (reason: string) => void;
}) {
  const mapHost = useRef<HTMLDivElement>(null);
  const searchHost = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const coordinates = value.match(/(-?\d{1,3}\.\d+)[, ]+(-?\d{1,3}\.\d+)/);
  const chosen = coordinates ? { lat: Number(coordinates[1]), lng: Number(coordinates[2]) } : null;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.warn('[maps] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set at runtime — restart the dev server after editing .env');
      onUnavailable('no-key');
      return;
    }

    let cancelled = false;

    loadGoogleMaps(key)
      .then(async (google) => {
        if (cancelled || !mapHost.current) return;

        const centre = chosen ?? JABALPUR;

        const instance = new google.maps.Map(mapHost.current, {
          center: centre,
          zoom: chosen ? 17 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const pin = new google.maps.Marker({
          position: centre,
          map: instance,
          draggable: true,
          title: 'Drag to the exact spot',
        });

        const geocoder = new google.maps.Geocoder();

        /** Records a position and shows the address Google has for it. */
        const commit = (position: { lat: number; lng: number }, label?: string) => {
          onChange(`${position.lat.toFixed(6)},${position.lng.toFixed(6)}`);
          if (label) {
            setAddress(label);
            return;
          }
          geocoder
            .geocode({ location: position })
            .then((result: any) => setAddress(result.results?.[0]?.formatted_address ?? null))
            .catch(() => setAddress(null));
        };

        pin.addListener('dragend', () => {
          const position = pin.getPosition();
          commit({ lat: position.lat(), lng: position.lng() });
        });

        instance.addListener('click', (event: any) => {
          pin.setPosition(event.latLng);
          commit({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });

        map.current = instance;
        marker.current = pin;

        // Places search box, biased towards Jabalpur but not restricted to it.
        const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');
        if (cancelled || !searchHost.current) return;

        const autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ['in'],
          locationBias: { center: JABALPUR, radius: 40000 },
        });
        autocomplete.style.width = '100%';
        searchHost.current.replaceChildren(autocomplete);

        autocomplete.addEventListener('gmp-select', async (event: any) => {
          const place = event.placePrediction.toPlace();
          await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
          const location = place.location;
          if (!location) return;

          const position = { lat: location.lat(), lng: location.lng() };
          instance.setCenter(position);
          instance.setZoom(17);
          pin.setPosition(position);
          commit(position, place.formattedAddress ?? place.displayName ?? undefined);
        });

        setReady(true);
      })
      .catch((error) => {
        console.warn('[maps] Google Maps could not start:', error?.message ?? error);
        if (!cancelled) {
          const reason = error?.message;
          onUnavailable(reason === 'auth' ? 'auth' : reason === 'timeout' ? 'timeout' : 'load');
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/*
        No overflow-hidden here: the suggestion list renders below the input and
        was being clipped by it. relative + z-index keeps the list above the map
        that follows, which would otherwise paint over it.
      */}
      <div
        ref={searchHost}
        className="relative z-30 min-h-[42px] rounded-lg border border-[var(--line)] bg-white [color-scheme:light]"
        style={
          {
            '--gmp-mat-color-surface': '#ffffff',
            '--gmp-mat-color-on-surface': '#10233c',
            '--gmp-mat-color-on-surface-variant': '#405469',
            '--gmp-mat-color-outline-decorative': '#d8dee7',
            '--gmp-mat-color-primary': '#1583b5',
            '--gmp-mat-color-on-primary': '#ffffff',
          } as CSSProperties
        }
      />

      <div ref={mapHost} className="mt-3 h-[320px] w-full overflow-hidden rounded-lg border bg-[var(--paper)]" />

      <p className="mt-2 text-xs text-[var(--muted)]">
        {ready
          ? 'Search for a locality, or tap the map and drag the pin to the exact spot.'
          : 'Loading the map…'}
      </p>

      {address && (
        <p className="mt-2 rounded-lg bg-[var(--paper)] px-3 py-2 text-sm">
          📍 {address}
        </p>
      )}
    </div>
  );
}
