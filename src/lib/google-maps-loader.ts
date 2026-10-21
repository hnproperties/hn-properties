/**
 * Shared Google Maps JS API loader, extracted from GoogleLocationPicker so other
 * map components (the CRM's radius-search pin picker) can load the same script
 * without duplicating ~50 lines of bootstrap logic or risking two different
 * `<script>` tags racing to load the API.
 */

export const JABALPUR = { lat: 23.1815, lng: 79.9864 };

let loading: Promise<any> | null = null;

export function loadGoogleMaps(key: string): Promise<any> {
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
