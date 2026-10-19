'use client';

import { useCallback, useEffect, useState } from 'react';
import { currentPushState, enablePush, type VisitorCategory } from '@/lib/push-client';

/**
 * A dismissible bottom banner inviting anyone browsing — signed in or not — to turn
 * on notifications for new listings and Hot Deals. Separate from NotificationsToggle,
 * which is the owner/staff control buried in the account and CRM pages; this is the
 * visible, unmissable version aimed at every visitor, matching how the person asked
 * for it: "like how it works for every app," i.e. a real native alert once granted,
 * not a setting someone has to go hunting for.
 *
 * Shown once per device unless dismissed. Never shown again once a device is
 * already subscribed, already denied, or on a browser that cannot do Web Push
 * (currentPushState() already accounts for the iOS-needs-home-screen-install case).
 */

const DISMISSED_KEY = 'hn-visitor-push-dismissed';
const SHOW_DELAY_MS = 2500; // let the page settle before asking for anything

export default function VisitorNotificationsPrompt() {
  const [visible, setVisible] = useState(false);
  const [listings, setListings] = useState(true);
  const [hotDeals, setHotDeals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISSED_KEY)) return;

    let alive = true;
    const timer = window.setTimeout(() => {
      currentPushState().then((state) => {
        if (alive && state === 'off') setVisible(true);
      });
    }, SHOW_DELAY_MS);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* private browsing or storage disabled — just hide for this session */
    }
  }, []);

  const enable = useCallback(async () => {
    const categories: VisitorCategory[] = [
      ...(listings ? (['LISTINGS'] as const) : []),
      ...(hotDeals ? (['HOT_DEALS'] as const) : []),
    ];
    if (!categories.length) {
      setError('Pick at least one to turn on.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const state = await enablePush('VISITOR', categories);
      if (state === 'on') {
        setDone(true);
        window.setTimeout(dismiss, 1800);
      } else if (state === 'denied') {
        setError('Notifications are blocked for this site in your browser settings.');
      } else {
        setError('Could not turn this on. Please try again.');
      }
    } catch {
      setError('Could not turn this on. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [listings, hotDeals, dismiss]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      <div className="plate w-full max-w-md border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg">
        {done ? (
          <p className="text-center text-sm font-medium text-[var(--navy)]">
            🔔 You're all set — you'll get alerts on this device.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-lg">
                🔔
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--navy)]">Never miss a property</p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  Get notified on this device for new listings and Hot Deals.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="shrink-0 rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-[var(--surface-2)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--navy)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={listings} onChange={(e) => setListings(e.target.checked)} />
                New listings
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hotDeals} onChange={(e) => setHotDeals(e.target.checked)} />
                Hot Deals
              </label>
            </div>

            {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={enable} disabled={busy} className="btn btn-primary flex-1 py-2 text-sm disabled:opacity-50">
                {busy ? 'Working…' : 'Enable notifications'}
              </button>
              <button type="button" onClick={dismiss} className="btn btn-ghost py-2 text-sm">
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
