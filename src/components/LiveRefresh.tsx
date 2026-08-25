'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Public pages listen for a signal that something visible has changed, and re-fetch
 * themselves in place — so a listing published in the CRM appears on an open tab
 * without anyone reloading.
 *
 * The stream carries no data, only "something changed", so there is nothing to leak
 * and very little to send. If it drops, returning to the tab still refreshes.
 *
 * Set NEXT_PUBLIC_LIVE_UPDATES=false to turn the connection off and rely on the
 * cache alone — worth doing if hosting ever bills for held-open connections.
 */
export default function LiveRefresh() {
  const router = useRouter();
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    const enabled = process.env.NEXT_PUBLIC_LIVE_UPDATES !== 'false';
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let opening: ReturnType<typeof setTimeout> | null = null;

    /*
     * Opening the stream during page load keeps the browser's tab spinner turning,
     * because as far as it is concerned a request is still in flight. Waiting until
     * the load event has fired — and then a moment more — lets the page finish
     * properly before the connection opens.
     */
    function connect() {
      if (!enabled || document.visibilityState === 'hidden') return;
      source = new EventSource('/api/live');
      source.addEventListener('change', () => router.refresh());
      source.onerror = () => {
        source?.close();
        source = null;
        retry = setTimeout(connect, 15000);
      };
    }

    function connectAfterLoad() {
      opening = setTimeout(connect, 1200);
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        leftAt.current = Date.now();
        source?.close();
        source = null;
        return;
      }

      const away = leftAt.current ? (Date.now() - leftAt.current) / 1000 : 0;
      leftAt.current = null;
      if (away >= 60) router.refresh();
      if (!source) connect();
    }

    if (document.readyState === 'complete') connectAfterLoad();
    else window.addEventListener('load', connectAfterLoad, { once: true });

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      source?.close();
      if (retry) clearTimeout(retry);
      if (opening) clearTimeout(opening);
      window.removeEventListener('load', connectAfterLoad);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  return null;
}
