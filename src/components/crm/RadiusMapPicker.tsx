'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, JABALPUR } from '@/lib/google-maps-loader';

/**
 * A compact, click-to-drop-a-pin map for the "search properties near a point"
 * filter. Deliberately simpler than GoogleLocationPicker — no address search box,
 * since staff using this already know roughly where they're pointing (they're
 * looking at the map, not typing an address) — just a map, a draggable pin, and a
 * circle showing the radius that'll actually be searched, so it's obvious before
 * hitting Apply whether the circle covers the right area.
 */
export default function RadiusMapPicker({
  lat,
  lng,
  radiusKm,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const circle = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  // Init once.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      setStatus('unavailable');
      return;
    }
    let cancelled = false;

    loadGoogleMaps(key)
      .then((google) => {
        if (cancelled || !host.current) return;
        const center = lat != null && lng != null ? { lat, lng } : JABALPUR;

        const instance = new google.maps.Map(host.current, {
          center,
          zoom: lat != null ? 14 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        map.current = instance;

        const markerInstance = new google.maps.Marker({
          position: center,
          map: instance,
          draggable: true,
        });
        marker.current = markerInstance;

        const circleInstance = new google.maps.Circle({
          map: instance,
          center,
          radius: radiusKm * 1000,
          strokeColor: '#1583b5',
          strokeOpacity: 0.7,
          strokeWeight: 2,
          fillColor: '#1583b5',
          fillOpacity: 0.12,
        });
        circle.current = circleInstance;

        const commit = (position: any) => {
          const point = { lat: position.lat(), lng: position.lng() };
          markerInstance.setPosition(point);
          circleInstance.setCenter(point);
          onChange(point.lat, point.lng);
        };

        instance.addListener('click', (e: any) => e.latLng && commit(e.latLng));
        markerInstance.addListener('dragend', () => commit(markerInstance.getPosition()));

        // No pin chosen yet — commit the default centre immediately so the
        // filter has a starting point rather than silently doing nothing.
        if (lat == null || lng == null) commit(markerInstance.getPosition());

        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the circle's radius in sync when the radius dropdown changes, without
  // re-initialising the whole map.
  useEffect(() => {
    circle.current?.setRadius(radiusKm * 1000);
  }, [radiusKm]);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      marker.current?.setPosition(point);
      circle.current?.setCenter(point);
      map.current?.setCenter(point);
      map.current?.setZoom(14);
      onChange(point.lat, point.lng);
    });
  }

  if (status === 'unavailable') {
    return (
      <p className="rounded-lg border border-[var(--rule)] bg-[var(--plate)] p-3 text-sm text-[var(--muted)]">
        Map isn't available right now — enter latitude and longitude directly instead.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">Click the map, or drag the pin, to set the search point.</p>
        <button type="button" className="btn btn-ghost py-1.5 text-xs" onClick={useCurrentLocation}>
          📍 My current location
        </button>
      </div>
      <div ref={host} className="h-64 w-full rounded-lg border border-[var(--rule)]" />
      {status === 'loading' && <p className="text-xs text-[var(--muted)]">Loading map…</p>}
    </div>
  );
}
